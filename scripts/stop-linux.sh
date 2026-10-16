#!/usr/bin/env bash
# Stop Prelegal and remove its container (the database goes with it).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down
