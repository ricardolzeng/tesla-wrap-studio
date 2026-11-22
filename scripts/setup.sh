#!/usr/bin/env bash
# Local setup. Does not commit downloaded Tesla models or templates.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/preview"
npm install
cd "$ROOT"
python3 scripts/fetch_assets.py
echo "Ready: cd preview && npm run dev"
