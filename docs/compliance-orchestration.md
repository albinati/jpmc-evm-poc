# Compliance orchestration patterns (engineering POC)

**Disclaimer:** This document is for an **independent engineering demonstration** only. It is **not legal, regulatory, or compliance advice**, and it does not describe any real bank process at J.P. Morgan or elsewhere.

## Why banks separate detection, investigation, and execution

Institutions typically maintain distinct capabilities:

1. **Detection** — Transaction monitoring, sanctions screening, fraud models, and related systems flag activity that may require review.
2. **Investigation** — Case management, documentation, and escalation paths determine whether a signal is a false positive or warrants action.
3. **Execution** — Authorized operations and legal process translate policy outcomes into account restrictions, asset holds, or enforced exits.

On a **permissioned** ledger, **smart contracts do not replace** these steps. They provide **tamper-evident state** and **role-gated transitions** after human and system processes have decided what action is appropriate.

## Patterns implemented in this POC

| Pattern | On-chain behavior | Interview talking point |
|--------|-------------------|-------------------------|
| **Administrative hold** | `CollateralizedFacility` moves from `Active` to `ComplianceHold`; collateral remains in the facility. | Mirrors an investigation period where the customer should not withdraw pledged assets. |
| **Liquidation / enforced unwind** | Compliance escalates to `Liquidation`; a **separate** liquidation role sends cash and NFT collateral to a **recovery** address. | **Segregation of duties**: compliance escalates; liquidation agent executes the final transfer. |
| **Account-level controls** | `CorporateTreasury` supports blacklist, time-bound freeze, and global pause. | Aligns with **KYC/AML**-style restrictions on the **deposit-token analog** (JPMD-like cash leg). |
| **Encumbrance / qualified transfer** | `TitleTokenization` blocks certain transfers when encumbered and supports qualified-buyer gating. | Shows **RWA** collateral discipline on-chain. |
| **Immutable audit trail** | **Events** — `ComplianceHoldApplied`, `LiquidationFinalized`, etc. | Supports **reconciliation** with off-chain case systems and **regulatory examination** narratives (subject to firm-specific retention policies). |

## Key management and custody (off-chain)

- **POC:** A private key in environment variables drives workflow transactions. This is **not** production practice.
- **Production direction:** Keys in **HSM / vault** (e.g., cloud KMS, HashiCorp Vault, institutional custody), **policy-based approval** (multi-party authorization), and **least-privilege** roles mapped to the on-chain `AccessControl` roles.

## Public references (high level)

Readers may consult public materials on **AML program expectations** and **suspicious activity reporting** in their jurisdiction (for example, U.S. FinCEN materials on the **Bank Secrecy Act** and AML rules). This POC does **not** implement SAR filing, case management, or screening systems; it only illustrates **on-chain enforcement hooks** that a real program might drive after those systems conclude.

## Mapping to Kinexys / JPM Coin (business context only)

Per public descriptions, [Kinexys](https://www.jpmorgan.com/kinexys/index) spans institutional **digital payments** and **digital assets**, and [JPM Coin](https://www.jpmorgan.com/kinexys/digital-payments/jpm-coin) is positioned as an institutional **deposit token** for on-chain cash legs. This repository is an **EVM reference** for **orchestration patterns** (collateral + compliance paths + settlement token analog), not a deployment of Kinexys products.
