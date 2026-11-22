#!/usr/bin/env bash
# Usage: ./pipeline/make_wrap.sh <art.png|jpg> <Name>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="${1:?art image required}"
NAME="${2:?wrap name required (max 30, A-Za-z0-9 _-)}"
python3 "$ROOT/pipeline/stencil.py" "$ART" -n "$NAME"
python3 "$ROOT/pipeline/validate.py" "$ROOT/outputs/${NAME}.png"
cp -f "$ROOT/outputs/${NAME}.png" "$ROOT/preview/public/wraps/${NAME}.png"
echo "OK → outputs/${NAME}.png"
echo "Open http://localhost:5173/ and select the wrap"
