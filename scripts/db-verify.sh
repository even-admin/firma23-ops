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
  local expected_substring="${2:-}"
  # Mandatory, not optional (R5): a scenario that doesn't name the error it
  # expects passes on ANY error — a typo'd UUID, a missing fixture, a wrong
  # constraint — which is the exact false-pass shape M5 was about. A call
  # site missing this argument is a harness bug, so it fails loudly here
  # rather than silently degrading to "any error will do".
  if [ -z "$expected_substring" ]; then
    FAIL=$((FAIL + 1))
    FAILURES+=("$desc (missing expected-error substring)")
    echo "FAIL (harness bug — expect_failure called without an expected-error substring): $desc"
    return
  fi
  if run_sql >"$WORKDIR/last.log" 2>&1; then
    FAIL=$((FAIL + 1))
    FAILURES+=("$desc")
    echo "FAIL (expected failure, but it succeeded): $desc"
  elif ! grep -qF "$expected_substring" "$WORKDIR/last.log"; then
    FAIL=$((FAIL + 1))
    FAILURES+=("$desc (wrong error)")
    echo "FAIL (wrong error — expected to contain \"$expected_substring\"): $desc"
    sed 's/^/    /' "$WORKDIR/last.log"
  else
    PASS=$((PASS + 1))
    echo "PASS (expected failure): $desc"
  fi
}

query_scalar() {
  psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA -c "$1"
}

# Fan out $2 concurrent single-statement psql calls of $3 (a SQL string, not a
# heredoc — multiple `set ...;`/`select ...;` statements separated by `;` work
# fine as one -c argument) against directory $1, then wait for all of them.
# Real OS-level concurrency (background processes), not simulated interleaving.
run_concurrent() {
  local out_dir="$1" count="$2" sql="$3"
  mkdir -p "$out_dir"
  rm -f "$out_dir"/out_*.txt "$out_dir"/err_*.txt
  local pids=()
  for i in $(seq 1 "$count"); do
    (
      psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA -c "$sql" \
        > "$out_dir/out_$i.txt" 2> "$out_dir/err_$i.txt"
    ) &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do wait "$pid"; done
}

concurrent_error_count() {
  grep -l "ERROR" "$1"/err_*.txt 2>/dev/null | wc -l | tr -d ' '
}

# Distinct UUID-shaped values across every out_*.txt in a run_concurrent
# directory. psql -tA still prints each SET command's own "SET" status tag
# alongside the real SELECT result, so this filters to UUID-shaped lines
# before counting distinct values — otherwise "SET" itself would count as a
# second distinct value in every file.
concurrent_distinct_uuids() {
  grep -hEo '^[0-9a-f-]{36}$' "$1"/out_*.txt 2>/dev/null | sort -u | wc -l | tr -d ' '
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

expect_failure "reversal base is not the exact negative of the original" "must equal the exact negative of" <<'SQL'
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -299999, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-bad-base');
SQL

expect_failure "reversal with the exact negative base but ZERO lines" "has no lines" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-zero-lines');
commit;
SQL

expect_failure "partial reversal that sums correctly but omits the closer line entirely" "does not exactly negate its original's line multiset" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-omit-closer');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -300000, 'MXN', 1);
commit;
SQL

expect_failure "reversal that exactly negates both lines plus one bogus extra line" "does not exactly negate its original's line multiset" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-extra-line');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000005', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2),
  ('a2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000005', 'bonus', 'member_pool', 'Extra', 'b0000000-0000-4000-8000-000000000003', 'Bonus', 0, 0, 'MXN', 3);
commit;
SQL

expect_success "an EXACT reversal succeeds" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-exact-reversal');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000006', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000006', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2);
commit;
SQL

expect_success "reverse-and-reissue: a fresh original may be inserted once the opportunity has zero unreversed originals" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000007', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-reissue-original');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000007', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-00000000000a', 'a1000000-0000-4000-8000-000000000007', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, 210000, 'MXN', 2);
commit;
SQL

expect_failure "a second approved reversal against the same original still fails" "settlements_one_approved_reversal_per_original" <<'SQL'
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000008', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000001', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-second-reversal');
SQL

expect_failure "reversal with a per-line currency mismatch against its own settlement" "must match its settlement's currency" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-000000000009', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000007', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-currency-mismatch');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000009', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90000, 'USD', 1),
  ('a2000000-0000-4000-8000-00000000000c', 'a1000000-0000-4000-8000-000000000009', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2);
commit;
SQL

expect_failure "reversal with a mismatched amount on one line" "does not exactly negate its original's line multiset" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-00000000000a', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000007', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-amount-mismatch');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-00000000000d', 'a1000000-0000-4000-8000-00000000000a', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -90001, 'MXN', 1),
  ('a2000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-00000000000a', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -209999, 'MXN', 2);
commit;
SQL

expect_failure "reversal with correct amounts but changed metadata (recipient_label)" "does not exactly negate its original's line multiset" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('a1000000-0000-4000-8000-00000000000f', 'f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'a1000000-0000-4000-8000-000000000007', -300000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s1-metadata-mismatch');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('a2000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-00000000000f', 'house', 'org_recipient', 'EVEN (changed)', null, 'Casa', 10000, -90000, 'MXN', 1),
  ('a2000000-0000-4000-8000-000000000012', 'a1000000-0000-4000-8000-00000000000f', 'closer', 'member_pool', 'Test Closer', 'b0000000-0000-4000-8000-000000000003', 'Cierre', 10000, -210000, 'MXN', 2);
commit;
SQL

echo
echo "=== scenario 2: duplicate-key lines (multiset, not join-fooled) ==="

expect_success "set up a duplicate-key original: two lines sharing the same (share_key, member_id)" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('b1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s2-dup-original');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, 50000, 'MXN', 1),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, 50000, 'MXN', 2);
commit;
SQL

expect_failure "a reversal collapsing the duplicate pair into one line is rejected (multiplicity 1 vs 2)" "does not exactly negate its original's line multiset" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('b1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'b1000000-0000-4000-8000-000000000001', -100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s2-collapse');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, -100000, 'MXN', 1);
commit;
SQL

expect_success "a reversal with the same duplicate multiplicity (two -50000 lines) succeeds" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('b1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'b1000000-0000-4000-8000-000000000001', -100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s2-same-multiplicity');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('b2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000003', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, -50000, 'MXN', 1),
  ('b2000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000003', 'delivery', 'member_pool', 'Dup', 'b0000000-0000-4000-8000-000000000003', 'Delivery', 5000, -50000, 'MXN', 2);
commit;
SQL

echo
echo "=== scenario 3: a line inserted later, in a separate transaction, cannot bypass reversal exactness ==="

expect_success "set up an original + exact reversal (2 matching lines) on a fresh opportunity pairing" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values
  ('c1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 50000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s3-original'),
  ('c1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'approved', 'reversal', 'c1000000-0000-4000-8000-000000000001', -50000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-s3-reversal');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 50000, 'MXN', 1),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, -50000, 'MXN', 1);
commit;
SQL

expect_failure "inserting one more line on the already-committed reversal, in a brand-new transaction, still fails exactness" "does not exactly negate its original's line multiset" <<'SQL'
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', 'bonus', 'member_pool', 'Late Extra', 'b0000000-0000-4000-8000-000000000003', 'Bonus', 0, 0, 'MXN', 2);
SQL

echo
echo "=== scenario 4: payout integrity ==="

expect_failure "cross-opportunity payout allocation fails immediately" "cannot pay a line on opportunity" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at, idempotency_key)
values ('a3000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago de prueba cross-opportunity', -90000, current_date, 'db-verify-s4-cross-opportunity');
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('40000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 90000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-cross-opportunity-1');
rollback;
SQL

expect_failure "orphan payout event (zero allocations) fails at commit" "but must equal" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at, idempotency_key)
values ('a3000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago huérfano de prueba', -50000, current_date, 'db-verify-s4-orphan-payout');
commit;
SQL

expect_success "a full payout on the house line reconciles" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at, idempotency_key)
values ('a3000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago completo a la casa', -90000, current_date, 'db-verify-s4-house-full-payout');
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-000000000009', 'a3000000-0000-4000-8000-000000000010', 90000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-house-full-payout');
commit;
SQL

expect_success "a partial payout on the closer line (100000 of 210000) reconciles and derives partial" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at, idempotency_key)
values ('a3000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago parcial de cierre', -100000, current_date, 'db-verify-s4-closer-partial-payout');
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000011', 100000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-closer-partial-payout');
commit;
SQL

expect_failure "an allocation that would overpay the closer line fails at commit" "must fall within" <<'SQL'
begin;
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, occurred_at, idempotency_key)
values ('a3000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000003', 'payout', 'Pago excedente de cierre', -200000, current_date, 'db-verify-s4-closer-overpay');
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('a2000000-0000-4000-8000-00000000000a', 'a3000000-0000-4000-8000-000000000012', 200000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-closer-overpay');
commit;
SQL

# Superseded by the R2 finding: an active-to-active transfer with no
# reversal involved is not a doctrine-valid operation (only a
# reversed-to-active transfer is, via record_payout's existing-event mode —
# see scenario 17/B3 and AT-R2 below). This used to be a raw table insert
# asserted as a *success*, which never exercised record_payout's own
# validation at all and so could not have caught R2's gap. It now goes
# through the RPC and asserts the rejection, on the same house/closer lines
# (both active, unreversed) the old version used.
expect_failure "AT-R2: record_payout refuses a same-event transfer between two active (unreversed) lines — active-to-active is not doctrine-valid, only reversed-to-active is" \
  "a negative allocation may only leave a reversed settlement's line" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.record_payout(
  'a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000003',
  'Intento de transferencia activa-a-activa', current_date,
  '[{"settlementLineId":"a2000000-0000-4000-8000-000000000009","amountCentavos":-50000},
    {"settlementLineId":"a2000000-0000-4000-8000-00000000000a","amountCentavos":50000}]'::jsonb,
  'db-verify-active-to-active-transfer-rejected',
  'a3000000-0000-4000-8000-000000000010'::uuid);
SQL

TRANSFER_HOUSE_TOTAL="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = 'a2000000-0000-4000-8000-000000000009';")"
if [ "$TRANSFER_HOUSE_TOTAL" = "90000" ]; then
  PASS=$((PASS + 1)); echo "PASS: house line net allocation is unchanged at 90000 — the rejected transfer moved nothing"
else
  FAIL=$((FAIL + 1)); FAILURES+=("house line net allocation after rejected transfer"); echo "FAIL: expected house line net 90000 (unchanged), got $TRANSFER_HOUSE_TOTAL"
fi

echo
echo "=== scenario 5: stat_events authority ==="

expect_failure "even a founder cannot insert a stat_event directly (no browser write path at all)" "permission denied for table stat_events" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.stat_events (member_id, opportunity_id, metric_key, quantity, source_kind, source_id)
values ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', 1, 'db_verify', '99999999-0000-4000-8000-000000000001');
SQL

expect_failure "a zero-quantity original is rejected by CHECK even bypassing RLS" "violates check constraint" <<'SQL'
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

expect_failure "a reversal with the wrong quantity is rejected" "must carry the exact negative" <<'SQL'
insert into public.stat_events (id, member_id, opportunity_id, metric_key, quantity, source_kind, source_id)
values ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', 1, 'db_verify', '99999999-0000-4000-8000-000000000004');
insert into public.stat_events (member_id, opportunity_id, metric_key, quantity, source_kind, source_id, reverses_stat_event_id)
values ('b0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'opportunity_closed', -2, 'db_verify', '99999999-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002');
SQL

echo
echo "=== scenario 6: intake isolation and idempotency ==="

expect_failure "cross-org: org 1 cannot run_intake against org 2's source document" "does not belong to org" <<'SQL'
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

expect_failure "mismatched idempotency-key reuse: same key, different source document, is a deterministic conflict" "already used for a different source document" <<'SQL'
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
run_concurrent "$CONCURRENT_DIR" 20 "set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; select run_id from public.run_intake('a0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'db-verify-concurrent-key');"

CONCURRENT_ERRORS="$(concurrent_error_count "$CONCURRENT_DIR")"
CONCURRENT_ROWS="$(query_scalar "select count(*) from public.intake_runs where org_id = 'a0000000-0000-4000-8000-000000000001' and idempotency_key = 'db-verify-concurrent-key';")"
CONCURRENT_RUN_IDS="$(concurrent_distinct_uuids "$CONCURRENT_DIR")"

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

expect_failure "record_cash_event rejects a non-founder active member" "founder access required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'x', 100, 'MXN', current_date, 'authz-member-cash-1');
SQL

expect_failure "approve_settlement rejects a non-founder active member" "founder access required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'authz-member-approve-1');
SQL

expect_failure "reverse_settlement rejects a non-founder active member" "founder access required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'authz-member-reverse-1');
SQL

expect_failure "record_payout rejects a non-founder active member" "founder access required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"40000000-0000-4000-8000-000000000001","amountCentavos":1}]'::jsonb, 'authz-member-payout-1');
SQL

expect_failure "approve_settlement rejects an unauthenticated caller (authenticated role, no JWT claim)" "founder access required" <<'SQL'
set role authenticated;
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'authz-unauth-1');
SQL

expect_failure "approve_settlement rejects a founder acting on an opportunity outside their own org" "does not belong to org" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
select * from public.approve_settlement('a0000000-0000-4000-8000-00000000000f', 'f0000000-0000-4000-8000-000000000001', 'authz-wrongorg-1');
SQL

expect_failure "approve_settlement rejects a founder whose membership has been revoked" "founder access required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'authz-revoked-1');
SQL

echo
echo "=== scenario 8b: anon must be refused at the grant layer, not the function body (H2) ==="

expect_failure "record_cash_event as anon is refused at the schema boundary, never reaches the founder check" "permission denied for schema public" <<'SQL'
set role anon;
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'x', 100, 'MXN', current_date, 'authz-anon-cash-1');
SQL

expect_failure "approve_settlement as anon is refused at the schema boundary, never reaches the founder check" "permission denied for schema public" <<'SQL'
set role anon;
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'authz-anon-approve-1');
SQL

expect_failure "reverse_settlement as anon is refused at the schema boundary, never reaches the founder check" "permission denied for schema public" <<'SQL'
set role anon;
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'authz-anon-reverse-1');
SQL

expect_failure "record_payout as anon is refused at the schema boundary, never reaches the founder check" "permission denied for schema public" <<'SQL'
set role anon;
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"40000000-0000-4000-8000-000000000001","amountCentavos":1}]'::jsonb, 'authz-anon-payout-1');
SQL

echo
echo "=== scenario 8c: idempotency key validation at the boundary (H1) ==="

expect_failure "record_cash_event rejects a null idempotency key" "valid idempotency key is required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'x', 100, 'MXN', current_date, null);
SQL

expect_failure "record_cash_event rejects a blank idempotency key" "valid idempotency key is required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'x', 100, 'MXN', current_date, '   ');
SQL

expect_failure "approve_settlement rejects a null idempotency key" "valid idempotency key is required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', null);
SQL

expect_failure "reverse_settlement rejects a null idempotency key" "valid idempotency key is required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', null);
SQL

expect_failure "record_payout rejects a null idempotency key" "valid idempotency key is required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"40000000-0000-4000-8000-000000000001","amountCentavos":1}]'::jsonb, null);
SQL

echo
echo "=== scenario 9: approve_settlement — 20-way concurrent identical approval + derivation correctness ==="
CONCURRENT_APPROVE_DIR="$WORKDIR/concurrent_approve"
run_concurrent "$CONCURRENT_APPROVE_DIR" 20 "set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; select settlement_id from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'approve-race-key');"

APPROVE_ERRORS="$(concurrent_error_count "$CONCURRENT_APPROVE_DIR")"
APPROVE_ROWS="$(query_scalar "select count(*) from public.settlements where opportunity_id = 'f0000000-0000-4000-8000-000000000001' and idempotency_key = 'approve-race-key';")"
APPROVE_IDS="$(concurrent_distinct_uuids "$CONCURRENT_APPROVE_DIR")"

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

expect_failure "record_cash_event refuses to create a payout-type event" "use record_payout" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'payout', 'x', -100, 'MXN', current_date, 'cash-rpc-no-payout-1');
SQL

expect_success "record_cash_event posts a fresh invoice via the RPC (invoice is not base-contributing for the SETY rule, so this stays a clean happy-path test regardless of approval state elsewhere in the script)" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'invoice', 'Factura adicional de prueba', 5000, 'MXN', current_date, 'cash-rpc-1');
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
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'invoice', 'Factura adicional de prueba', 5000, 'MXN', current_date, 'cash-rpc-1');
SQL

CASH_AUDIT_1_AFTER_REPLAY="$(query_scalar "select count(*) from public.audit_events where action = 'record_cash_event' and target_id = '$CASH_EVENT_1';")"
if [ "$CASH_AUDIT_1_AFTER_REPLAY" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: a pure idempotent cash-event replay wrote no additional audit event"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: record_cash_event replay"); echo "FAIL: audit count changed to $CASH_AUDIT_1_AFTER_REPLAY after replay"
fi

expect_failure "record_cash_event rejects the same key reused with a different amount" "already used for a different" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'invoice', 'Factura adicional de prueba', 9999, 'MXN', current_date, 'cash-rpc-1');
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

expect_failure "record_payout rejects an allocation that would overpay the closer line" "must fall within" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Pago RPC exceso', current_date, '[{"settlementLineId":"$CLOSER_LINE_O1","amountCentavos":79455}]'::jsonb, 'payout-rpc-closer-overpay-1');
SQL

# Superseded by R2, same as scenario 4's equivalent test: house and closer
# are both active, unreversed lines here, so a transfer between them is not
# doctrine-valid (only reversed-to-active is — see scenario 17/B3). This
# used to assert the transfer as a success; it now asserts the rejection,
# and every downstream total below reflects nothing having moved.
expect_failure "AT-R2: record_payout refuses a same-event transfer between two active (unreversed) lines" \
  "a negative allocation may only leave a reversed settlement's line" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Transferencia RPC', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":-50000},{"settlementLineId":"$CLOSER_LINE_O1","amountCentavos":50000}]'::jsonb, 'payout-rpc-transfer-1', '$HOUSE_PAYOUT_EVENT'::uuid);
SQL

HOUSE_LINE_TOTAL_2="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$HOUSE_LINE_O1';")"
CLOSER_LINE_TOTAL_2="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$CLOSER_LINE_O1';")"
HOUSE_EVENT_TOTAL="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where payout_cash_event_id = '$HOUSE_PAYOUT_EVENT';")"

if [ "$HOUSE_LINE_TOTAL_2" = "269181" ] && [ "$CLOSER_LINE_TOTAL_2" = "100000" ] && [ "$HOUSE_EVENT_TOTAL" = "269181" ]; then
  PASS=$((PASS + 1)); echo "PASS: the rejected transfer moved nothing — house remains 269181, closer remains 100000, house event total unchanged (269181)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("record_payout: rejected transfer moved nothing"); echo "FAIL: house=$HOUSE_LINE_TOTAL_2 closer=$CLOSER_LINE_TOTAL_2 event=$HOUSE_EVENT_TOTAL"
fi

PAYOUT_AUDIT_COUNT="$(query_scalar "select count(*) from public.audit_events where action = 'record_payout' and target_id = '$HOUSE_PAYOUT_EVENT';")"
if [ "$PAYOUT_AUDIT_COUNT" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: the rejected transfer wrote no audit event (only the original full payout did)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("audit atomicity: record_payout"); echo "FAIL: expected 1 audit event for this event, got $PAYOUT_AUDIT_COUNT"
fi

expect_success "identical replay of record_payout's full house payout returns the same event, no new rows" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Pago RPC casa', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":269181}]'::jsonb, 'payout-rpc-house-1');
SQL

HOUSE_LINE_TOTAL_AFTER_REPLAY="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$HOUSE_LINE_O1';")"
if [ "$HOUSE_LINE_TOTAL_AFTER_REPLAY" = "269181" ]; then
  PASS=$((PASS + 1)); echo "PASS: replaying record_payout did not insert any additional allocation"
else
  FAIL=$((FAIL + 1)); FAILURES+=("record_payout replay: no duplicate rows"); echo "FAIL: house line total changed to $HOUSE_LINE_TOTAL_AFTER_REPLAY after replay"
fi

expect_failure "record_payout rejects the same key reused with a different amount" "already used for a different" <<SQL
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

expect_failure "approve_settlement rejects reusing a key already tied to a reversal on the same opportunity" "already used for a different" <<SQL
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

expect_failure "reverse_settlement rejects the same key reused for a different corrects_settlement_id on the same opportunity" "already used for a different" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '$SETTLEMENT_O2', 'reverse-key-1');
SQL

echo
echo "=== scenario 13: record_cash_event — currency/cancelled/base-drift guards (H3, M4, M6) ==="

expect_failure "record_cash_event rejects a currency other than the opportunity's rule currency" "does not match this opportunity" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'Depósito en USD', 100, 'USD', current_date, 'cash-rpc-wrong-currency-1');
SQL

expect_failure "record_cash_event rejects a base-contributing event once an active approved original exists (base-drift guard)" "already has an active approved settlement" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'deposit', 'Depósito tardío post-aprobación', 100, 'MXN', current_date, 'cash-rpc-post-approval-drift-1');
SQL

expect_success "record_cash_event still accepts a non-base-contributing type after approval (withholding is a real type outside includeTypes=[deposit])" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'withholding', 'Retención post-aprobación', -1, 'MXN', current_date, 'cash-rpc-post-approval-nonbase-1');
SQL

expect_success "set up a fresh cancelled opportunity under org 1 for the cancelled-status guards" <<'SQL'
insert into public.opportunities (id, project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at)
select 'f0000000-0000-4000-8000-0000000000c1', project_id, service_version_id, allocation_rule_version_id, 'CANCELLED-OPP', beneficiary_name, beneficiary_location, 'cancelled', now()
from public.opportunities where id = 'f0000000-0000-4000-8000-000000000001';
SQL

expect_failure "record_cash_event rejects a cancelled opportunity" "is cancelled" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000c1', 'deposit', 'x', 100, 'MXN', current_date, 'cash-rpc-cancelled-1');
SQL

expect_failure "approve_settlement rejects a cancelled opportunity" "is cancelled" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000c1', 'approve-cancelled-1');
SQL

echo
echo "=== scenario 14: record_payout JSON shape and duplicate-line validation (L4, L5) ==="

expect_failure "record_payout rejects a duplicate settlementLineId within one batch" "duplicate settlementLineId" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":1},{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":1}]'::jsonb, 'payout-dup-line-1');
SQL

expect_failure "record_payout rejects an allocation missing amountCentavos" "must have exactly settlementLineId and amountCentavos" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1"}]'::jsonb, 'payout-missing-field-1');
SQL

expect_failure "record_payout rejects a non-numeric amountCentavos" "must be a number" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":"lots"}]'::jsonb, 'payout-non-numeric-1');
SQL

expect_failure "record_payout rejects a non-UUID settlementLineId" "not a valid UUID" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"not-a-uuid","amountCentavos":1}]'::jsonb, 'payout-bad-uuid-1');
SQL

expect_failure "record_payout rejects a negative allocation in fresh-payout mode" "may only carry positive allocations" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'x', current_date, '[{"settlementLineId":"$HOUSE_LINE_O1","amountCentavos":-1}]'::jsonb, 'payout-negative-fresh-1');
SQL

echo
echo "=== scenario 15 (B1): distinct-key concurrent approvals must never produce two active originals ==="

expect_success "set up a fresh, never-approved opportunity for the distinct-key approval race" <<'SQL'
insert into public.opportunities (id, project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at)
select 'f0000000-0000-4000-8000-0000000000b1', project_id, service_version_id, allocation_rule_version_id, 'B1-RACE-OPP', beneficiary_name, beneficiary_location, 'in_delivery', now()
from public.opportunities where id = 'f0000000-0000-4000-8000-000000000001';
insert into public.assignments (opportunity_id, member_id, role_key, role_label, weight_bp, status)
select 'f0000000-0000-4000-8000-0000000000b1', member_id, role_key, role_label, weight_bp, status
from public.assignments where opportunity_id = 'f0000000-0000-4000-8000-000000000001';
insert into public.cash_events (opportunity_id, type, label, amount_centavos, currency, occurred_at, idempotency_key)
values ('f0000000-0000-4000-8000-0000000000b1', 'deposit', 'B1 race base', 100000, 'MXN', current_date, 'db-verify-b1-base');
SQL

for run in 1 2 3 4 5 6 7 8 9 10; do
  DISTINCT_KEY_DIR="$WORKDIR/concurrent_distinct_approve_$run"
  mkdir -p "$DISTINCT_KEY_DIR"
  declare -a DKPIDS=()
  for i in $(seq 1 20); do
    (
      psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA -c \
        "set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; select settlement_id from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000b1', 'b1-race-key-$run-$i');" \
        > "$DISTINCT_KEY_DIR/out_$i.txt" 2> "$DISTINCT_KEY_DIR/err_$i.txt"
    ) &
    DKPIDS+=($!)
  done
  for pid in "${DKPIDS[@]}"; do wait "$pid"; done

  ACTIVE_ORIGINALS="$(query_scalar "
    select count(*) from public.settlements s
    where s.opportunity_id = 'f0000000-0000-4000-8000-0000000000b1' and s.kind = 'original' and s.status = 'approved'
      and not exists (select 1 from public.settlements r where r.corrects_settlement_id = s.id and r.kind = 'reversal' and r.status = 'approved');
  ")"
  DK_UNEXPECTED_ERRORS="$(grep -L "already has an active approved settlement" "$DISTINCT_KEY_DIR"/err_*.txt 2>/dev/null | xargs -I{} grep -l "ERROR" {} 2>/dev/null | wc -l | tr -d ' ')"

  if [ "$ACTIVE_ORIGINALS" = "1" ] && [ "$DK_UNEXPECTED_ERRORS" = "0" ]; then
    PASS=$((PASS + 1)); echo "PASS (run $run/10): 20 concurrent DISTINCT-key approvals produced exactly one active original, and every rejection was the intended 'already has an active approved settlement' error"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("B1 distinct-key concurrent approval run $run")
    echo "FAIL (run $run/10): active originals=$ACTIVE_ORIGINALS (want 1), unexpected errors=$DK_UNEXPECTED_ERRORS (want 0)"
    grep -h "ERROR" "$DISTINCT_KEY_DIR"/err_*.txt 2>/dev/null | sort -u | sed 's/^/    /'
  fi

  # Clean the slate for the next run: reverse the surviving original so the
  # next iteration starts from zero active originals again, exactly like the
  # first iteration did.
  SURVIVOR="$(query_scalar "
    select s.id from public.settlements s
    where s.opportunity_id = 'f0000000-0000-4000-8000-0000000000b1' and s.kind = 'original' and s.status = 'approved'
      and not exists (select 1 from public.settlements r where r.corrects_settlement_id = s.id and r.kind = 'reversal' and r.status = 'approved')
    limit 1;
  ")"
  if [ -n "$SURVIVOR" ]; then
    psql_run -c "set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', '$SURVIVOR', 'b1-race-cleanup-$run');" >/dev/null 2>&1
  fi
done

echo
echo "=== scenario 16 (B2): concurrent record_payout calls must never overpay a line ==="

# settlement_line_payouts is append-only (forbid_mutation blocks DELETE/
# UPDATE, by design — it's a financial ledger). So each of the 10 stress
# rounds below gets its OWN fresh, never-paid line rather than resetting one
# line between rounds — there is no such thing as "resetting" an append-only
# table, and there shouldn't be.
expect_success "set up one settlement with 10 fresh lines, one per overpay-race round" <<'SQL'
begin;
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('b2000000-0000-4000-8000-0000000000b2', 'f0000000-0000-4000-8000-0000000000b1', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 1000000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-b2-original');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('c2000000-0000-4000-8000-b20000000001', 'b2000000-0000-4000-8000-0000000000b2', 'house-1', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 1),
  ('c2000000-0000-4000-8000-b20000000002', 'b2000000-0000-4000-8000-0000000000b2', 'house-2', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 2),
  ('c2000000-0000-4000-8000-b20000000003', 'b2000000-0000-4000-8000-0000000000b2', 'house-3', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 3),
  ('c2000000-0000-4000-8000-b20000000004', 'b2000000-0000-4000-8000-0000000000b2', 'house-4', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 4),
  ('c2000000-0000-4000-8000-b20000000005', 'b2000000-0000-4000-8000-0000000000b2', 'house-5', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 5),
  ('c2000000-0000-4000-8000-b20000000006', 'b2000000-0000-4000-8000-0000000000b2', 'house-6', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 6),
  ('c2000000-0000-4000-8000-b20000000007', 'b2000000-0000-4000-8000-0000000000b2', 'house-7', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 7),
  ('c2000000-0000-4000-8000-b20000000008', 'b2000000-0000-4000-8000-0000000000b2', 'house-8', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 8),
  ('c2000000-0000-4000-8000-b20000000009', 'b2000000-0000-4000-8000-0000000000b2', 'house-9', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 9),
  ('c2000000-0000-4000-8000-b2000000000a', 'b2000000-0000-4000-8000-0000000000b2', 'house-10', 'org_recipient', 'EVEN', null, 'Casa', 1000, 100000, 'MXN', 10);
commit;
SQL

for run in 1 2 3 4 5 6 7 8 9 10; do
  LINE_ID="$(printf 'c2000000-0000-4000-8000-b20000000%03x' "$run")"
  OVERPAY_DIR="$WORKDIR/concurrent_overpay_$run"
  mkdir -p "$OVERPAY_DIR"
  declare -a OPIDS=()
  for i in $(seq 1 10); do
    (
      psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA -c \
        "set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; select cash_event_id from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000b1', 'B2 race', current_date, '[{\"settlementLineId\":\"$LINE_ID\",\"amountCentavos\":100000}]'::jsonb, 'b2-race-key-$run-$i');" \
        > "$OVERPAY_DIR/out_$i.txt" 2> "$OVERPAY_DIR/err_$i.txt"
    ) &
    OPIDS+=($!)
  done
  for pid in "${OPIDS[@]}"; do wait "$pid"; done

  LINE_TOTAL="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$LINE_ID';")"
  SUCCESSES="$(grep -L "ERROR" "$OVERPAY_DIR"/err_*.txt 2>/dev/null | wc -l | tr -d ' ')"

  if [ "$LINE_TOTAL" = "100000" ] && [ "$SUCCESSES" = "1" ]; then
    PASS=$((PASS + 1)); echo "PASS (run $run/10): 10 concurrent full-payout attempts on one line left it at exactly 100000 (never overpaid), exactly one call succeeded"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("B2 concurrent payout overpay run $run")
    echo "FAIL (run $run/10): line total=$LINE_TOTAL (want 100000), successes=$SUCCESSES (want 1)"
    grep -h "ERROR" "$OVERPAY_DIR"/err_*.txt 2>/dev/null | sort -u | sed 's/^/    /'
  fi
done

echo
echo "=== scenario 17 (B3): reversal preserves payout history; new positive payouts to a reversed original are refused; historical transfer to an active replacement succeeds ==="

# Its own opportunity, not opportunity b1: a table-level deferred constraint
# (check_one_unreversed_approved_original) caps unreversed approved
# originals at one per opportunity, and b1 already carries the B2 stress
# settlement above.
expect_success "set up a fresh opportunity + dedicated settlement + line for B3, fully paid" <<'SQL'
begin;
insert into public.opportunities (id, project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at)
select 'f0000000-0000-4000-8000-0000000000b3', project_id, service_version_id, allocation_rule_version_id, 'B3-OPP', beneficiary_name, beneficiary_location, 'in_delivery', now()
from public.opportunities where id = 'f0000000-0000-4000-8000-000000000001';
insert into public.assignments (opportunity_id, member_id, role_key, role_label, weight_bp, status)
select 'f0000000-0000-4000-8000-0000000000b3', member_id, role_key, role_label, weight_bp, status
from public.assignments where opportunity_id = 'f0000000-0000-4000-8000-000000000001';
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values ('b3000000-0000-4000-8000-0000000000b3', 'f0000000-0000-4000-8000-0000000000b3', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-b3-original');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('c3000000-0000-4000-8000-0000000000b3', 'b3000000-0000-4000-8000-0000000000b3', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 100000, 'MXN', 1);
insert into public.cash_events (id, opportunity_id, type, label, amount_centavos, currency, occurred_at, idempotency_key)
values ('a3000000-0000-4000-8000-0000000000b3', 'f0000000-0000-4000-8000-0000000000b3', 'payout', 'B3 full payout', -100000, 'MXN', current_date, 'db-verify-b3-full-payout');
insert into public.settlement_line_payouts (settlement_line_id, payout_cash_event_id, amount_centavos, currency, created_by_member_id, idempotency_key)
values ('c3000000-0000-4000-8000-0000000000b3', 'a3000000-0000-4000-8000-0000000000b3', 100000, 'MXN', 'b0000000-0000-4000-8000-000000000001', 'db-verify-b3-full-payout:0');
commit;
SQL

expect_success "reversing a fully-paid settlement SUCCEEDS without requiring the paid line to net to zero (explicit product decision, not the review's suggested design)" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-0000000000b3', 'b3-reversal-key');
SQL

B3_OUTSTANDING="$(query_scalar "set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; select outstanding_payout_centavos from public.reverse_settlement('a0000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-0000000000b3', 'b3-reversal-key');" | tail -n1)"
if [ "$B3_OUTSTANDING" = "100000" ]; then
  PASS=$((PASS + 1)); echo "PASS: reverse_settlement reports the outstanding (not-yet-reallocated) payout amount as 100000"
else
  FAIL=$((FAIL + 1)); FAILURES+=("B3 outstanding_payout_centavos reporting"); echo "FAIL: expected outstanding_payout_centavos 100000, got $B3_OUTSTANDING"
fi

expect_failure "a brand-new positive payout against the now-reversed original's line is refused" "reversed settlement" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000b3', 'Intento de pago fresco a línea revertida', current_date, '[{"settlementLineId":"c3000000-0000-4000-8000-0000000000b3","amountCentavos":1}]'::jsonb, 'b3-fresh-payout-to-reversed-1');
SQL

expect_success "give the replacement opportunity a distributable base, so its house line has room to receive the transferred amount" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_cash_event('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000b3', 'deposit', 'Depósito para el reemplazo', 1000000, 'MXN', current_date, 'b3-replacement-deposit');
SQL

expect_success "approve a replacement original on the same opportunity so the stranded payout has somewhere active to land" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.approve_settlement('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000b3', 'b3-replacement-approval');
SQL

REPLACEMENT_HOUSE_LINE="$(query_scalar "
  select sl.id from public.settlement_lines sl
  join public.settlements s on s.id = sl.settlement_id
  where s.opportunity_id = 'f0000000-0000-4000-8000-0000000000b3' and s.idempotency_key = 'b3-replacement-approval' and sl.share_key = 'house';
")"

# A batch that pulls the full stranded amount off the reversed line but only
# credits part of it to the replacement is not just "unmatched" — it also
# fails to net to zero, so the pre-existing existing-event-mode invariant
# (unchanged from before this repair) is what actually fires here. An
# unmatched-but-still-net-zero batch is only constructible by also moving
# money off an *active* line uncounted by the pairing check, which the
# existing 0..line_amount payout bound makes impractical to set up from a
# fresh replacement line — so the pairing invariant is exercised indirectly:
# for any two-line reversed-to-active transfer, "nets to zero" and "equal
# pairing" are the same arithmetic fact.
expect_failure "a reallocation that pulls the full stranded amount off the reversed line but only partially credits the replacement fails net-zero validation" "must net to zero" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000b3', 'Transferencia desbalanceada', current_date, '[{"settlementLineId":"c3000000-0000-4000-8000-0000000000b3","amountCentavos":-100000},{"settlementLineId":"$REPLACEMENT_HOUSE_LINE","amountCentavos":40000}]'::jsonb, 'b3-unbalanced-transfer', 'a3000000-0000-4000-8000-0000000000b3'::uuid);
SQL

expect_success "the matched historical transfer succeeds: -100000 off the reversed line, +100000 onto the active replacement line" <<SQL
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.record_payout('a0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000b3', 'Transferencia a reemplazo', current_date, '[{"settlementLineId":"c3000000-0000-4000-8000-0000000000b3","amountCentavos":-100000},{"settlementLineId":"$REPLACEMENT_HOUSE_LINE","amountCentavos":100000}]'::jsonb, 'b3-matched-transfer', 'a3000000-0000-4000-8000-0000000000b3'::uuid);
SQL

REVERSED_LINE_TOTAL_AFTER="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = 'c3000000-0000-4000-8000-0000000000b3';")"
REPLACEMENT_LINE_TOTAL_AFTER="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = '$REPLACEMENT_HOUSE_LINE';")"
if [ "$REVERSED_LINE_TOTAL_AFTER" = "0" ] && [ "$REPLACEMENT_LINE_TOTAL_AFTER" = "100000" ]; then
  PASS=$((PASS + 1)); echo "PASS: historical transfer left the reversed line at net 0 and the active replacement line at 100000"
else
  FAIL=$((FAIL + 1)); FAILURES+=("B3 historical transfer net amounts"); echo "FAIL: reversed line=$REVERSED_LINE_TOTAL_AFTER (want 0), replacement line=$REPLACEMENT_LINE_TOTAL_AFTER (want 100000)"
fi

echo
echo "=== scenario 18 (AT-R1): a base-contributing cash event racing an approval must never drift ==="
echo "Forces the interleaving with a harness-only BEFORE INSERT pause trigger on cash_events —"
echo "not the external FIFO the review's own draft used, which never actually paused execution"
echo "inside record_cash_event after its guard. This does: the pause fires from within"
echo "record_cash_event's own INSERT statement, after its drift guard has already run."

psql_run <<'SQL'
create or replace function public.at_r1_pause_before_insert()
returns trigger
language plpgsql
as $$
begin
  -- Only this test's own rows pause — never a seed insert, a fixture load,
  -- or any other scenario's cash event.
  if new.idempotency_key like 'at-r1-cash-%' then
    perform pg_sleep(2);
  end if;
  return new;
end;
$$;

create trigger at_r1_pause
  before insert on public.cash_events
  for each row execute function public.at_r1_pause_before_insert();
SQL

# Ten fresh opportunities, one per round, each with a snapshotted rule and a
# balanced pool copied from opportunity 1 — never approved going in, so each
# round starts from the same "no active settlement yet" state the drift
# guard actually has to get right.
for round in 1 2 3 4 5 6 7 8 9 10; do
  OPP="$(printf 'f0000000-0000-4000-8000-a1000000%04d' "$round")"
  psql_run <<SQL
begin;
insert into public.opportunities (id, project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at)
select '$OPP', project_id, service_version_id, allocation_rule_version_id, 'AT-R1-$round', beneficiary_name, beneficiary_location, 'in_delivery', now()
from public.opportunities where id = 'f0000000-0000-4000-8000-000000000001';
insert into public.assignments (opportunity_id, member_id, role_key, role_label, weight_bp, status)
select '$OPP', member_id, role_key, role_label, weight_bp, status
from public.assignments where opportunity_id = 'f0000000-0000-4000-8000-000000000001';
commit;
SQL

  # Session A: holds the opportunity lock (post-fix) or nothing at all
  # (pre-fix) from just after its drift guard, through the harness's forced
  # 2-second pause inside its own INSERT, until it commits.
  ( psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA \
      -c "set role authenticated;
          set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
          select cash_event_id from public.record_cash_event(
            'a0000000-0000-4000-8000-000000000001', '$OPP',
            'deposit', 'AT-R1 racing deposit', 500000, 'MXN', current_date, 'at-r1-cash-$round');" \
      >"$WORKDIR/at_r1_a_$round.log" 2>&1 ) &
  APID=$!

  # Session B: fires ~1s in, once A has cleared its own auth/ownership
  # checks and (post-fix) acquired the opportunity lock, but while A is
  # still inside its paused INSERT.
  sleep 1
  psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA \
    -c "set role authenticated;
        set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
        select settlement_id from public.approve_settlement(
          'a0000000-0000-4000-8000-000000000001', '$OPP', 'at-r1-approve-$round');" \
    >"$WORKDIR/at_r1_b_$round.log" 2>&1
  wait $APID

  DRIFT="$(query_scalar "
    select (s.base_centavos <> coalesce((
        select sum(c.amount_centavos) from public.cash_events c
         join public.opportunities o on o.id = c.opportunity_id
         join public.allocation_rule_versions arv on arv.id = o.allocation_rule_version_id
         where c.opportunity_id = '$OPP'
           and c.type in (select jsonb_array_elements_text(arv.base_policy -> 'includeTypes'))
      ), 0))
    from public.settlements s
    where s.opportunity_id = '$OPP' and s.kind = 'original' and s.status = 'approved';
  ")"

  if [ "$DRIFT" = "f" ]; then
    PASS=$((PASS + 1)); echo "PASS (round $round/10): approved base still equals the ledger's base-contributing total"
  else
    FAIL=$((FAIL + 1)); FAILURES+=("AT-R1 round $round")
    echo "FAIL (round $round/10): approved base drifted from the ledger"
    cat "$WORKDIR/at_r1_a_$round.log" "$WORKDIR/at_r1_b_$round.log" | sed 's/^/    /'
  fi
done

psql_run <<'SQL'
drop trigger at_r1_pause on public.cash_events;
drop function public.at_r1_pause_before_insert();
SQL

echo
echo "=== scenario 19 (AT-R3): same org, same idempotency key, two different opportunities, concurrent — no raw uniqueness failure ==="

expect_success "set up two fresh opportunities in the same org, each with one approved settlement + line" <<'SQL'
begin;
insert into public.opportunities (id, project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at)
select 'f0000000-0000-4000-8000-0000000000d1', project_id, service_version_id, allocation_rule_version_id, 'AT-R3-1', beneficiary_name, beneficiary_location, 'in_delivery', now()
from public.opportunities where id = 'f0000000-0000-4000-8000-000000000001';
insert into public.opportunities (id, project_id, service_version_id, allocation_rule_version_id, code, beneficiary_name, beneficiary_location, status, opened_at)
select 'f0000000-0000-4000-8000-0000000000d2', project_id, service_version_id, allocation_rule_version_id, 'AT-R3-2', beneficiary_name, beneficiary_location, 'in_delivery', now()
from public.opportunities where id = 'f0000000-0000-4000-8000-000000000001';
insert into public.settlements (id, opportunity_id, allocation_rule_version_id, status, kind, corrects_settlement_id, base_centavos, currency, approved_at, approved_by_member_id, idempotency_key)
values
  ('b4000000-0000-4000-8000-0000000000d1', 'f0000000-0000-4000-8000-0000000000d1', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-at-r3-original-1'),
  ('b4000000-0000-4000-8000-0000000000d2', 'f0000000-0000-4000-8000-0000000000d2', 'e0000000-0000-4000-8000-000000000001', 'approved', 'original', null, 100000, 'MXN', now(), 'b0000000-0000-4000-8000-000000000001', 'db-verify-at-r3-original-2');
insert into public.settlement_lines (id, settlement_id, share_key, recipient_behavior, recipient_label, member_id, role_label, weight_bp, amount_centavos, currency, sequence) values
  ('c4000000-0000-4000-8000-0000000000d1', 'b4000000-0000-4000-8000-0000000000d1', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 100000, 'MXN', 1),
  ('c4000000-0000-4000-8000-0000000000d2', 'b4000000-0000-4000-8000-0000000000d2', 'house', 'org_recipient', 'EVEN', null, 'Casa', 10000, 100000, 'MXN', 1);
commit;
SQL

AT_R3_DIR="$WORKDIR/at_r3"
mkdir -p "$AT_R3_DIR"
declare -a R3PIDS=()
for i in 1 2; do
  LINE_VAR="c4000000-0000-4000-8000-0000000000d$i"
  OPP_VAR="f0000000-0000-4000-8000-0000000000d$i"
  (
    psql -h "$WORKDIR" -p "$PGPORT" -U postgres -d postgres -tA \
      -c "set role authenticated;
          set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
          select cash_event_id from public.record_payout(
            'a0000000-0000-4000-8000-000000000001', '$OPP_VAR',
            'AT-R3 payout', current_date,
            '[{\"settlementLineId\":\"$LINE_VAR\",\"amountCentavos\":1000}]'::jsonb,
            'at-r3-shared-key');" \
      >"$AT_R3_DIR/out_$i.txt" 2>"$AT_R3_DIR/err_$i.txt"
  ) &
  R3PIDS+=($!)
done
for pid in "${R3PIDS[@]}"; do wait "$pid"; done

AT_R3_RAW_UNIQUENESS="$(grep -l "duplicate key value violates unique constraint" "$AT_R3_DIR"/err_*.txt 2>/dev/null | wc -l | tr -d ' ')"
AT_R3_LINE1_TOTAL="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = 'c4000000-0000-4000-8000-0000000000d1';")"
AT_R3_LINE2_TOTAL="$(query_scalar "select coalesce(sum(amount_centavos),0) from public.settlement_line_payouts where settlement_line_id = 'c4000000-0000-4000-8000-0000000000d2';")"

if [ "$AT_R3_RAW_UNIQUENESS" = "0" ]; then
  PASS=$((PASS + 1)); echo "PASS: no caller received a raw unique-constraint error"
else
  FAIL=$((FAIL + 1)); FAILURES+=("AT-R3: raw uniqueness failure leaked")
  echo "FAIL: a caller received a raw unique-constraint error"
  cat "$AT_R3_DIR"/err_*.txt | sed 's/^/    /'
fi

if [ "$AT_R3_LINE1_TOTAL" = "1000" ] && [ "$AT_R3_LINE2_TOTAL" = "1000" ]; then
  PASS=$((PASS + 1)); echo "PASS: both independent commands succeeded — same org, same key, different opportunities do not collide"
else
  FAIL=$((FAIL + 1)); FAILURES+=("AT-R3: both commands should have succeeded independently")
  echo "FAIL: line1=$AT_R3_LINE1_TOTAL (want 1000), line2=$AT_R3_LINE2_TOTAL (want 1000)"
fi

echo
echo "=== scenario 20 (M2 Auth): redeem_invite() DB-level evidence ==="
echo "Findings repaired: .context/architecture-council/m2-auth-adversarial-review.md (H2, H3, M1, M5)."

expect_success "set up fresh, never-authenticated members with pending invites for redeem_invite() scenarios" <<'SQL'
begin;
insert into public.members (id, org_id, slug, display_name, initials, role) values
  ('b0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000001', 'invite-pending-test', 'Invite Pending Test', 'IP', 'member'),
  ('b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000001', 'invite-expired-test', 'Invite Expired Test', 'IE', 'member'),
  ('b0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000001', 'invite-mixedcase-test', 'Invite Mixedcase Test', 'IM', 'member'),
  ('b0000000-0000-4000-8000-000000000023', 'a0000000-0000-4000-8000-000000000001', 'invite-concurrent-test', 'Invite Concurrent Test', 'IC', 'member');
insert into public.memberships (org_id, member_id, status) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000020', 'invited'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000021', 'invited'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000022', 'invited'),
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000023', 'invited');
insert into public.member_invites (member_id, email, expires_at) values
  ('b0000000-0000-4000-8000-000000000020', 'invite-pending@test.local', now() + interval '14 days'),
  ('b0000000-0000-4000-8000-000000000021', 'invite-expired@test.local', now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000022', 'Invite-MixedCase@Test.Local', now() + interval '14 days'),
  ('b0000000-0000-4000-8000-000000000023', 'invite-concurrent@test.local', now() + interval '14 days');
insert into auth.users (id, email) values
  ('55555555-5555-4555-8555-000000000020', 'invite-pending@test.local'),
  ('66666666-6666-4666-8666-000000000021', 'invite-expired@test.local'),
  ('77777777-7777-4777-8777-000000000022', 'invite-mixedcase@test.local'),
  ('88888888-8888-4888-8888-000000000023', 'invite-concurrent@test.local');
commit;
SQL

expect_failure "redeem_invite requires an authenticated session" \
  "redeem_invite requires an authenticated session" <<'SQL'
set role authenticated;
select public.redeem_invite();
SQL

REDEEM_UNAVAILABLE_STATE="$(query_scalar "
  set role authenticated;
  set request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';
  select state from public.redeem_invite();
" | tail -n1)"
if [ "$REDEEM_UNAVAILABLE_STATE" = "unavailable" ]; then
  PASS=$((PASS + 1)); echo "PASS: an authenticated caller with no matching invite gets 'unavailable'"
else
  FAIL=$((FAIL + 1)); FAILURES+=("redeem_invite: no invite -> unavailable")
  echo "FAIL: expected 'unavailable', got '$REDEEM_UNAVAILABLE_STATE'"
fi

NOINVITE_LINKED_ROWS="$(query_scalar "select count(*) from public.members where auth_user_id = '99999999-9999-4999-8999-999999999999';")"
if [ "$NOINVITE_LINKED_ROWS" = "0" ]; then
  PASS=$((PASS + 1)); echo "PASS: an uninvited caller creates or links no member row"
else
  FAIL=$((FAIL + 1)); FAILURES+=("redeem_invite: uninvited caller linked a row")
  echo "FAIL: expected 0 linked rows, got $NOINVITE_LINKED_ROWS"
fi

expect_success "a valid pending invite redeems successfully" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '55555555-5555-4555-8555-000000000020';
select * from public.redeem_invite();
SQL

PENDING_LINK_CHECK="$(query_scalar "
  select (m.auth_user_id = '55555555-5555-4555-8555-000000000020' and ms.status = 'active' and ms.activated_at is not null)
  from public.members m
  join public.memberships ms on ms.member_id = m.id
  where m.id = 'b0000000-0000-4000-8000-000000000020';
")"
if [ "$PENDING_LINK_CHECK" = "t" ]; then
  PASS=$((PASS + 1)); echo "PASS: redemption linked auth_user_id and activated the membership exactly as promised"
else
  FAIL=$((FAIL + 1)); FAILURES+=("redeem_invite: pending invite did not link/activate")
  echo "FAIL: expected linked+active, got '$PENDING_LINK_CHECK'"
fi

PENDING_REDEEMED_AT_SET="$(query_scalar "select redeemed_at is not null from public.member_invites where member_id = 'b0000000-0000-4000-8000-000000000020';")"
PENDING_AUDIT_COUNT_1="$(query_scalar "select count(*) from public.audit_events where action = 'redeem_invite' and target_id = (select id from public.member_invites where member_id = 'b0000000-0000-4000-8000-000000000020');")"
if [ "$PENDING_REDEEMED_AT_SET" = "t" ] && [ "$PENDING_AUDIT_COUNT_1" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: redeemed_at set and exactly one audit_events row for the real redemption"
else
  FAIL=$((FAIL + 1)); FAILURES+=("redeem_invite: redeemed_at/audit atomicity")
  echo "FAIL: redeemed_at_set=$PENDING_REDEEMED_AT_SET (want t), audit_count=$PENDING_AUDIT_COUNT_1 (want 1)"
fi

REDEEM_REPLAY_STATE="$(query_scalar "
  set role authenticated;
  set request.jwt.claim.sub = '55555555-5555-4555-8555-000000000020';
  select state from public.redeem_invite();
" | tail -n1)"
PENDING_AUDIT_COUNT_2="$(query_scalar "select count(*) from public.audit_events where action = 'redeem_invite' and target_id = (select id from public.member_invites where member_id = 'b0000000-0000-4000-8000-000000000020');")"
if [ "$REDEEM_REPLAY_STATE" = "redeemed" ] && [ "$PENDING_AUDIT_COUNT_2" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: a repeat call after redemption reports 'redeemed' and writes no additional audit row"
else
  FAIL=$((FAIL + 1)); FAILURES+=("redeem_invite: replay after redemption")
  echo "FAIL: state=$REDEEM_REPLAY_STATE (want redeemed), audit_count=$PENDING_AUDIT_COUNT_2 (want 1)"
fi

expect_success "an expired invite does not redeem" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '66666666-6666-4666-8666-000000000021';
select * from public.redeem_invite();
SQL

EXPIRED_STATE="$(query_scalar "
  set role authenticated;
  set request.jwt.claim.sub = '66666666-6666-4666-8666-000000000021';
  select state from public.redeem_invite();
" | tail -n1)"
EXPIRED_STILL_UNLINKED="$(query_scalar "
  select (m.auth_user_id is null and ms.status = 'invited')
  from public.members m
  join public.memberships ms on ms.member_id = m.id
  where m.id = 'b0000000-0000-4000-8000-000000000021';
")"
if [ "$EXPIRED_STATE" = "expired" ] && [ "$EXPIRED_STILL_UNLINKED" = "t" ]; then
  PASS=$((PASS + 1)); echo "PASS: an expired invite reports 'expired' and never links or activates anything"
else
  FAIL=$((FAIL + 1)); FAILURES+=("redeem_invite: expired invite")
  echo "FAIL: state=$EXPIRED_STATE (want expired), still_unlinked=$EXPIRED_STILL_UNLINKED (want t)"
fi

expect_success "M1: an invite entered with different capitalization still redeems against Supabase's lowercased auth.users email" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '77777777-7777-4777-8777-000000000022';
select * from public.redeem_invite();
SQL

MIXEDCASE_LINKED="$(query_scalar "select auth_user_id = '77777777-7777-4777-8777-000000000022' from public.members where id = 'b0000000-0000-4000-8000-000000000022';")"
if [ "$MIXEDCASE_LINKED" = "t" ]; then
  PASS=$((PASS + 1)); echo "PASS: 'Invite-MixedCase@Test.Local' matched the lowercased auth.users email and redeemed"
else
  FAIL=$((FAIL + 1)); FAILURES+=("redeem_invite: M1 case-insensitive match")
  echo "FAIL: expected the mixed-case invite to link, got linked=$MIXEDCASE_LINKED"
fi

REVOKED_STATE="$(query_scalar "
  set role authenticated;
  set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
  select state from public.redeem_invite();
" | tail -n1)"
REVOKED_IDS_NULL="$(query_scalar "
  set role authenticated;
  set request.jwt.claim.sub = '44444444-4444-4444-8444-444444444444';
  select (member_id is null and org_id is null) from public.redeem_invite();
" | tail -n1)"
if [ "$REVOKED_STATE" = "revoked" ] && [ "$REVOKED_IDS_NULL" = "t" ]; then
  PASS=$((PASS + 1)); echo "PASS (AT-H2): a linked-but-revoked membership reports 'revoked' with null member_id/org_id, never 'redeemed'"
else
  FAIL=$((FAIL + 1)); FAILURES+=("AT-H2: revoked membership must not report redeemed")
  echo "FAIL: state=$REVOKED_STATE (want revoked), ids_null=$REVOKED_IDS_NULL (want t)"
fi

echo
echo "=== scenario 20a (M2 Auth, M-A): the concurrent-fallback branch must not answer 'redeemed' when the membership row itself no longer exists ==="
echo "A privileged delete (no policy exposes this — ops/service-role only), not a revoke, is what reaches this branch specifically."

expect_success "prepare: a member linked and redeemed, then its membership row deleted by a privileged operation (not revoked — removed outright)" <<'SQL'
begin;
insert into public.members (id, org_id, slug, display_name, initials, role) values
  ('b0000000-0000-4000-8000-000000000024', 'a0000000-0000-4000-8000-000000000001', 'invite-deleted-membership-test', 'Invite Deleted Membership Test', 'DM', 'member');
insert into public.memberships (org_id, member_id, status) values
  ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000024', 'invited');
insert into public.member_invites (member_id, email, expires_at) values
  ('b0000000-0000-4000-8000-000000000024', 'invite-deleted-membership@test.local', now() + interval '14 days');
insert into auth.users (id, email) values
  ('66666666-6666-4666-8666-000000000024', 'invite-deleted-membership@test.local');
update public.members set auth_user_id = '66666666-6666-4666-8666-000000000024'
 where id = 'b0000000-0000-4000-8000-000000000024';
update public.member_invites set redeemed_at = now()
 where member_id = 'b0000000-0000-4000-8000-000000000024';
delete from public.memberships where member_id = 'b0000000-0000-4000-8000-000000000024';
commit;
SQL

MA_STATE="$(query_scalar "
  set role authenticated;
  set request.jwt.claim.sub = '66666666-6666-4666-8666-000000000024';
  select state from public.redeem_invite();
" | tail -n1)"
MA_IDS_NULL="$(query_scalar "
  set role authenticated;
  set request.jwt.claim.sub = '66666666-6666-4666-8666-000000000024';
  select (member_id is null and org_id is null) from public.redeem_invite();
" | tail -n1)"
MA_AUDIT_COUNT="$(query_scalar "select count(*) from public.audit_events where action = 'redeem_invite' and target_id = (select id from public.member_invites where member_id = 'b0000000-0000-4000-8000-000000000024');")"

if [ "$MA_STATE" != "redeemed" ] && [ "$MA_STATE" != "invited" ] && [ "$MA_IDS_NULL" = "t" ] && [ "$MA_AUDIT_COUNT" = "0" ]; then
  PASS=$((PASS + 1))
  echo "PASS (AT-M-A): with the membership row gone, the fallback never reports a privileged state and writes no additional audit row (got state='$MA_STATE')"
else
  FAIL=$((FAIL + 1)); FAILURES+=("AT-M-A: fallback branch answered privileged without an active membership")
  echo "FAIL: state=$MA_STATE (must not be redeemed/invited), ids_null=$MA_IDS_NULL (want t), audit_count=$MA_AUDIT_COUNT (want 0)"
fi

echo
echo "=== scenario 20b (M2 Auth, M5): 20-way concurrent first redemption must not duplicate membership or audit rows ==="
CONCURRENT_REDEEM_DIR="$WORKDIR/concurrent_redeem"
run_concurrent "$CONCURRENT_REDEEM_DIR" 20 "set role authenticated; set request.jwt.claim.sub = '88888888-8888-4888-8888-000000000023'; select state from public.redeem_invite();"

REDEEM_CONCURRENT_ERRORS="$(concurrent_error_count "$CONCURRENT_REDEEM_DIR")"
REDEEM_CONCURRENT_STATES="$(grep -hEo '^(invited|redeemed)$' "$CONCURRENT_REDEEM_DIR"/out_*.txt 2>/dev/null | sort | uniq -c | tr '\n' ' ')"
REDEEM_CONCURRENT_AUDIT_COUNT="$(query_scalar "select count(*) from public.audit_events where action = 'redeem_invite' and target_id = (select id from public.member_invites where member_id = 'b0000000-0000-4000-8000-000000000023');")"
REDEEM_CONCURRENT_MEMBERSHIP_ACTIVATIONS="$(query_scalar "select count(*) from public.memberships where member_id = 'b0000000-0000-4000-8000-000000000023' and status = 'active';")"

if [ "$REDEEM_CONCURRENT_ERRORS" = "0" ] && [ "$REDEEM_CONCURRENT_AUDIT_COUNT" = "1" ] && [ "$REDEEM_CONCURRENT_MEMBERSHIP_ACTIVATIONS" = "1" ]; then
  PASS=$((PASS + 1))
  echo "PASS (AT-M5): 20 concurrent first-redemption calls produced zero errors, exactly one audit_events row, and exactly one active membership (outcomes: $REDEEM_CONCURRENT_STATES)"
else
  FAIL=$((FAIL + 1)); FAILURES+=("AT-M5: concurrent redemption duplicated state")
  echo "FAIL: errors=$REDEEM_CONCURRENT_ERRORS (want 0), audit_count=$REDEEM_CONCURRENT_AUDIT_COUNT (want 1), active_memberships=$REDEEM_CONCURRENT_MEMBERSHIP_ACTIVATIONS (want 1)"
  grep -h "ERROR" "$CONCURRENT_REDEEM_DIR"/err_*.txt 2>/dev/null | sort -u | sed 's/^/    /'
fi

echo
echo "=== scenario 21: founder-usable V1 manual contract setup ==="

expect_success "manual setup: founder creates exactly one complete contract setup and no ledger/settlement/stat/XP rows" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
declare
  created record;
begin
  select * into created from public.create_manual_contract_setup(
    'a0000000-0000-4000-8000-000000000001',
    'Cliente V1',
    'Contrato Manual V1',
    'Servicio fundador V1 con alcance escrito por el fundador.',
    123456,
    'MXN',
    3000,
    jsonb_build_array(
      jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Cierre y entrega', 'weightBp', 10000)
    ),
    'db-verify-manual-v1'
  );

  if created.replayed is distinct from false
    or (select count(*) from public.projects p where p.id = created.project_id and p.status = 'active' and p.sponsor_name = 'Cliente V1') <> 1
    or (select count(*) from public.service_versions sv where sv.project_id = created.project_id) <> 1
    or (select count(*) from public.allocation_rule_versions arv where arv.project_id = created.project_id) <> 1
    or (select count(*) from public.allocation_shares ash join public.allocation_rule_versions arv on arv.id = ash.rule_version_id where arv.project_id = created.project_id) <> 2
    or (select coalesce(sum(weight_bp), 0) from public.allocation_shares ash join public.allocation_rule_versions arv on arv.id = ash.rule_version_id where arv.project_id = created.project_id) <> 10000
    or (select count(*) from public.opportunities o where o.id = created.opportunity_id and o.status = 'assigned') <> 1
    or (select count(*) from public.assignments a where a.opportunity_id = created.opportunity_id and a.status = 'approved' and a.weight_bp = 10000) <> 1
    or (select count(*) from public.opportunity_projection_versions opv where opv.opportunity_id = created.opportunity_id and opv.version = 1 and opv.projected_base_centavos = 123456) <> 1
    or (select count(*) from public.audit_events ae where ae.target_id = created.project_id and ae.action = 'create_manual_contract_setup') <> 1
    or (select count(*) from public.manual_contract_setup_receipts r where r.opportunity_id = created.opportunity_id) <> 1
    or (select count(*) from public.cash_events ce where ce.opportunity_id = created.opportunity_id) <> 0
    or (select count(*) from public.settlements s where s.opportunity_id = created.opportunity_id) <> 0
    or (select count(*) from public.stat_events se where se.opportunity_id = created.opportunity_id) <> 0
  then
    raise exception 'manual setup did not create exactly the expected rows';
  end if;
end;
$$;
SQL

expect_success "manual setup: identical replay returns original ids without extra rows" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

do $$
declare
  project_count_before integer;
  audit_count_before integer;
  replayed record;
begin
  select count(*) into project_count_before from public.projects where sponsor_name = 'Cliente V1';
  select count(*) into audit_count_before from public.audit_events where action = 'create_manual_contract_setup';

  select * into replayed from public.create_manual_contract_setup(
    'a0000000-0000-4000-8000-000000000001',
    'Cliente V1',
    'Contrato Manual V1',
    'Servicio fundador V1 con alcance escrito por el fundador.',
    123456,
    'MXN',
    3000,
    jsonb_build_array(
      jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Cierre y entrega', 'weightBp', 10000)
    ),
    'db-verify-manual-v1'
  );

  if replayed.replayed is distinct from true
    or (select count(*) from public.projects where sponsor_name = 'Cliente V1') <> project_count_before
    or (select count(*) from public.audit_events where action = 'create_manual_contract_setup') <> audit_count_before
  then
    raise exception 'manual setup replay wrote additional rows';
  end if;
end;
$$;
SQL

expect_failure "manual setup: mismatched replay fails deterministically" "already used for a different contract setup request" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001',
  'Cliente V1',
  'Contrato Manual V1 cambiado',
  'Servicio fundador V1 con alcance escrito por el fundador.',
  123456,
  'MXN',
  3000,
  jsonb_build_array(
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Cierre y entrega', 'weightBp', 10000)
  ),
  'db-verify-manual-v1'
);
SQL

expect_failure "manual setup: member cannot create" "founder access required" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001',
  'Cliente miembro',
  'Contrato miembro',
  'Alcance',
  10000,
  'MXN',
  3000,
  jsonb_build_array(
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Entrega', 'weightBp', 10000)
  ),
  'db-verify-member-denied'
);
SQL

expect_failure "manual setup: cross-org assignment member is rejected" "not an active member of org" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001',
  'Cliente cross org',
  'Contrato cross org',
  'Alcance',
  10000,
  'MXN',
  3000,
  jsonb_build_array(
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-0000000000ff', 'roleLabel', 'Entrega', 'weightBp', 10000)
  ),
  'db-verify-cross-org-member'
);
SQL

expect_failure "manual setup: malformed team weights are rejected" "expected exactly 10000" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001',
  'Cliente peso',
  'Contrato peso',
  'Alcance',
  10000,
  'MXN',
  3000,
  jsonb_build_array(
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Entrega', 'weightBp', 9000)
  ),
  'db-verify-bad-weight'
);
SQL

expect_failure "manual setup: duplicate assignment member is rejected" "does not permit the same member twice" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001',
  'Cliente duplicado',
  'Contrato duplicado',
  'Alcance',
  10000,
  'MXN',
  3000,
  jsonb_build_array(
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Entrega 1', 'weightBp', 5000),
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Entrega 2', 'weightBp', 5000)
  ),
  'db-verify-duplicate-member'
);
SQL

expect_failure "manual setup: invalid currency is rejected" "invalid currency" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001',
  'Cliente moneda',
  'Contrato moneda',
  'Alcance',
  10000,
  'mxn',
  3000,
  jsonb_build_array(
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Entrega', 'weightBp', 10000)
  ),
  'db-verify-bad-currency'
);
SQL

expect_failure "manual setup: nonpositive projected amount is rejected" "positive amount" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001',
  'Cliente monto',
  'Contrato monto',
  'Alcance',
  0,
  'MXN',
  3000,
  jsonb_build_array(
    jsonb_build_object('memberId', 'b0000000-0000-4000-8000-000000000003', 'roleLabel', 'Entrega', 'weightBp', 10000)
  ),
  'db-verify-bad-amount'
);
SQL

expect_failure "manual setup: direct browser insert into projection table is unavailable" "violates row-level security policy" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.opportunity_projection_versions (
  org_id, opportunity_id, version, projected_base_centavos, currency, created_by_member_id
) values (
  'a0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000003',
  99,
  10000,
  'MXN',
  'b0000000-0000-4000-8000-000000000001'
);
SQL

expect_failure "manual setup: projection rows are append-only" "append-only" <<'SQL'
update public.opportunity_projection_versions
set projected_base_centavos = 1
where opportunity_id = (
  select opportunity_id from public.manual_contract_setup_receipts
  where idempotency_key = 'db-verify-manual-v1'
);
SQL

echo
echo "=== scenario 22: usable V1 repair — canonical digest, active membership, and member finance privacy ==="

expect_success "manual setup fingerprint accepts the first delimiter-bearing structured request" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001', 'A|B', 'Contrato digest', 'C', 10000, 'MXN', 3000,
  jsonb_build_array(jsonb_build_object('memberId','b0000000-0000-4000-8000-000000000003','roleLabel','Entrega','weightBp',10000)),
  'db-verify-delimiter-key'
);
SQL

expect_failure "manual setup fingerprint does not permit delimiter-collision replay" "already used for a different" <<'SQL'
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select * from public.create_manual_contract_setup(
  'a0000000-0000-4000-8000-000000000001', 'A', 'Contrato digest', 'B|C', 10000, 'MXN', 3000,
  jsonb_build_array(jsonb_build_object('memberId','b0000000-0000-4000-8000-000000000003','roleLabel','Entrega','weightBp',10000)),
  'db-verify-delimiter-key'
);
SQL

MANUAL_CONCURRENT_DIR="$WORKDIR/concurrent_manual_setup"
run_concurrent "$MANUAL_CONCURRENT_DIR" 12 "set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111'; select opportunity_id from public.create_manual_contract_setup('a0000000-0000-4000-8000-000000000001', 'Cliente concurrente', 'Contrato concurrente', 'Alcance', 10000, 'MXN', 3000, jsonb_build_array(jsonb_build_object('memberId','b0000000-0000-4000-8000-000000000003','roleLabel','Entrega','weightBp',10000)), 'db-verify-manual-concurrent');"
MANUAL_CONCURRENT_ERRORS="$(concurrent_error_count "$MANUAL_CONCURRENT_DIR")"
MANUAL_CONCURRENT_ROWS="$(query_scalar "select count(*) from public.manual_contract_setup_receipts where idempotency_key = 'db-verify-manual-concurrent';")"
if [ "$MANUAL_CONCURRENT_ERRORS" = "0" ] && [ "$MANUAL_CONCURRENT_ROWS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: concurrent manual setup replay creates one receipt with no caller errors"
else
  FAIL=$((FAIL + 1)); FAILURES+=("manual setup concurrency"); echo "FAIL: manual setup concurrency errors=$MANUAL_CONCURRENT_ERRORS receipts=$MANUAL_CONCURRENT_ROWS"
fi

expect_failure "assignment writes reject a revoked same-org member at the trigger boundary" "must be an active member" <<'SQL'
update public.memberships set status = 'revoked' where member_id = 'b0000000-0000-4000-8000-000000000004';
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.assignments (opportunity_id, member_id, role_key, role_label, weight_bp, status)
values ('f0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000004','closer','Revocado',10000,'approved');
SQL

MEMBER_PROJECTION_ROWS="$(query_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222'; select count(*) from public.opportunity_projection_versions;" | tail -n 1)"
if [ "$MEMBER_PROJECTION_ROWS" = "0" ]; then
  PASS=$((PASS + 1)); echo "PASS: assigned member cannot read raw projected distributable bases"
else
  FAIL=$((FAIL + 1)); FAILURES+=("member projection privacy"); echo "FAIL: member read $MEMBER_PROJECTION_ROWS raw projection rows"
fi

MEMBER_FINANCE_ROWS="$(query_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222'; select count(*) from public.member_opportunity_financials() where projected_share_centavos > 0 or approved_centavos > 0 or paid_centavos > 0;" | tail -n 1)"
if [ "$MEMBER_FINANCE_ROWS" -gt 0 ]; then
  PASS=$((PASS + 1)); echo "PASS: member financial read model returns only calculated personal values"
else
  FAIL=$((FAIL + 1)); FAILURES+=("member financial read model"); echo "FAIL: member financial read model returned no personal values"
fi

# The member now holds closer + delivery roles on one opportunity. The RPC is
# deliberately opportunity-grained, so its approved/paid/recovery aggregate
# must occur exactly once even through the existing partial-payout,
# reversal/reissue, and transfer scenarios above.
expect_success "dual-role fixture assigns one member to closer and delivery" <<'SQL'
update public.assignments
set member_id = 'b0000000-0000-4000-8000-000000000003'
where id = '10000000-0000-4000-8000-000000000002';
SQL
DUAL_ROLE_FINANCE_ROWS="$(query_scalar "set role authenticated; set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222'; select count(*) from public.member_opportunity_financials() where opportunity_id = 'f0000000-0000-4000-8000-000000000001';" | tail -n 1)"
if [ "$DUAL_ROLE_FINANCE_ROWS" = "1" ]; then
  PASS=$((PASS + 1)); echo "PASS: dual-role member receives one opportunity-level financial aggregate, never one per role"
else
  FAIL=$((FAIL + 1)); FAILURES+=("dual-role member finance grain"); echo "FAIL: expected one dual-role financial row, got $DUAL_ROLE_FINANCE_ROWS"
fi

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

echo
