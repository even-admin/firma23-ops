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

port_pid() {
  lsof -nP -tiTCP:"$CONDUCTOR_PORT" -sTCP:LISTEN 2>/dev/null | head -1 || true
}

stop_launched() {
  local npm_pid="$1"
  local server_pid="$2"
  [[ -n "$server_pid" ]] && kill "$server_pid" 2>/dev/null || true
  [[ -n "$npm_pid" ]] && kill "$npm_pid" 2>/dev/null || true
  [[ -n "$server_pid" ]] && wait "$server_pid" 2>/dev/null || true
  [[ -n "$npm_pid" ]] && wait "$npm_pid" 2>/dev/null || true
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
  local pid
  pid="$(port_pid)"
  if [[ -n "$pid" ]]; then
    printf 'Port %s is occupied by PID %s; refusing to kill an unknown process.\n' "$CONDUCTOR_PORT" "$pid" >&2
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
printf '%s\n' "$MODE_P_PID" >> "$RECEIPT_DIR/mode-p.meta"
wait_for_server "http://127.0.0.1:$CONDUCTOR_PORT/favicon.ico" "$MODE_P_LOG"
MODE_P_SERVER_PID="$(port_pid)"
printf 'npm_pid=%s\nserver_pid=%s\nready_at=%s\n' "$MODE_P_PID" "$MODE_P_SERVER_PID" "$(timestamp)" >> "$RECEIPT_DIR/mode-p.meta"

curl --silent --show-error --dump-header "$RECEIPT_DIR/mode-p-dev-states.headers" --output "$RECEIPT_DIR/mode-p-dev-states.body" "http://127.0.0.1:$CONDUCTOR_PORT/dev/states"
curl --silent --show-error --dump-header "$RECEIPT_DIR/mode-p-favicon.headers" --output "$RECEIPT_DIR/mode-p-favicon.body" "http://127.0.0.1:$CONDUCTOR_PORT/favicon.ico"
grep -Eq '^HTTP/[^ ]+ 404' "$RECEIPT_DIR/mode-p-dev-states.headers"
grep -Eq '^HTTP/[^ ]+ 200' "$RECEIPT_DIR/mode-p-favicon.headers"
grep -Eiq '^content-type: image/x-icon' "$RECEIPT_DIR/mode-p-favicon.headers"

stop_launched "$MODE_P_PID" "$MODE_P_SERVER_PID"
MODE_P_PID=""
MODE_P_SERVER_PID=""
sleep 1
assert_port_free
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
printf 'npm_pid=%s\nserver_pid=%s\nready_at=%s\n' "$MODE_S_PID" "$MODE_S_SERVER_PID" "$(timestamp)" >> "$RECEIPT_DIR/mode-s.meta"

test -f "$PLAYWRIGHT_MODULE_PATH/index.mjs"
test -x "$CHROMIUM_EXECUTABLE"
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
  slug="$(printf '%s' "$route" | tr '/:' '__')"
  code="$(curl --silent --show-error --output "$RECEIPT_DIR/http-404-${slug}.body" --dump-header "$RECEIPT_DIR/http-404-${slug}.headers" --write-out '%{http_code}' --cookie 'f23_prototype_viewer=founder' "http://127.0.0.1:$CONDUCTOR_PORT$route")"
  printf '%s %s\n' "$code" "$route" >> "$RECEIPT_DIR/http-404-summary.txt"
  test "$code" = '404'
done

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
