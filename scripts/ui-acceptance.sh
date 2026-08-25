#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${CONDUCTOR_PORT:?CONDUCTOR_PORT must be set to the workspace port}"

CANDIDATE_SHA="$(git rev-parse HEAD)"
SHORT_SHA="${CANDIDATE_SHA:0:12}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
RECEIPT_DIR="$ROOT/.context/qa/ui-integrator/$CANDIDATE_SHA/$RUN_ID"
PLAYWRIGHT_MODULE_PATH="${PLAYWRIGHT_MODULE_PATH:-/Users/racosta/.agents/skills/gstack/node_modules/playwright}"
CHROMIUM_EXECUTABLE="${CHROMIUM_EXECUTABLE:-/Users/racosta/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell}"
MODE_P_PID=""
MODE_P_SERVER_PID=""
MODE_S_PID=""
MODE_S_SERVER_PID=""

mkdir -p "$RECEIPT_DIR/commands"

timestamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }

port_pids() {
  lsof -nP -tiTCP:"$CONDUCTOR_PORT" -sTCP:LISTEN 2>/dev/null | sort -u || true
}

port_pid() {
  local pids
  pids="$(port_pids)"
  [[ "$(printf '%s\n' "$pids" | sed '/^$/d' | wc -l | tr -d ' ')" = '1' ]] || return 1
  printf '%s\n' "$pids"
}

process_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

is_descendant_of() {
  local child="$1"
  local ancestor="$2"
  while [[ "$child" =~ ^[0-9]+$ ]] && [[ "$child" -gt 1 ]]; do
    [[ "$child" = "$ancestor" ]] && return 0
    child="$(ps -o ppid= -p "$child" 2>/dev/null | tr -d ' ')"
  done
  return 1
}

assert_server_identity() {
  local mode="$1"
  local npm_pid="$2"
  local expected_server_pid="$3"
  local expected_command="$4"
  local actual_listener command cwd
  kill -0 "$npm_pid" 2>/dev/null
  kill -0 "$expected_server_pid" 2>/dev/null
  actual_listener="$(port_pid)"
  [[ "$actual_listener" = "$expected_server_pid" ]]
  is_descendant_of "$expected_server_pid" "$npm_pid"
  command="$(ps -o command= -p "$expected_server_pid")"
  [[ "$command" == *"$expected_command"* ]]
  cwd="$(process_cwd "$expected_server_pid")"
  [[ "$cwd" = "$ROOT" ]]
  printf '%s mode=%s npm_pid=%s server_pid=%s cwd=%q command=%q\n' \
    "$(timestamp)" "$mode" "$npm_pid" "$expected_server_pid" "$cwd" "$command" \
    >> "$RECEIPT_DIR/server-identity.log"
}

build_id_hash() {
  shasum -a 256 .next/BUILD_ID | awk '{print $1}'
}

wait_until_gone() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  for _ in $(seq 1 50); do
    if ! kill -0 "$pid" 2>/dev/null; then return 0; fi
    sleep 0.1
  done
  printf 'PID %s did not stop\n' "$pid" >&2
  return 1
}

stop_launched() {
  local npm_pid="$1"
  local server_pid="$2"
  if [[ -z "$server_pid" ]] && [[ -n "$npm_pid" ]]; then
    local candidate
    candidate="$(port_pid 2>/dev/null || true)"
    if [[ -n "$candidate" ]] && is_descendant_of "$candidate" "$npm_pid"; then
      server_pid="$candidate"
    fi
  fi
  [[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true
  [[ -n "$npm_pid" ]] && kill "$npm_pid" 2>/dev/null || true
  [[ -n "$server_pid" ]] && wait "$server_pid" 2>/dev/null || true
  [[ -n "$npm_pid" ]] && wait "$npm_pid" 2>/dev/null || true
  wait_until_gone "$server_pid"
  wait_until_gone "$npm_pid"
}

cleanup() {
  stop_launched "$MODE_S_PID" "$MODE_S_SERVER_PID"
  stop_launched "$MODE_P_PID" "$MODE_P_SERVER_PID"
}
trap cleanup EXIT INT TERM

record_command() {
  local name="$1"
  shift
  local dir="$RECEIPT_DIR/commands/$name"
  mkdir -p "$dir"
  printf '%q ' "$@" > "$dir/command.txt"
  printf '\n' >> "$dir/command.txt"
  timestamp > "$dir/started-at.txt"
  set +e
  "$@" >"$dir/stdout.log" 2>"$dir/stderr.log"
  local code=$?
  set -e
  printf '%s\n' "$code" > "$dir/exit-code.txt"
  timestamp > "$dir/finished-at.txt"
  if [[ "$code" -ne 0 ]]; then
    printf 'FAILED %s (exit %s); receipts: %s\n' "$name" "$code" "$dir" >&2
    return "$code"
  fi
}

wait_for_server() {
  local url="$1"
  local log="$2"
  for _ in $(seq 1 120); do
    if curl --silent --show-error --fail --output /dev/null "$url"; then
      return 0
    fi
    sleep 1
  done
  printf 'Server did not become ready: %s\n' "$url" >&2
  tail -100 "$log" >&2 || true
  return 1
}

assert_port_free() {
  local pids
  pids="$(port_pids)"
  if [[ -n "$pids" ]]; then
    printf 'Port %s is occupied by PID(s) %s; refusing to kill an unknown process.\n' "$CONDUCTOR_PORT" "$pids" >&2
    return 1
  fi
}

{
  printf 'candidate_sha=%s\n' "$CANDIDATE_SHA"
  printf 'run_id=%s\n' "$RUN_ID"
  printf 'workspace=%s\n' "$ROOT"
  printf 'branch=%s\n' "$(git branch --show-current)"
  printf 'conductor_port=%s\n' "$CONDUCTOR_PORT"
  printf 'node=%s\n' "$(node --version)"
  printf 'platform=%s\n' "$(uname -a)"
  printf 'started_at=%s\n' "$(timestamp)"
  printf 'mode_s=Supabase public variables explicitly blank; synthetic presentation only\n'
  printf 'mode_d=UNAVAILABLE unless a legitimate configured founder session is supplied separately\n'
  printf 'mode_p=fresh synchronous production build; unauthenticated endpoint checks only\n'
} > "$RECEIPT_DIR/run.meta"

git rev-parse HEAD > "$RECEIPT_DIR/head-before.txt"
git status --porcelain=v1 > "$RECEIPT_DIR/status-before.txt"
test -z "$(cat "$RECEIPT_DIR/status-before.txt")"
test "$CANDIDATE_SHA" = "$(cat "$RECEIPT_DIR/head-before.txt")"
assert_port_free
printf 'free\n' > "$RECEIPT_DIR/port-before.txt"

if [[ -f /private/tmp/modeP-server-3.log ]]; then
  cp /private/tmp/modeP-server-3.log "$RECEIPT_DIR/prior-discarded-mode-p.log"
  printf '%s\n' 'Historical discarded run copied verbatim. It overlapped an incomplete build and is not acceptance evidence.' > "$RECEIPT_DIR/prior-discarded-mode-p.note.txt"
  printf '%s\n' 'candidate_sha=unknown' 'environment=unknown' 'started_at=unknown' 'npm_pid=unknown' 'server_pid=unknown' > "$RECEIPT_DIR/prior-discarded-mode-p.meta"
  shasum -a 256 "$RECEIPT_DIR/prior-discarded-mode-p.log" > "$RECEIPT_DIR/prior-discarded-mode-p.sha256"
fi

record_command diff-check git diff --check
record_command lint npm run lint
record_command typecheck npm run typecheck
record_command test npm test
record_command db-verify bash scripts/db-verify.sh
record_command build env UI_PREBUILD_NEXT="$RECEIPT_DIR/prebuild-next" bash -lc \
  'if [[ -d .next ]]; then mv .next "$UI_PREBUILD_NEXT"; fi; npm run build'

test -f .next/BUILD_ID
cp .next/BUILD_ID "$RECEIPT_DIR/build-id.txt"
build_id_hash > "$RECEIPT_DIR/build-id-before-mode-p.sha256"
git rev-parse HEAD > "$RECEIPT_DIR/head-after-build.txt"
git status --porcelain=v1 > "$RECEIPT_DIR/status-after-build.txt"
test "$CANDIDATE_SHA" = "$(cat "$RECEIPT_DIR/head-after-build.txt")"
test -z "$(cat "$RECEIPT_DIR/status-after-build.txt")"

# Mode P starts only after the synchronous build command above has completed.
assert_port_free
MODE_P_LOG="$RECEIPT_DIR/mode-p-server.log"
{
  printf 'command=npm run start -- --hostname 127.0.0.1 --port %s\n' "$CONDUCTOR_PORT"
  printf 'head=%s\n' "$CANDIDATE_SHA"
  printf 'build_id=%s\n' "$(cat .next/BUILD_ID)"
  printf 'port=%s\n' "$CONDUCTOR_PORT"
  printf 'url=http://127.0.0.1:%s\n' "$CONDUCTOR_PORT"
  printf 'started_at=%s\n' "$(timestamp)"
} > "$RECEIPT_DIR/mode-p.meta"
npm run start -- --hostname 127.0.0.1 --port "$CONDUCTOR_PORT" >"$MODE_P_LOG" 2>&1 &
MODE_P_PID=$!
printf 'npm_pid=%s\n' "$MODE_P_PID" >> "$RECEIPT_DIR/mode-p.meta"
wait_for_server "http://127.0.0.1:$CONDUCTOR_PORT/favicon.ico" "$MODE_P_LOG"
MODE_P_SERVER_PID="$(port_pid)"
assert_server_identity mode-p "$MODE_P_PID" "$MODE_P_SERVER_PID" 'next-server'
build_id_hash > "$RECEIPT_DIR/build-id-mode-p-ready.sha256"
cmp "$RECEIPT_DIR/build-id-before-mode-p.sha256" "$RECEIPT_DIR/build-id-mode-p-ready.sha256"
printf 'server_pid=%s\nready_at=%s\n' "$MODE_P_SERVER_PID" "$(timestamp)" >> "$RECEIPT_DIR/mode-p.meta"

assert_server_identity mode-p "$MODE_P_PID" "$MODE_P_SERVER_PID" 'next-server'
curl --silent --show-error --dump-header "$RECEIPT_DIR/mode-p-dev-states.headers" --output "$RECEIPT_DIR/mode-p-dev-states.body" "http://127.0.0.1:$CONDUCTOR_PORT/dev/states"
assert_server_identity mode-p "$MODE_P_PID" "$MODE_P_SERVER_PID" 'next-server'
curl --silent --show-error --dump-header "$RECEIPT_DIR/mode-p-favicon.headers" --output "$RECEIPT_DIR/mode-p-favicon.body" "http://127.0.0.1:$CONDUCTOR_PORT/favicon.ico"
grep -Eq '^HTTP/[^ ]+ 404' "$RECEIPT_DIR/mode-p-dev-states.headers"
grep -Eq '^HTTP/[^ ]+ 200' "$RECEIPT_DIR/mode-p-favicon.headers"
grep -Eiq '^content-type: image/x-icon' "$RECEIPT_DIR/mode-p-favicon.headers"
assert_server_identity mode-p "$MODE_P_PID" "$MODE_P_SERVER_PID" 'next-server'
build_id_hash > "$RECEIPT_DIR/build-id-mode-p-before-stop.sha256"
cmp "$RECEIPT_DIR/build-id-before-mode-p.sha256" "$RECEIPT_DIR/build-id-mode-p-before-stop.sha256"

stop_launched "$MODE_P_PID" "$MODE_P_SERVER_PID"
MODE_P_PID=""
MODE_P_SERVER_PID=""
sleep 1
assert_port_free
build_id_hash > "$RECEIPT_DIR/build-id-mode-p-after-stop.sha256"
cmp "$RECEIPT_DIR/build-id-before-mode-p.sha256" "$RECEIPT_DIR/build-id-mode-p-after-stop.sha256"
printf 'stopped_at=%s\nport_after=free\n' "$(timestamp)" >> "$RECEIPT_DIR/mode-p.meta"

# Mode S uses an explicitly synthetic environment and a fresh dev process.
assert_port_free
MODE_S_LOG="$RECEIPT_DIR/mode-s-server.log"
{
  printf 'command=NEXT_PUBLIC_SUPABASE_URL="" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="" npm run dev -- --hostname 127.0.0.1 --port %s\n' "$CONDUCTOR_PORT"
  printf 'head=%s\nport=%s\nstarted_at=%s\n' "$CANDIDATE_SHA" "$CONDUCTOR_PORT" "$(timestamp)"
} > "$RECEIPT_DIR/mode-s.meta"
NEXT_PUBLIC_SUPABASE_URL="" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="" \
  npm run dev -- --hostname 127.0.0.1 --port "$CONDUCTOR_PORT" >"$MODE_S_LOG" 2>&1 &
MODE_S_PID=$!
wait_for_server "http://127.0.0.1:$CONDUCTOR_PORT/login" "$MODE_S_LOG"
MODE_S_SERVER_PID="$(port_pid)"
assert_server_identity mode-s "$MODE_S_PID" "$MODE_S_SERVER_PID" 'next-server'
printf 'npm_pid=%s\nserver_pid=%s\nready_at=%s\n' "$MODE_S_PID" "$MODE_S_SERVER_PID" "$(timestamp)" >> "$RECEIPT_DIR/mode-s.meta"

test -f "$PLAYWRIGHT_MODULE_PATH/index.mjs"
test -x "$CHROMIUM_EXECUTABLE"
assert_server_identity mode-s "$MODE_S_PID" "$MODE_S_SERVER_PID" 'next-server'
record_command mode-s-browser env \
  UI_BASE_URL="http://127.0.0.1:$CONDUCTOR_PORT" \
  UI_CANDIDATE_SHA="$CANDIDATE_SHA" \
  UI_RUN_ID="$RUN_ID" \
  UI_SERVER_PID="$MODE_S_SERVER_PID" \
  UI_RECEIPT_DIR="$RECEIPT_DIR" \
  PLAYWRIGHT_MODULE_PATH="$PLAYWRIGHT_MODULE_PATH" \
  CHROMIUM_EXECUTABLE="$CHROMIUM_EXECUTABLE" \
  node scripts/ui-acceptance-browser.mjs

for route in \
  /projects/nope \
  /opportunities/00000000-0000-4000-8000-000000000000 \
  /network/nope \
  /leaderboard/nope/provenance
do
  assert_server_identity mode-s "$MODE_S_PID" "$MODE_S_SERVER_PID" 'next-server'
  slug="$(printf '%s' "$route" | tr '/:' '__')"
  code="$(curl --silent --show-error --output "$RECEIPT_DIR/http-404-${slug}.body" --dump-header "$RECEIPT_DIR/http-404-${slug}.headers" --write-out '%{http_code}' --cookie 'f23_prototype_viewer=founder' "http://127.0.0.1:$CONDUCTOR_PORT$route")"
  printf '%s %s\n' "$code" "$route" >> "$RECEIPT_DIR/http-404-summary.txt"
  test "$code" = '404'
done

assert_server_identity mode-s "$MODE_S_PID" "$MODE_S_SERVER_PID" 'next-server'

stop_launched "$MODE_S_PID" "$MODE_S_SERVER_PID"
MODE_S_PID=""
MODE_S_SERVER_PID=""
sleep 1
assert_port_free
printf 'stopped_at=%s\nport_after=free\n' "$(timestamp)" >> "$RECEIPT_DIR/mode-s.meta"

git rev-parse HEAD > "$RECEIPT_DIR/head-after.txt"
git status --porcelain=v1 > "$RECEIPT_DIR/status-after.txt"
test "$CANDIDATE_SHA" = "$(cat "$RECEIPT_DIR/head-after.txt")"
test -z "$(cat "$RECEIPT_DIR/status-after.txt")"
printf 'finished_at=%s\nresult=PASS\n' "$(timestamp)" >> "$RECEIPT_DIR/run.meta"
printf 'PASS %s receipts=%s\n' "$SHORT_SHA" "$RECEIPT_DIR"
