#!/usr/bin/env bash
# Start (or stop) a product's dev server on its assigned port and wait until it answers.
# Usage: scripts/serve-product.sh <slug> [--stop] [--timeout <seconds>]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SLUG="${1:-}"; shift || true
STOP=0
TIMEOUT=120

while [ $# -gt 0 ]; do
  case "$1" in
    --stop) STOP=1; shift ;;
    --timeout) TIMEOUT="${2:-120}"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done

if [ -z "$SLUG" ]; then
  echo "usage: $0 <slug> [--stop] [--timeout <seconds>]" >&2
  exit 64
fi

DIR="$ROOT/products/$SLUG"
STATE="$DIR/.agency/state.json"
[ -f "$STATE" ] || { echo "error: no product at products/$SLUG" >&2; exit 65; }

PORT=$(jq -r '.port' "$STATE")
URL="http://localhost:$PORT"
PIDFILE="$DIR/.agency/dev-server.pid"
LOGFILE="$DIR/.agency/dev-server.log"

if [ "$STOP" = "1" ]; then
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    sleep 1
    kill -9 "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
    echo "stopped $SLUG on port $PORT"
  else
    echo "not running"
  fi
  exit 0
fi

# Already up? Reuse it — QA, judges and the founder share one server.
if curl -fsS --max-time 3 "$URL" >/dev/null 2>&1; then
  echo "$URL"
  exit 0
fi

cd "$DIR"

if [ ! -f package.json ]; then
  echo "error: products/$SLUG has no package.json — nothing built yet" >&2
  exit 66
fi

if [ ! -d node_modules ]; then
  echo "installing dependencies..." >&2
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund >>"$LOGFILE" 2>&1
fi

echo "starting dev server on $PORT..." >&2
: > "$LOGFILE"
PORT="$PORT" nohup npm run dev -- --port "$PORT" >>"$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"

DEADLINE=$(( $(date +%s) + TIMEOUT ))
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  if curl -fsS --max-time 3 "$URL" >/dev/null 2>&1; then
    echo "$URL"
    exit 0
  fi
  if ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "error: dev server exited. Last 40 lines:" >&2
    tail -40 "$LOGFILE" >&2
    exit 70
  fi
  sleep 1
done

echo "error: dev server did not answer on $URL within ${TIMEOUT}s. Last 40 lines:" >&2
tail -40 "$LOGFILE" >&2
exit 70
