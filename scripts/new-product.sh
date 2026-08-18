#!/usr/bin/env bash
# Create the directory, brief and state file for a new product.
# Usage: scripts/new-product.sh <slug> <idea...>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -lt 2 ]; then
  echo "usage: $0 <slug> <idea...>" >&2
  exit 64
fi

SLUG="$1"; shift
IDEA="$*"

if ! printf '%s' "$SLUG" | grep -Eq '^[a-z0-9][a-z0-9-]{1,40}$'; then
  echo "error: slug must be lowercase letters, digits and hyphens (2-41 chars): '$SLUG'" >&2
  exit 64
fi

DIR="$ROOT/products/$SLUG"
if [ -e "$DIR" ]; then
  echo "error: $DIR already exists — pick another slug or use /agency-refine" >&2
  exit 65
fi

# Deterministic port per slug so every agent and the founder hit the same URL.
PORT=$(( 4000 + $(printf '%s' "$SLUG" | cksum | cut -d' ' -f1) % 1000 ))

mkdir -p "$DIR/docs" "$DIR/.agency"

cat > "$DIR/docs/00-brief.md" <<EOF
# Brief — $SLUG

**From:** the founder
**Received:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

## The idea, verbatim

$IDEA

---

Nothing below this line is the founder's words. Every later document is an
interpretation, and where it had to interpret it says so under Assumptions.
EOF

cat > "$DIR/.agency/state.json" <<EOF
{
  "slug": "$SLUG",
  "port": $PORT,
  "url": "http://localhost:$PORT",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stage": "brief",
  "verdict": null,
  "rounds": { "fix": 0, "refine": 0 },
  "history": []
}
EOF

echo "{\"slug\":\"$SLUG\",\"dir\":\"products/$SLUG\",\"port\":$PORT,\"url\":\"http://localhost:$PORT\"}"
