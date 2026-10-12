#!/usr/bin/env bash
# Runs both contract validators and exits non-zero if either fails.
set -e

CONTRACTS_DIR="$(dirname "$0")/../docs/contracts"

echo "=== Validating contracts (JS) ==="
node "$CONTRACTS_DIR/validate.js"

echo "=== Validating contracts (Python) ==="
python "$CONTRACTS_DIR/validate.py"

echo "All contract validators passed."
