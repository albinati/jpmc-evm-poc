#!/usr/bin/env bash
# Reset the public demo: tear the stack down (volumes included so chain state is wiped)
# and bring it back up; the deploy job inside compose redeploys + reseeds the contracts.
#
# Run on a 6h systemd timer (deploy/systemd/jpmc-evm-poc-reset.timer) or manually via
# `make reset-demo`.

set -euo pipefail

ROOT="${JPMC_EVM_POC_ROOT:-/opt/jpmc-evm-poc}"
SECRETS="${JPMC_EVM_POC_SECRETS:-/etc/jpmc-evm-poc/secrets.env}"
LOG="${JPMC_EVM_POC_LOG:-/var/log/jpmc-evm-poc-reset.log}"

cd "$ROOT"

# Compute the next reset time so the API can show a countdown.
NEXT_RESET_AT=$(( $(date +%s) + 6 * 3600 ))

if [[ -f "$SECRETS" ]]; then
  # Persist the new countdown by replacing or appending POC_NEXT_RESET_AT in the secrets file.
  if grep -q '^POC_NEXT_RESET_AT=' "$SECRETS"; then
    sed -i "s/^POC_NEXT_RESET_AT=.*/POC_NEXT_RESET_AT=${NEXT_RESET_AT}/" "$SECRETS"
  else
    echo "POC_NEXT_RESET_AT=${NEXT_RESET_AT}" >> "$SECRETS"
  fi
  ENV_FILE_ARG=(--env-file "$SECRETS")
else
  echo "warn: secrets file $SECRETS not found; using compose defaults"
  ENV_FILE_ARG=()
fi

{
  echo "[$(date -Iseconds)] reset starting; next reset at $(date -d "@${NEXT_RESET_AT}" -Iseconds)"
  docker compose \
    -f deploy/docker-compose.yml \
    -f deploy/docker-compose.prod.yml \
    "${ENV_FILE_ARG[@]}" \
    down -v
  docker compose \
    -f deploy/docker-compose.yml \
    -f deploy/docker-compose.prod.yml \
    "${ENV_FILE_ARG[@]}" \
    up -d --build
  echo "[$(date -Iseconds)] reset complete"
} >> "$LOG" 2>&1
