#!/usr/bin/env bash
# Publish @nikomohr/goal-core and @nikomohr/goal-cli to npm (run locally after npm login).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building..."
npm run build

echo "Publishing @nikomohr/goal-core..."
npm publish -w @nikomohr/goal-core --access public

echo "Publishing @nikomohr/goal-cli..."
npm publish -w @nikomohr/goal-cli --access public

echo "Done. Install with: npm install -g @nikomohr/goal-cli"
