#!/usr/bin/env bash
# Disposable-Postgres regression harness for the P1-P3 finance/intake schema.
#
# Spins up a throwaway local Postgres instance (never a real Supabase
# project), applies every migration under supabase/migrations/** plus
# supabase/seed.sql from zero, then runs a battery of scenarios that must
# each succeed or fail exactly as named. Exits non-zero if any scenario
# didn't match its expectation, or if setup itself failed.
#
# P3 adds scenarios for the canonical finance write RPCs (record_cash_event,
# approve_settlement, reverse_settlement, record_payout): authorization
# (unauthenticated, non-founder member, wrong-org founder, revoked founder),
# concurrent identical approval, idempotency mismatch, audit-event
# atomicity, approval derivation against real SETY figures, exact reversal
# via the RPC, and full/partial/transfer payout via the RPC.
#
# Usage: scripts/db-verify.sh
# Requires: postgresql (initdb, pg_ctl, psql) on PATH. Installs nothing,
# applies nothing remotely, and tears its own instance down on exit.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HARNESS_DIR="$ROOT/scripts/db-verify"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/firma23-db-verify.XXXXXX")"
PGDATA="$WORKDIR/data"
PGPORT="${DB_VERIFY_PORT:-58217}"
PASS=0
FAIL=0
declare -a FAILURES=()

cleanup() {
  pg_ctl -D "$PGDATA" stop -m fast >/dev/null 2>&1 || true
  if [ -z "${DB_VERIFY_KEEP:-}" ]; then
    rm -rf "$WORKDIR"
  else
    echo "DB_VERIFY_KEEP set: leaving $WORKDIR in place for inspection."
  fi
}
trap cleanup EXIT

psql_run() {
  psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"
}

# Runs a SQL script read from stdin as its own psql session (so BEGIN/COMMIT
# inside the heredoc control a real transaction, which is required for
# deferred constraints — they only evaluate at an actual COMMIT).
run_sql() {
  psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q
}

expect_success() {
  local desc="$1"
  if run_sql >"$WORKDIR/last.log" 2>&1; then
    PASS=$((PASS + 1))
    echo "PASS (expected success): $desc"
  else
    FAIL=$((FAIL + 1))
    FAILURES+=("$desc")
    echo "FAIL (expected success, but it errored): $desc"
    sed 's/^/    /' "$WORKDIR/last.log"
  fi
}

expect_failure() {
  local desc="$1"
  if run_sql >"$WORKDIR/last.log" 2>&1; then
    FAIL=$((FAIL + 1))
    FAILURES+=("$desc")
    echo "FAIL (expected failure, but it succeeded): $desc"
  else
    PASS=$((PASS + 1))
    echo "PASS (expected failure): $desc"
  fi
}

query_scalar() {
  psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA -c "$1"
}

echo "=== setting up disposable Postgres ($PGDATA, port $PGPORT) ==="
if ! command -v initdb >/dev/null || ! command -v pg_ctl >/dev/null || ! command -v psql >/dev/null; then
  echo "FATAL: initdb/pg_ctl/psql not found on PATH. Install PostgreSQL (e.g. \`brew install postgresql@17\`) and retry."
  exit 1
fi

initdb -D "$PGDATA" -U postgres --no-locale --encoding=UTF8 -A trust >"$WORKDIR/initdb.log" 2>&1 || {
  echo "FATAL: initdb failed"; cat "$WORKDIR/initdb.log"; exit 1;
}
pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $WORKDIR" -l "$WORKDIR/server.log" start >"$WORKDIR/start.log" 2>&1
sleep 1
if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "FATAL: Postgres did not start"; cat "$WORKDIR/server.log"; exit 1;
fi
echo "$(psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA -c 'select version();')"

echo "=== applying stub Supabase schema (auth/storage stand-ins) ==="
psql_run -f "$HARNESS_DIR/00_stub_supabase.sql" >"$WORKDIR/setup.log" 2>&1 || {
  echo "FATAL: stub schema failed"; cat "$WORKDIR/setup.log"; exit 1;
}

echo "=== applying migrations from zero ==="
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql_run -f "$f" >"$WORKDIR/setup.log" 2>&1 || {
    echo "FATAL: migration failed: $f"; cat "$WORKDIR/setup.log"; exit 1;
  }
  echo "  applied $(basename "$f")"
done

echo "=== applying seed.sql from zero ==="
psql_run -f "$ROOT/supabase/seed.sql" >"$WORKDIR/setup.log" 2>&1 || {
  echo "FATAL: seed failed"; cat "$WORKDIR/setup.log"; exit 1;
}

echo "=== wiring test identities ==="
psql_run -f "$HARNESS_DIR/01_test_identities.sql" >"$WORKDIR/setup.log" 2>&1 || {
  echo "FATAL: test identity setup failed"; cat "$WORKDIR/setup.log"; exit 1;
}

echo
echo "=== scenario 1: exact settlement reversal ==="

expect_failure "reversal base is not the exact negative of the original" <<'SQL'
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -299999, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
SQL

expect_failure "reversal with the exact negative base but ZERO lines" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
commit;
SQL

expect_failure "partial reversal that sums correctly but omits the closer line entirely" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -300000, 'MXN', 1);
commit;
SQL

expect_failure "reversal that exactly negates both lines plus one bogus extra line" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2),
  ('a2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000005', 'bonus', 'member_pool', 'Extra', 'b0000000-0000-4000-8000-000000000003', 'Bonus', 0, 0, 'MXN', 3);
commit;
SQL

expect_success "an EXACT reversal succeeds" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000006', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000006', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2);
commit;
SQL

expect_success "reverse-and-reissue: a fresh original may be inserted once the opportunity has zero unreversed originals" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000007', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000007', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, 210000, 'MXN', 2);
commit;
SQL

expect_failure "a second approved reversal against the same original still fails" <<'SQL'
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
SQL

expect_failure "reversal with a per-line currency mismatch against its own settlement" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000007', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000009', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90000, 'USD', 1),
  ('a2000000-0000-4000-8000-00000000000c', 'a1000000-0000-4000-8000-000000000009', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2);
commit;
SQL

expect_failure "reversal with a mismatched amount on one line" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000007', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-00000000000d', 'a1000000-0000-4000-8000-00000000000a', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90001, 'MXN', 1),
  ('a2000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-00000000000a', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -209999, 'MXN', 2);
commit;
SQL

expect_failure "reversal with correct amounts but changed metadata (recipient_label)" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('a1000000-0000-4000-8000-00000000000f', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000007', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-00000000000f', 'house', 'org_recipient', 'EVEN (changed)', null, 'Casa', 10000, -90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-00000000000f', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2);
commit;
SQL

echo
echo "=== scenario 2: duplicate-key lines (multiset, not join-fooled) ==="

expect_success "set up a duplicate-key original: two lines sharing the same (share_key, member_id)" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('b1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, 50000, 'MXN', 1),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, 50000, 'MXN', 2);
commit;
SQL

expect_failure "a reversal collapsing the duplicate pair into one line is rejected (multiplicity 1 vs 2)" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('b1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'b1000000-0000-4000-8000-000000000001', -100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, -100000, 'MXN', 1);
commit;
SQL

expect_success "a reversal with the same duplicate multiplicity (two -50000 lines) succeeds" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values ('b1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'b1000000-0000-4000-8000-000000000001', -100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('b2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, -50000, 'MXN', 1),
  ('b2000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000003', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, -50000, 'MXN', 2);
commit;
SQL

echo
echo "=== scenario 3: a line inserted later, in a separate transaction, cannot bypass reversal exactness ==="

expect_success "set up an original + exact reversal (2 matching lines) on a fresh opportunity pairing" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id)
values
  ('c1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 50000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'c1000000-0000-4000-8000-000000000001', -50000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 50000, 'MXN', 1),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -50000, 'MXN', 1);
commit;
SQL

expect_failure "inserting one more line on the already-committed reversal, in a brand-new transaction, still fails exactness" <<'SQL'
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'bonus', 'member_pool', 'Late Extra', 'b0000000-0000-4000-8000-000000000003', 'Bonus', 0, 0, 'MXN', 2);
SQL

echo
echo "=== scenario 4: payout integrity ==="

expect_failure "cross-opportunity payout allocation fails immediately" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at)
values ('a3000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago de prueba cross-opportunity', -90000, current_date);
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('40000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 90000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-cross-opportunity-1');
rollback;
SQL

expect_failure "orphan payout event (zero allocations) fails at commit" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at)
values ('a3000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago huérfano de prueba', -50000, current_date);
commit;
SQL

expect_success "a full payout on the house line reconciles" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at)
values ('a3000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago completo a la casa', -90000, current_date);
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-000000000009', 'a3000000-0000-4000-8000-000000000010', 90000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-house-full-payout');
commit;
SQL

expect_success "a partial payout on the closer line (100000 of 210000) reconciles and derives partial" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at)
values ('a3000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago parcial de cierre', -100000, current_date);
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000011', 100000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-closer-partial-payout');
commit;
SQL

expect_failure "an allocation that would overpay the closer line fails at commit" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at)
values ('a3000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago excedente de cierre', -200000, current_date);
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000012', 200000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-closer-overpay');
commit;
SQL

expect_success "append-only payout transfer: move 50000 of the house line's payout to the closer line against the same event, net unchanged" <<'SQL'
begin;
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-000000000009', 'a3000000-0000-4000-8000-000000000010', -50000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-transfer-out');
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000010', 50000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-transfer-in');
commit;
SQL

TRANSFER_HOUSE_TOTAL="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = 'a2000000-0000-4000-8000-000000000009';")"
if [ "$TRANSFER_HOUSE_TOTAL" = "40000" ]; then
  PASS=$((PASS + 1)); echo "PASS: house line net allocation after transfer is 40000 (was 90000, -50000 transferred out)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("house line net allocation after transfer"); echo "FAIL: expected house line net 40000, got $TRANSFER_HOUSE_TOTAL"
fi

echo
echo "=== scenario 5: stat_events authority ==="

expect_failure "even a founder cannot insert a stat_event directly (no browser write path at all)" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.stat_events (member_id, opportunity_id, metric_key, quantity, source_kind, source_id)
values ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', 1, 'db_verify', '99999999-0000-4000-8000-000000000001');
SQL

expect_failure "a zero-quantity original is rejected by CHECK even bypassing RLS" <<'SQL'
insert into public.stat_events (member_id, opportunity_id, metric_key, quantity, source_kind, source_id)
values ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', 0, 'db_verify', '99999999-0000-4000-8000-000000000002');
SQL

expect_success "a signed original + exact-negative reversal both insert cleanly" <<'SQL'
insert into public.stat_events (id, member_id, opportunity_id, metric_key, quantity, source_kind, source_id)
values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', 1, 'db_verify', '99999999-0000-4000-8000-000000000003');
insert into public.stat_events (member_id, opportunity_id, metric_key, quantity, source_kind, source_id, reverses_stat_event_id)
values ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', -1, 'db_verify', '99999999-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000001');
SQL

REVERSAL_NET="$(query_scalar "select coalesce(sum(quantity),0) from public.stat_events where source_kind = 'db_verify' and source_id = '99999999-0000-4000-8000-000000000003';")"
if [ "$REVERSAL_NET" = "0" ]; then
  PASS=$((PASS + 1)); echo "PASS: signed reversal nets exactly to zero"
else
  FAIL=$((FAIL + 1)); FAILURES+=("signed stat reversal nets to zero"); echo "FAIL: expected net 0, got $REVERSAL_NET"
fi

expect_failure "a reversal with the wrong quantity is rejected" <<'SQL'
insert into public.stat_events (id, member_id, opportunity_id, metric_key, quantity, source_kind, source_id)
values ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', 1, 'db_verify', '99999999-0000-4000-8000-000000000004');
insert into public.stat_events (member_id, opportunity_id, metric_key, quantity, source_kind, source_id, reverses_stat_event_id)
values ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', -2, 'db_verify', '99999999-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002');
SQL

echo
echo "=== scenario 6: intake isolation and idempotency ==="

expect_failure "cross-org: org 1 cannot run_intake against org 2's source document" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-0000000000ff', 'db-verify-cross-org-1');
SQL

expect_success "identical replay: org 1 runs intake, then replays the same call with the same idempotency key" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'db-verify-replay-key');
select * from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'db-verify-replay-key');
SQL

REPLAY_ROWS="$(query_scalar "select count(*) from public.intake_runs where org_id = 'a0000000-0000-4000-8000-000000000001' and idempotency_key = 'db-verify-replay-key';")"
if [ "$REPLAY_ROWS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: identical replay created exactly one row"
else
  FAIL=$((FAIL + 1)); FAILURES+=("identical replay row count"); echo "FAIL: expected exactly 1 row, got $REPLAY_ROWS"
fi

AUDIT_ROWS="$(query_scalar "select count(*) from public.audit_events where action = 'run_intake' and target_id = (select id from public.intake_runs where org_id = 'a0000000-0000-4000-8000-000000000001' and idempotency_key = 'db-verify-replay-key');")"
if [ "$AUDIT_ROWS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: identical replay wrote exactly one audit event"
else
  FAIL=$((FAIL + 1)); FAILURES+=("identical replay audit event count"); echo "FAIL: expected exactly 1 audit event, got $AUDIT_ROWS"
fi

expect_failure "mismatched idempotency-key reuse: same key, different source document, is a deterministic conflict" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'db-verify-mismatch-key');
select * from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'db-verify-mismatch-key');
-- a second, distinct source document registered for org 1, then reuse the SAME key against it
insert into public.source_documents (id, org_id, uploaded_by_member_id, filename, kind) values
  ('90000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'second-doc.pdf', 'quote');
select * from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'db-verify-mismatch-key');
SQL

echo
echo "=== scenario 7: 20-way concurrent identical intake replay (real OS-level concurrency) ==="
CONCURRENT_DIR="$WORKDIR/concurrent"
mkdir -p "$CONCURRENT_DIR"
declare -a CPIDS=()
for i in $(seq 1 20); do
  (
    psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA <<'SQL' > "$CONCURRENT_DIR/out_$i.txt" 2> "$CONCURRENT_DIR/err_$i.txt"
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select run_id from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'db-verify-concurrent-key');
SQL
  ) &
  CPIDS+=($!)
done
for pid in "${CPIDS[@]}"; do wait "$pid"; done

CONCURRENT_ERRORS="$(grep -l "ERROR" "$CONCURRENT_DIR"/err_*.txt 2>/dev/null | wc -l | tr -d ' ')"
CONCURRENT_ROWS="$(query_scalar "select count(*) from public.intake_runs where org_id = 'a0000000-0000-4000-8000-000000000001' and idempotency_key = 'db-verify-concurrent-key';")"
# -tA output still prints each SET command's "SET" status tag alongside the
# actual SELECT result, so filter to the UUID-shaped line before comparing
# — otherwise "SET" itself is counted as a second "distinct value" across
# every file and this looks like a disagreement when there isn't one.
CONCURRENT_RUN_IDS="$(grep -hEo '^[0-9a-f-]{36}$' "$CONCURRENT_DIR"/out_*.txt 2>/dev/null | sort -u | wc -l | tr -d ' ')"

if [ "$CONCURRENT_ERRORS" = "0" ]; then
  PASS=$((PASS + 1)); echo "PASS: 20 concurrent identical run_intake calls produced zero errors"
else
  FAIL=$((FAIL + 1)); FAILURES+=("20-way concurrency: zero errors"); echo "FAIL: $CONCURRENT_ERRORS of 20 concurrent calls errored"
  grep -h "ERROR" "$CONCURRENT_DIR"/err_*.txt 2>/dev/null | sort -u | sed 's/^/    /'
fi
if [ "$CONCURRENT_ROWS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: 20 concurrent identical calls created exactly one intake_runs row"
else
  FAIL=$((FAIL + 1)); FAILURES+=("20-way concurrency: exactly one row"); echo "FAIL: expected exactly 1 row, got $CONCURRENT_ROWS"
fi
if [ "$CONCURRENT_RUN_IDS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: every concurrent caller received the same run_id"
else
  FAIL=$((FAIL + 1)); FAILURES+=("20-way concurrency: same run_id for every caller"); echo "FAIL: callers disagreed on run_id ($CONCURRENT_RUN_IDS distinct values)"
fi

echo
echo "=== scenario 8: P3 finance write RPCs — authorization ==="

expect_failure "record_cash_event rejects a non-founder active member" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'x', 100, 'MXN', current_date, 'authz-member-cash-1');
SQL

expect_failure "approve_settlement rejects a non-founder active member" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'authz-member-approve-1');
SQL

expect_failure "reverse_settlement rejects a non-founder active member" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'authz-member-reverse-1');
SQL

expect_failure "record_payout rejects a non-founder active member" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"40000000-0000-4000-8000-000000000001","amountCentavos":1}]'::jsonb, 'authz-member-payout-1');
SQL

expect_failure "approve_settlement rejects an unauthenticated caller (authenticated role, no JWT claim)" <<'SQL'
set role authenticated;
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'authz-unauth-1');
SQL

expect_failure "approve_settlement rejects a founder acting on an opportunity outside their own org" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select * from public.approve_settlement('a0000000-0000-4000-8000-00000000000f', 'f0000000-0000-4000-8000-000000000001', 'authz-wrongorg-1');
SQL

expect_failure "approve_settlement rejects a founder whose membership has been revoked" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'authz-revoked-1');
SQL

echo
echo "=== scenario 9: approve_settlement — 20-way concurrent identical approval + derivation correctness ==="
CONCURRENT_APPROVE_DIR="$WORKDIR/concurrent_approve"
mkdir -p "$CONCURRENT_APPROVE_DIR"
declare -a APIDS=()
for i in $(seq 1 20); do
  (
    psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA <<'SQL' > "$CONCURRENT_APPROVE_DIR/out_$i.txt" 2> "$CONCURRENT_APPROVE_DIR/err_$i.txt"
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select settlement_id from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'approve-race-key');
SQL
  ) &
  APIDS+=($!)
done
for pid in "${APIDS[@]}"; do wait "$pid"; done

APPROVE_ERRORS="$(grep -l "ERROR" "$CONCURRENT_APPROVE_DIR"/err_*.txt 2>/dev/null | wc -l | tr -d ' ')"
APPROVE_ROWS="$(query_scalar "select count(*) from public.settlements where opportunity_id = 'f0000000-0000-4000-8000-000000000001' and idempotency_key = 'approve-race-key';")"
APPROVE_IDS="$(grep -hEo '^[0-9a-f-]{36}$' "$CONCURRENT_APPROVE_DIR"/out_*.txt 2>/dev/null | sort -u | wc -l | tr -d ' ')"

if [ "$APPROVE_ERRORS" = "0" ]; then
  PASS=$((PASS + 1)); echo "PASS: 20 concurrent identical approve_settlement calls produced zero errors"
else
  FAIL=$((FAIL + 1)); FAILURES+=("20-way approve concurrency: zero errors"); echo "FAIL: $APPROVE_ERRORS of 20 calls errored"
  grep -h "ERROR" "$CONCURRENT_APPROVE_DIR"/err_*.txt 2>/dev/null | sort -u | sed 's/^/    /'
fi
if [ "$APPROVE_ROWS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: 20 concurrent identical approve_settlement calls created exactly one settlement"
else
  FAIL=$((FAIL + 1)); FAILURES+=("20-way approve concurrency: exactly one settlement"); echo "FAIL: expected 1 settlement, got $APPROVE_ROWS"
fi
if [ "$APPROVE_IDS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: every concurrent caller received the same settlement_id"
else
  FAIL=$((FAIL + 1)); FAILURES+=("20-way approve concurrency: same settlement_id for every caller"); echo "FAIL: callers disagreed on settlement_id ($APPROVE_IDS distinct values)"
fi

SETTLEMENT_O1="$(query_scalar "select id from public.settlements where opportunity_id = 'f0000000-0000-4000-8000-000000000001' and idempotency_key = 'approve-race-key';")"

BASE_MATCH="$(query_scalar "select (base_centavos = 897270) from public.settlements where id = '$SETTLEMENT_O1';")"
if [ "$BASE_MATCH" = "t" ]; then
  PASS=$((PASS + 1)); echo "PASS: derived base matches the documented SETY distributable base (897270)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("approval derivation: base matches SETY figure"); echo "FAIL: base did not match 897270"
fi

LINES_MATCH="$(query_scalar "
  select
    exists(select 1 from public.settlement_lines where settlement_id = '$SETTLEMENT_O1' and share_key = 'house' and amount_centavos = 269181)
    and exists(select 1 from public.settlement_lines where settlement_id = '$SETTLEMENT_O1' and share_key = 'closer' and amount_centavos = 179454)
    and (select array_agg(amount_centavos order by amount_centavos desc) from public.settlement_lines where settlement_id = '$SETTLEMENT_O1' and share_key = 'delivery') = array[179454,157022,112159]::bigint[];
")"
if [ "$LINES_MATCH" = "t" ]; then
  PASS=$((PASS + 1)); echo "PASS: derived lines match the documented SETY 30/20/50 split exactly (house 269181, closer 179454, delivery 179454/157022/112159)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("approval derivation: lines match SETY split"); echo "FAIL: derived lines did not match the documented split"
fi

AUDIT_COUNT_1="$(query_scalar "select count(*) from public.audit_events where action = 'approve_settlement' and target_id = '$SETTLEMENT_O1';")"
if [ "$AUDIT_COUNT_1" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: exactly one audit event was written for the real approval"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: approve_settlement"); echo "FAIL: expected exactly 1 audit event, got $AUDIT_COUNT_1"
fi

expect_success "sequential replay of approve_settlement with the same key returns the same settlement" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'approve-race-key');
SQL

AUDIT_COUNT_1_AFTER_REPLAY="$(query_scalar "select count(*) from public.audit_events where action = 'approve_settlement' and target_id = '$SETTLEMENT_O1';")"
if [ "$AUDIT_COUNT_1_AFTER_REPLAY" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: a pure idempotent replay wrote no additional audit event"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: replay writes no new audit event"); echo "FAIL: audit count changed to $AUDIT_COUNT_1_AFTER_REPLAY after replay"
fi

echo
echo "=== scenario 10: record_cash_event via the RPC ==="

expect_failure "record_cash_event refuses to create a payout-type event" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'payout', 'x', -100, 'MXN', current_date, 'cash-rpc-no-payout-1');
SQL

expect_success "record_cash_event posts a fresh deposit via the RPC" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'Depósito adicional de prueba', 5000, 'MXN', current_date, 'cash-rpc-1');
SQL

CASH_EVENT_1="$(query_scalar "select id from public.cash_events where opportunity_id = 'f0000000-0000-4000-8000-000000000001' and idempotency_key = 'cash-rpc-1';")"
CASH_AUDIT_1="$(query_scalar "select count(*) from public.audit_events where action = 'record_cash_event' and target_id = '$CASH_EVENT_1';")"
if [ "$CASH_AUDIT_1" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: exactly one audit event was written for the real cash event"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: record_cash_event"); echo "FAIL: expected exactly 1 audit event, got $CASH_AUDIT_1"
fi

expect_success "identical replay of record_cash_event returns the same event, no error" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'Depósito adicional de prueba', 5000, 'MXN', current_date, 'cash-rpc-1');
SQL

CASH_AUDIT_1_AFTER_REPLAY="$(query_scalar "select count(*) from public.audit_events where action = 'record_cash_event' and target_id = '$CASH_EVENT_1';")"
if [ "$CASH_AUDIT_1_AFTER_REPLAY" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: a pure idempotent cash-event replay wrote no additional audit event"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: record_cash_event replay"); echo "FAIL: audit count changed to $CASH_AUDIT_1_AFTER_REPLAY after replay"
fi

expect_failure "record_cash_event rejects the same key reused with a different amount" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'Depósito adicional de prueba', 9999, 'MXN', current_date, 'cash-rpc-1');
SQL

echo
echo "=== scenario 11: record_payout via the RPC — full, partial, overpay rejection, historical transfer ==="

HOUSE_LINE_O1="$(query_scalar "select id from public.settlement_lines where settlement_id = '$SETTLEMENT_O1' and share_key = 'house';")"
CLOSER_LINE_O1="$(query_scalar "select id from public.settlement_lines where settlement_id = '$SETTLEMENT_O1' and share_key = 'closer';")"

expect_success "record_payout creates a full house payout via the RPC" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Pago RPC casa', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":269181}]'::jsonb, 'payout-rpc-house-1');
SQL

HOUSE_PAYOUT_EVENT="$(query_scalar "select id from public.cash_events where opportunity_id = 'f0000000-0000-4000-8000-000000000001' and idempotency_key = 'payout-rpc-house-1';")"
HOUSE_LINE_TOTAL_1="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$HOUSE_LINE_O1';")"
if [ "$HOUSE_LINE_TOTAL_1" = "269181" ]; then
  PASS=$((PASS + 1)); echo "PASS: full house payout allocates exactly the line amount (269181)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("record_payout: full house payout amount"); echo "FAIL: expected 269181, got $HOUSE_LINE_TOTAL_1"
fi

expect_success "record_payout creates a partial closer payout (100000 of 179454) via the RPC" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Pago RPC cierre parcial', current_date, '[{"settlementLineId":"$CLOSER_LINE_O1","amountCentavos":100000}]'::jsonb, 'payout-rpc-closer-partial-1');
SQL

expect_failure "record_payout rejects an allocation that would overpay the closer line" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Pago RPC exceso', current_date, '[{"settlementLineId":"$CLOSER_LINE_O1","amountCentavos":79455}]'::jsonb, 'payout-rpc-closer-overpay-1');
SQL

expect_success "record_payout reallocates against a historical event (transfer): house -50000, closer +50000, net zero" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Transferencia RPC', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":-50000},{"settlementLineId":"$CLOSER_LINE_O1","amountCentavos":50000}]'::jsonb, 'payout-rpc-transfer-1', '$HOUSE_PAYOUT_EVENT'::uuid);
SQL

HOUSE_LINE_TOTAL_2="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$HOUSE_LINE_O1';")"
CLOSER_LINE_TOTAL_2="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$CLOSER_LINE_O1';")"
HOUSE_EVENT_TOTAL="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where payout_cash_event_id = '$HOUSE_PAYOUT_EVENT';")"

if [ "$HOUSE_LINE_TOTAL_2" = "219181" ] && [ "$CLOSER_LINE_TOTAL_2" = "150000" ] && [ "$HOUSE_EVENT_TOTAL" = "269181" ]; then
  PASS=$((PASS + 1)); echo "PASS: transfer moved 50000 from house (now 219181) to closer (now 150000); the house payout event's own total is unchanged (269181)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("record_payout: historical transfer net-unchanged"); echo "FAIL: house=$HOUSE_LINE_TOTAL_2 closer=$CLOSER_LINE_TOTAL_2 event=$HOUSE_EVENT_TOTAL"
fi

PAYOUT_AUDIT_COUNT="$(query_scalar "select count(*) from public.audit_events where action = 'record_payout' and target_id = '$HOUSE_PAYOUT_EVENT';")"
if [ "$PAYOUT_AUDIT_COUNT" = "2" ]; then
  PASS=$((PASS + 1)); echo "PASS: exactly one audit event per real record_payout call against this event (full payout + transfer = 2)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: record_payout"); echo "FAIL: expected 2 audit events for this event, got $PAYOUT_AUDIT_COUNT"
fi

expect_success "identical replay of record_payout's full house payout returns the same event, no new rows" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Pago RPC casa', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":269181}]'::jsonb, 'payout-rpc-house-1');
SQL

HOUSE_LINE_TOTAL_AFTER_REPLAY="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$HOUSE_LINE_O1';")"
if [ "$HOUSE_LINE_TOTAL_AFTER_REPLAY" = "219181" ]; then
  PASS=$((PASS + 1)); echo "PASS: replaying record_payout did not insert any additional allocation"
else
  FAIL=$((FAIL + 1)); FAILURES+=("record_payout replay: no duplicate rows"); echo "FAIL: house line total changed to $HOUSE_LINE_TOTAL_AFTER_REPLAY after replay"
fi

expect_failure "record_payout rejects the same key reused with a different amount" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Pago RPC casa', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":1}]'::jsonb, 'payout-rpc-house-1');
SQL

echo
echo "=== scenario 12: reverse_settlement via the RPC — exact reversal, audit atomicity, idempotency mismatch ==="

expect_success "reverse_settlement creates the exact reversal via the RPC" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '$SETTLEMENT_O1', 'reverse-key-1');
SQL

REVERSAL_O1="$(query_scalar "select id from public.settlements where corrects_settlement_id = '$SETTLEMENT_O1' and kind = 'reversal';")"
REVERSE_AUDIT_1="$(query_scalar "select count(*) from public.audit_events where action = 'reverse_settlement' and target_id = '$REVERSAL_O1';")"
if [ "$REVERSE_AUDIT_1" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: exactly one audit event was written for the real reversal"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: reverse_settlement"); echo "FAIL: expected exactly 1 audit event, got $REVERSE_AUDIT_1"
fi

expect_success "identical replay of reverse_settlement returns the same reversal" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '$SETTLEMENT_O1', 'reverse-key-1');
SQL

REVERSE_AUDIT_1_AFTER_REPLAY="$(query_scalar "select count(*) from public.audit_events where action = 'reverse_settlement' and target_id = '$REVERSAL_O1';")"
if [ "$REVERSE_AUDIT_1_AFTER_REPLAY" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: a pure idempotent reversal replay wrote no additional audit event"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: reverse_settlement replay"); echo "FAIL: audit count changed to $REVERSE_AUDIT_1_AFTER_REPLAY after replay"
fi

expect_failure "approve_settlement rejects reusing a key already tied to a reversal on the same opportunity" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'reverse-key-1');
SQL

expect_success "reissue: a fresh original may be approved once the opportunity has zero unreversed originals" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'approve-race-key-2');
SQL

SETTLEMENT_O2="$(query_scalar "select id from public.settlements where opportunity_id = 'f0000000-0000-4000-8000-000000000001' and idempotency_key = 'approve-race-key-2';")"

expect_failure "reverse_settlement rejects the same key reused for a different corrects_settlement_id on the same opportunity" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '$SETTLEMENT_O2', 'reverse-key-1');
SQL

echo
echo "======================================================================"
echo "RESULT: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed scenarios:"
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  exit 1
fi
echo "All scenarios passed."
exit 0
