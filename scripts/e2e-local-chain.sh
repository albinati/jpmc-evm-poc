#!/usr/bin/env bash
# Contract-side E2E: compile, test (in-process Hardhat + signed txs), then deploy to a real local node.
# Leaves Hardhat JSON-RPC running so deployments/local.json stays valid for the Spring API.
# Requires: bash, Node 18+. On Windows, use Git Bash or WSL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> npm ci"
npm ci

echo "==> compile + test (includes end-to-end deploy.js parity scenario)"
npm run compile
npm test

echo "==> start Hardhat node in background (127.0.0.1:8545), leave it running"
nohup npx hardhat node --hostname 127.0.0.1 --port 8545 > hardhat-node.log 2>&1 &
HH_PID=$!
echo "    PID=${HH_PID}  (log: ${ROOT}/hardhat-node.log)"
sleep 3

echo "==> deploy + seed + write deployments/local.json (deployer signs txs)"
npm run deploy:local

echo ""
echo "Done."
echo "  - Artifact: deployments/local.json (matches the node above)."
echo "  - Hardhat node still running. Stop when finished: kill ${HH_PID}"
echo "  - Next: backend + frontend per README Quick start."
