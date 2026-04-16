# JPMC Enterprise Blockchain - EVM Proof of Concept

This repository contains a Proof of Concept (PoC) demonstrating how enterprise-grade EVM (Ethereum Virtual Machine) smart contracts can be leveraged to modernize traditional banking workflows. 

Rather than deploying permissionless, retail-focused tokens, this architecture is designed for **Private Consortium Chains (e.g., Quorum) and Multi-Cloud deployments (AWS/Azure/GCP)** where compliance, access control, and auditability are non-negotiable.

## The Business Case (Why this matters)

1. **Cost & Friction Reduction:** Replacing manual clearing, physical title deeds, and settlement delays with instant, cryptographically verifiable state machines.
2. **Regulatory Compliance (KYC/AML):** Smart contracts are useless to a Tier-1 bank if they cannot be halted during an exploit or if bad actors cannot be frozen.
3. **Immutable Audit Trails:** Regulators and internal auditors can verify treasury states mathematically without relying on disjointed database silos.

## Architecture

This PoC implements two primary use cases using standard OpenZeppelin enterprise libraries:

### 1. `CompliantTreasury.sol` (ERC-20)
A corporate stablecoin/treasury token designed for internal settlement.
- **Pausable:** The entire contract can be halted globally by the `COMPLIANCE_ROLE` in the event of an infrastructure breach.
- **Blacklist/Freeze:** Specific addresses can be frozen, preventing them from sending or receiving funds. This fulfills strict KYC/AML mandates.
- **Role-Based Access Control:** Separation of duties between the `DEFAULT_ADMIN_ROLE` and the `COMPLIANCE_ROLE`.

### 2. `AssetTitle.sol` (ERC-721)
A Real World Asset (RWA) tokenization contract. Replaces physical collateral (like property deeds or loan agreements) with NFTs.
- **Document Anchoring:** Ties a unique token ID to a secure document hash (e.g., a PDF stored in a private AWS S3 / GCP Cloud Storage bucket).
- **Ultimate Authority:** The bank (Owner) retains the right to `revokeTitle` (burn) the asset in the event of a loan default, court order, or fraud.

## Multi-Cloud Deployment Strategy

These contracts are designed to be deployed on private or permissioned EVM chains. The node infrastructure supporting this chain should be orchestrated via Kubernetes across our multi-cloud portfolio:
- **AWS (EKS):** Primary validator nodes and RPC endpoints.
- **GCP (GKE):** Failover and analytics nodes (BigQuery integration for chain data indexing).

## Setup & Compilation

```bash
npm install
npm run compile
```

---
*Author: Luis Albinati - Executive Director, Product & Platform Strategy*