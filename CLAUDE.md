# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

Independent EVM/Hardhat proof of concept that walks an audience through every common compliance / fraud / liquidity scenario for **ERC-20** (`CorporateTreasury`), **ERC-721** (`TitleTokenization`), **ERC-1155** (`TradeFinance`), plus a `CollateralizedFacility` state machine. Three role-separated demo signers prove segregation of duties on-chain. Not affiliated with J.P. Morgan; the names are business framing for a hiring demo. See `docs/compliance-orchestration.md` for the AML narrative.

## Three-tier architecture

The repo is one workspace with three deployable tiers that talk over JSON-RPC and HTTP:

1. **Contracts** (repo root, Hardhat 3, Solidity 0.8.20, OpenZeppelin 5) — `contracts/`, `scripts/deploy.js`, `test/`. `package.json` has `"type": "module"` because Hardhat 3 is ESM.
2. **Spring Boot orchestration API** (`backend/`, Java 17, Web3j 4.10.3) — reads contract addresses + signer addresses from a deployment artifact, holds three private keys server-side, and routes each workflow to the correct role. **Browsers never sign**; the API does.
3. **React UI** (`frontend/`, Vite + TS + React 19) — split into per-panel components under `src/panels/`. Calls `/api/...`, proxied to `localhost:8080` in dev (see `vite.config.ts`); served behind nginx in Docker.

The glue between tier 1 and tier 2 is **`deployments/local.json`** (gitignored, written by `scripts/deploy.js`). It now contains four contract addresses plus a `signers` block (banker / compliance / liquidationAgent). The backend reads it via `POC_DEPLOYMENTS_FILE`. If you redeploy contracts you must restart the backend.

## Three-signer model (segregation of duties)

The orchestration API holds three private keys and routes each method to the right one. Falls back through this chain per role: `POC_<ROLE>_PRIVATE_KEY` → legacy `POC_SIGNER_PRIVATE_KEY` → Hardhat dev defaults (#1/#2/#3) when `POC_ALLOW_DEV_DEFAULTS=true`. `EnvSignerCredentialsProvider` implements this resolution.

| Role | Default | On-chain roles granted by `scripts/deploy.js` |
|---|---|---|
| **banker** | Hardhat #1 | `FACILITY_BANKER_ROLE`, `BANKER_ROLE`, `TRANSFER_AGENT_ROLE`, `TREASURY_OPERATOR_ROLE` |
| **compliance** | Hardhat #2 | `COMPLIANCE_ROLE` (treasury, trade, facility), `COMPLIANCE_OFFICER_ROLE` (title) |
| **liquidation agent** | Hardhat #3 | `LIQUIDATION_AGENT_ROLE`, `SETTLEMENT_AGENT_ROLE` |

Failure scenarios are demonstrable: e.g. POSTing `/api/facilities/{id}/compliance-hold` while substituting the banker key produces a 400 with the decoded `AccessControlUnauthorizedAccount` revert.

## Commands

### Contracts (run from repo root)

```bash
npm ci
npm run compile         # hardhat compile
npm test                # all 46 tests
npm run verify          # compile + test, fails fast
npm run deploy:local    # deploy + grant SoD roles + seed facility#1, title#2, invoice#1
npm run e2e:local-chain # ci + verify + start persistent hardhat node + deploy
```

Single test: `npx hardhat test test/CollateralizedFacility.test.js`.

### Backend

```bash
cd backend
./mvnw spring-boot:run     # dev run; no env vars required (dev defaults)
./mvnw -B verify           # what CI runs
```

### Frontend

```bash
cd frontend
npm ci
npm run dev      # vite dev server, /api proxied to :8080
npm run build    # tsc -b && vite build
npm run lint
```

### Full stack in Docker

```bash
docker compose -f deploy/docker-compose.yml up --build
docker compose -f deploy/docker-compose.yml down -v
```

### Public-prod (Hetzner)

```bash
make deploy-prod        # docker compose with prod overlay + secrets.env
make reset-demo         # manual reset (also wired to a 6h systemd timer)
make logs               # tail compose logs
```

## Critical contract details

- **`CollateralizedFacility`** state machine: `Draft → Active → ComplianceHold → Liquidation → Closed` plus the normal `Active → Closed` exit (`releaseFacility`). New: `topUpCash(facilityId, amount)` (borrower-only, Active-only) — the canonical "amend an existing instrument" demo. `getFacilityParts` exists alongside `getFacility` because Web3j cannot decode struct tuples — don't remove it.
- **`CorporateTreasury`** has `forceTransfer(from, to, amount, reason)` (compliance only). Bypasses the blacklist/freeze guards on `from` via a transient `_seizureInProgress` flag in `_update`. Still respects `whenNotPaused`.
- **`TitleTokenization`**: `safeTransferTitle` is now gated by `TRANSFER_AGENT_ROLE` (granted to banker by deploy script, and to the deployer in the constructor for backwards-compat with existing tests). `updateTokenURI` lets compliance amend the metadata pointer. `getTitleDetailParts` is the Web3j-friendly view.
- **`TradeFinance`** has `extendDueDate(invoiceId, newDueDate)` (banker only, must extend strictly into the future). `getInvoiceParts` is the Web3j-friendly view.

## Backend wiring

- `EventCatalog` registers every interesting event (custom + ERC-20/721/1155 standard ones we care about) keyed by topic0 hash. `TransactionReceiptService.submit` simulates via `eth_call` first so reverts surface as `400` with the decoded custom-error name (via `RevertDecoder`'s 4-byte selector registry). Successful txs return `TxReceiptDto` with decoded events.
- `ContractAddresses` now has all four addresses; `DeploymentAddresses` requires every key in `local.json` (boot fails fast if any is missing).
- `SignerCredentialsProvider` exposes `banker()`, `compliance()`, `liquidationAgent()`. The default `credentials()` returns `banker()` for any code that pre-dates the SoD model.
- New write services: `TreasuryWorkflowService`, `TitleWorkflowService`, `TradeFinanceWorkflowService` — each routes through the correct signer per method. `FacilityWorkflowService` was rewritten to do the same and now returns `TxReceiptDto` from every method.

## Frontend layout

`App.tsx` is a thin tab switcher. Each tab is its own file under `src/panels/`:

- `SetupPanel` — onboarding instructions
- `NetworkPanel` — config + signer address rail
- `TreasuryPanel` — mint, blacklist, freeze, pause, force-transfer (ERC-20)
- `TitlePanel` — mint, encumber, update URI, transfer (ERC-721)
- `TradeFinancePanel` — create, factor, settle, extend (ERC-1155)
- `FacilityPanel` — full lifecycle + topUpCash (the amend path)
- `EventLogPanel` — accumulated session receipts

`components/TxReceiptView` renders the decoded receipt under each action. `components/StateBanner` is a small pre/post snapshot. `api.ts` handles the JSON envelope `{ error, status }` from `ApiExceptionHandler`. Shared types in `types.ts`.

`VITE_PUBLIC_DEMO=true` (set in `frontend/.env.production`) flips on the public-demo banner + reset countdown in `NetworkPanel`.

## Public hosting

`deploy/docker-compose.prod.yml` overlays the dev compose to remove public port bindings (chain RPC and backend stay internal) and bind the frontend container to `127.0.0.1:18080` so the host's existing reverse proxy forwards a single domain. Three reverse-proxy snippets in `deploy/reverse-proxy/` cover Caddy, nginx, and Traefik. Per-IP rate-limit on POSTs is 30/min.

Reset cron: `deploy/reset-demo.sh` + `deploy/systemd/jpmc-evm-poc-reset.{service,timer}` wipes volumes, redeploys, and writes the next-reset epoch into `/etc/jpmc-evm-poc/secrets.env` so the API can surface it via `/api/config`. Timer fires at 00:00, 06:00, 12:00, 18:00 with `Persistent=true`.

## Gotchas

- The repo is ESM (`"type": "module"`); use `import`, not `require`, in `scripts/` and `hardhat.config.js`.
- Hardhat in-process network uses `chainId: 1337`; the local node defaults to `31337`. `application.yml`'s default is `31337`. The deployment file's chainId is what's actually used by `RawTransactionManager` — `POC_CHAIN_ID` is informational.
- `deployments/local.json` is gitignored and regenerated; treat it as build output.
- `scripts/deploy.mjs` was deleted; only `scripts/deploy.js` exists.
- `safeTransferTitle` is **role-gated now** (`TRANSFER_AGENT_ROLE`); a test that called it without granting the role would silently revert with `AccessControlUnauthorizedAccount` instead of the encumbrance error.
- The compose `!override` syntax in `docker-compose.prod.yml` requires Docker Compose v2.20+.
