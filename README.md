# JPMC Enterprise Blockchain — EVM orchestration POC

**Independent proof of concept.** Not affiliated with J.P. Morgan. Public **Kinexys** and **JPM Coin** names are used only as **business context** for a hiring demonstration.

This repo is an **EVM/Hardhat** reference implementation of **permissioned** patterns: a **deposit-token analog** (`CorporateTreasury`), **RWA-style** collateral (`TitleTokenization`), **trade-finance** instruments (`TradeFinance`), and a **collateralized facility** with **compliance hold** and **liquidation** paths (`CollateralizedFacility`). See [docs/compliance-orchestration.md](docs/compliance-orchestration.md) for how this maps to AML/fraud workflows **without** claiming legal or regulatory advice.

## What is implemented

| Layer | Stack | Role |
|-------|--------|------|
| On-chain | Solidity 0.8.20, OpenZeppelin 5.0, Hardhat 3 | Compliant ERC-20, ERC-721 titles, ERC-1155 trade finance, **facility state machine** |
| Orchestration API | Java 17, Spring Boot 3, Web3j | RPC reads, **role-mapped workflow** transactions, Actuator |
| UI | React, Vite, TypeScript | Dashboard for config, facility state, demo buttons (no keys in browser) |
| Ops | Docker Compose, sample **Kubernetes** manifest, **Jenkinsfile**, GitHub Actions | CI/CD-shaped delivery |

## Prerequisites

- **Node.js 18+** (Hardhat 3 uses ESM; repo has `"type": "module"`).
- **Java 17+** and **Maven** (or use `backend/mvnw` when Java is installed).
- **Docker** (optional, for `deploy/docker-compose.yml`).

## Quick start: from zero to workflow

You do **not** sign transactions in the browser. Contracts are **deployed** with Hardhat; the **Spring Boot API** signs workflow `POST`s using **three role-separated keys** (`POC_BANKER_PRIVATE_KEY`, `POC_COMPLIANCE_PRIVATE_KEY`, `POC_LIQUIDATION_PRIVATE_KEY` — see [.env.example](.env.example)). With no env vars set, the API falls back to Hardhat well-known accounts #1 / #2 / #3 so a fresh checkout works zero-config.

1. **Terminal A (repo root)** — `npm ci` then `npx hardhat node` (keep running).
2. **Terminal B (repo root)** — `npx hardhat run scripts/deploy.js --network localhost` → writes `deployments/local.json` (the four contract addresses **plus** the three demo signer addresses) and seeds facility **#1**, title **#2**, and invoice **#1**.
3. **Terminal C** — `cd backend && ./mvnw spring-boot:run`. With `POC_ALLOW_DEV_DEFAULTS=true` (default) no env vars are required; the API uses Hardhat #1/#2/#3 as banker / compliance / liquidation agent.
4. **Terminal D** — `cd frontend && npm ci && npm run dev` → open the URL Vite prints; `/api` is proxied to `http://localhost:8080`.

**Verify:** `GET http://localhost:8080/api/config` should show your contract addresses, the three demo signer addresses, and `workflowSignerConfigured: true`. The UI's **Network** tab renders the same three addresses with role tags. Then walk the **Treasury / Title / Trade finance / Facility** tabs.

### Demo signers (segregation of duties)

| Role | Default account (Hardhat) | Holds on-chain |
|---|---|---|
| **banker** | #1 (`0x70997970…`) | `FACILITY_BANKER_ROLE`, `BANKER_ROLE`, `TRANSFER_AGENT_ROLE`, `TREASURY_OPERATOR_ROLE` |
| **compliance** | #2 (`0x3C44CdDd…`) | `COMPLIANCE_ROLE` (treasury, trade, facility), `COMPLIANCE_OFFICER_ROLE` (title) |
| **liquidation agent** | #3 (`0x90F79bf6…`) | `LIQUIDATION_AGENT_ROLE`, `SETTLEMENT_AGENT_ROLE` |

Try a **failure path** to see SoD enforced on-chain: log the receipt panel during a banker-signed `applyComplianceHold` — the API surfaces a 400 with the decoded `AccessControlUnauthorizedAccount` revert.

**Optional — contract E2E in one shot:** `npm run e2e:local-chain` (bash: [scripts/e2e-local-chain.sh](scripts/e2e-local-chain.sh)) runs `npm ci`, **`npm run verify`** (compile + all tests), starts a **persistent** Hardhat node in the background, runs **`npm run deploy:local`**, and prints the PID to stop the node when you are done. Then start the API and UI as in steps 3–4 above.

## Smart contracts

```bash
npm ci
npm run compile
npm test
```

**Shortcut:** `npm run verify` runs `compile` then `test` (fails fast if contracts break).

### End-to-end on-chain scenario (automated test)

[`test/end-to-end-demo.scenario.test.js`](test/end-to-end-demo.scenario.test.js) mirrors [`scripts/deploy.js`](scripts/deploy.js): **deploy** treasury, title, trade, and facility; **seed** facility `#1` to **Active**; then **sign** and send a full workflow (compliance hold → release → hold → commence liquidation → finalize to recovery). It runs in Hardhat’s in-process network with the same **ECDSA signing** model as local deploy (Hardhat accounts).

That gives you **create (deploy) → sign → exercise → assert balances/state** without the browser or Java stack. The UI/API path is still the same Quick start above, using `deployments/local.json` and `POC_SIGNER_PRIVATE_KEY`.

Contracts:

- `CorporateTreasury.sol` — JPMD-**like** treasury token: pause, blacklist, freeze, roles.
- `TitleTokenization.sol` — ERC-721 collateral with encumbrance / qualified buyer hooks.
- `TradeFinance.sol` — ERC-1155 invoice / receivable positions.
- `CollateralizedFacility.sol` — Escrows ERC-20 + optional ERC-721; **Draft → Active → ComplianceHold → Liquidation → Closed**; SoD across banker / compliance / liquidation agent.

Legacy duplicates `AssetTitle.sol` / `CompliantTreasury.sol` were removed (OpenZeppelin 5 incompatibility).

## Deploy artifact (for the Java API)

```bash
# Terminal A
npx hardhat node

# Terminal B
npx hardhat run scripts/deploy.js --network localhost
```

This writes **`deployments/local.json`** (gitignored). Copy [deployments/local.example.json](deployments/local.example.json) as a template if needed.

The deploy script also **seeds facility `#1`**: funded with treasury tokens + a title NFT in **`Active`** state so the demo UI workflow buttons (`compliance-hold`, liquidation, etc.) have valid on-chain state. If you deployed before this seed existed, run deploy again against your node.

For Docker against a remote RPC inside containers, set **`RPC_URL`** (see [hardhat.config.js](hardhat.config.js) `localhost` URL).

## Spring Boot API

```bash
cd backend
./mvnw spring-boot:run
```

Configuration (env or `backend/src/main/resources/application.yml`):

| Variable | Meaning |
|----------|---------|
| `POC_RPC_URL` | JSON-RPC HTTP endpoint |
| `POC_CHAIN_ID` | Chain id (e.g. `31337` for Hardhat) |
| `POC_DEPLOYMENTS_FILE` | Path or `classpath:…` to deployment JSON |
| `POC_BANKER_PRIVATE_KEY` | Banker / borrower / treasury operator |
| `POC_COMPLIANCE_PRIVATE_KEY` | Compliance role (blacklist, freeze, hold, force-transfer) |
| `POC_LIQUIDATION_PRIVATE_KEY` | Liquidation agent + settlement agent |
| `POC_SIGNER_PRIVATE_KEY` | Legacy single-key fallback (used per-role only when the explicit key is missing) |
| `POC_ALLOW_DEV_DEFAULTS` | When `true` (default), fall back to Hardhat well-known accounts if a key is missing. Set `false` on production hosts. |
| `POC_NEXT_RESET_AT` | Public-demo only: epoch seconds of the next chain reset, surfaced via `/api/config`. |

Endpoints (selection):

- `GET /api/config` — chain id, four contract addresses, three demo signer addresses, `nextResetAt`.
- `GET /api/treasury/status`, `/api/treasury/holders/{address}`, `/api/treasury/total-supply`
- `GET /api/titles/{tokenId}`, `GET /api/invoices/{invoiceId}`, `GET /api/facilities/{id}`
- **Treasury** (`/api/treasury`): `mint`, `blacklist`, `freeze`, `release/{addr}`, `pause`, `unpause`, `force-transfer`
- **Title** (`/api/titles`): `mint`, `{id}/encumbrance`, `{id}/uri`, `{id}/transfer`, `qualified-buyers`
- **Trade finance** (`/api/invoices`): `POST` (create), `{id}/settle`, `{id}/factor`, `{id}/extend`, `pause`, `unpause`
- **Facility** (`/api/facilities/{id}`): `compliance-hold`, `compliance-release`, `liquidation/commence`, `liquidation/finalize`, `topup`

All workflow `POST`s return a decoded receipt: `{ transactionHash, blockNumber, status, gasUsed, contractAddress, from, events: [{ name, contract, args }, …] }`.

## Frontend

```bash
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:8080`. Production build: `npm run build`.

## Docker Compose (full simulation)

[deploy/docker-compose.yml](deploy/docker-compose.yml) runs the **whole stack** in Docker:

| Service   | Role |
|-----------|------|
| **chain** | Hardhat JSON-RPC (`npx hardhat node`) on port **8545** |
| **deploy** | One-shot job: `scripts/deploy.js` → writes **`/deployments/local.json`** on a shared volume |
| **backend** | Spring Boot + Java 17 (reads the artifact, RPC at `http://chain:8545`) |
| **frontend** | nginx + static build; proxies **`/api`** → backend |

From the **repo root**:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

- UI: **http://localhost:5173** (use `/api/...` through nginx; same as production-style routing)
- API (direct): **http://localhost:8080**
- RPC: **http://localhost:8545**

Optional env: `POC_SIGNER_PRIVATE_KEY` (defaults to Hardhat account #0 for the POC).

Reset chain + redeploy artifact:

```bash
docker compose -f deploy/docker-compose.yml down -v
```

**Host chain (legacy):** you can still run `npx hardhat node` and deploy on the host, then point a **custom** compose override at `host.docker.internal:8545` and mount `./deployments` — the default file above does **not** require a host JVM or Node for the demo.

## CI

- **Jenkins:** [Jenkinsfile](Jenkinsfile) — expects JDK 17 + Node 20 tool installations (adjust labels).
- **GitHub Actions:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

## Public demo on the existing Hetzner host

The public-prod stack is a thin overlay on top of `deploy/docker-compose.yml`. It binds **only** the frontend container to `127.0.0.1:18080` so the host's existing reverse proxy can forward `demo.example.com → 127.0.0.1:18080`. The JSON-RPC port stays internal — public visitors never touch the chain directly.

1. SSH to the host. `git clone` (or `git pull`) to `/opt/jpmc-evm-poc`.
2. `sudo install -d -m 0700 /etc/jpmc-evm-poc && sudo cp deploy/secrets.env.example /etc/jpmc-evm-poc/secrets.env && sudo chmod 600 /etc/jpmc-evm-poc/secrets.env` (edit if you want non-default keys).
3. `make deploy-prod` — brings up `chain`, runs the deploy job, starts `backend` + `frontend`.
4. Drop the matching snippet into the host's existing reverse proxy config and reload:
   - Caddy → `deploy/reverse-proxy/Caddyfile.snippet`
   - nginx → `deploy/reverse-proxy/nginx.conf.snippet` (then `sudo certbot --nginx -d demo.example.com`)
   - Traefik → `deploy/reverse-proxy/traefik-labels.yaml.snippet`
5. Install the 6-hour reset timer:
   ```bash
   sudo cp deploy/systemd/jpmc-evm-poc-reset.service /etc/systemd/system/
   sudo cp deploy/systemd/jpmc-evm-poc-reset.timer   /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now jpmc-evm-poc-reset.timer
   ```
6. Verify: `curl https://demo.example.com/api/config` returns the four contract addresses plus `nextResetAt`. The UI shows a "next reset in HH:MM" badge and a public-demo disclaimer.

**Manual reset** (between viewers): `sudo systemctl start jpmc-evm-poc-reset.service`, or `make reset-demo` from the repo.

**What is *not* exposed publicly:** the JSON-RPC port (`8545`) and the backend port (`8080`) are bound only inside the docker network. The frontend container's nginx already proxies `/api → backend:8080`, so the host reverse proxy needs only one forward rule.

## 5–7 minute hiring-manager demo script

1. **Frame** — “EVM analog of Kinexys-style institutional cash + collateral; Canton is not EVM; this shows orchestration patterns.”
2. **Tests** — `npm run verify` or `npm test` (**29** tests) including an **end-to-end deploy + workflow** scenario; treasury, titles, trade finance, facility lifecycle.
3. **Facility story** — Open `CollateralizedFacility`: borrower funds cash + title; **compliance hold** freezes progression; **liquidation** moves assets to **recovery**; contrast with **normal release**.
4. **SoD** — Compliance escalates; separate **liquidation agent** finalizes; keys would sit in vault/HSM in production ([docs/compliance-orchestration.md](docs/compliance-orchestration.md)).
5. **API** — Spring Boot + Web3j: read facility state; optional `POST` with demo key from `.env.example` (Hardhat #0).
6. **UI** — React dashboard; no private keys in the browser.
7. **Ops** — Show Dockerfile/Jenkins/K8s sketch and Actuator `/actuator/health`.

## Role mapping (position requirements)

- **Java + EVM** — Spring Boot orchestration + Hardhat/Solidity.
- **Digital assets / JPMD narrative** — Treasury + collateral + trade finance + facility.
- **AML / fraud** — Hold vs liquidation + treasury freeze/blacklist; documented in compliance doc.
- **CI/CD, cloud** — Jenkins + GHA, Docker, K8s sample.
- **Key management** — `POC_SIGNER_PRIVATE_KEY` documents the **seam** only; production = vault/HSM.

## License

MIT (see SPDX headers in contracts). Third-party: OpenZeppelin, Hardhat, Spring, Web3j.
