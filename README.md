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

You do **not** sign transactions in the browser. Contracts are **deployed** with Hardhat; the **Spring Boot API** signs workflow `POST`s using `POC_SIGNER_PRIVATE_KEY` (see [.env.example](.env.example)). The React UI only calls the API.

1. **Terminal A (repo root)** — `npm ci` then `npx hardhat node` (keep running).
2. **Terminal B (repo root)** — `npx hardhat run scripts/deploy.js --network localhost` → writes `deployments/local.json` and seeds facility **#1** in **Active**.
3. **Terminal C** — `cd backend` and run `./mvnw spring-boot:run` with `POC_RPC_URL`, `POC_DEPLOYMENTS_FILE=../deployments/local.json`, and `POC_SIGNER_PRIVATE_KEY` set (defaults in `application.yml` assume you run from `backend/` so the relative deployments path resolves).
4. **Terminal D** — `cd frontend`, `npm ci`, `npm run dev` → open the URL Vite prints; `/api` is proxied to `http://localhost:8080`.

**Verify:** `GET http://localhost:8080/api/config` should show your contract addresses and `workflowSignerConfigured: true`. In the UI, refresh config, load facility `1`, then use the step-by-step workflow (hold / release / liquidation). If POSTs fail, the signer is missing or the deploy artifact does not match the running node.

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
| `POC_SIGNER_PRIVATE_KEY` | Optional; required for `POST` workflow endpoints |

Endpoints (selection):

- `GET /api/config` — chain id, contract addresses, whether signer is configured.
- `GET /api/treasury/total-supply`
- `GET /api/facilities/{id}` — decoded `getFacility`.
- `POST /api/facilities/{id}/compliance-hold` — `X-Correlation-Id` optional.
- `POST …/compliance-release`, `…/liquidation/commence`, `…/liquidation/finalize` (JSON body `{ "recoveryAddress": "0x…" }`).

## Frontend

```bash
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:8080`. Production build: `npm run build`.

## Docker Compose (optional)

From [deploy/docker-compose.yml](deploy/docker-compose.yml):

1. Start Hardhat node and deploy (see above) on the **host**.
2. `cd deploy && docker compose up --build`
3. UI at **http://localhost:5173**, API at **http://localhost:8080**

The backend container uses `host.docker.internal` to reach the host’s RPC (`extra_hosts: host-gateway` on Linux).

## CI

- **Jenkins:** [Jenkinsfile](Jenkinsfile) — expects JDK 17 + Node 20 tool installations (adjust labels).
- **GitHub Actions:** [.github/workflows/ci.yml](.github/workflows/ci.yml)

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
