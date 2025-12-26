# Stacks Multisig

Multisig contract and tooling for Stacks. This project includes a Clarity
multisig contract that supports STX transfers and SIP-010 fungible token
transfers, a mock SIP-010 token for local testing, and a simple frontend
interface to simulate signer approvals and transaction execution flow.

## ✨ Enhanced Security Features

This project now includes four additional Clarity contracts that add enterprise-grade security and governance:

- **🔐 Signer Manager**: Dynamically add/remove signers and update thresholds through proposals
- **⏱️ Timelock**: Enforce mandatory delays between approval and execution (1-30 days)
- **💰 Spending Limits**: Daily and weekly spending caps for STX and tokens
- **✅ Token Allowlist**: Whitelist approved SIP-010 tokens via governance

📖 **[View Complete Enhancement Documentation](ENHANCEMENTS.md)**

## What is included

### Core Contracts
- `contracts/multisig.clar`: multisig contract with signer set, threshold,
  transaction submission, and execution for STX or SIP-010 transfers.
- `contracts/mock-token.clar`: SIP-010 compliant token used by tests.

### Enhancement Contracts
- `contracts/signer-manager.clar`: Dynamic signer and threshold management
- `contracts/timelock.clar`: Transaction delay and cancellation system
- `contracts/spending-limits.clar`: Daily/weekly spending caps
- `contracts/token-allowlist.clar`: Token whitelisting governance

### Testing & Frontend
- `tests/*.test.ts`: Clarinet-based tests for initialization, submission,
  signature validation, and execution paths.
- `frontend/`: static HTML/CSS/JS interface that models the multisig workflow.

## Quick start

1) Install dependencies
```
npm install
```

2) Run tests
```
npm test
```

3) Open the frontend
Open `frontend/index.html` in your browser.

## Contract behavior

- The deployer initializes the signer list and threshold once.
- A signer submits a transaction with type, amount, recipient, and optional
  token contract for SIP-010 transfers.
- A transaction executes only after a threshold of unique signer signatures is
  provided.
- Executed transactions cannot be replayed.

## Scripts

- `npm test`: run unit tests.
- `npm run test:report`: tests with coverage and costs.
- `npm run test:watch`: rerun on changes.

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide with code examples
- **[ENHANCEMENTS.md](ENHANCEMENTS.md)** - Complete technical documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and diagrams
- **[SUMMARY.md](SUMMARY.md)** - Enhancement summary and statistics

## Project Structure

```
Stacks-signings/
├── contracts/
│   ├── multisig.clar           # Core multisig contract
│   ├── mock-token.clar         # Test SIP-010 token
│   ├── signer-manager.clar     # Dynamic signer management
│   ├── timelock.clar           # Transaction delays
│   ├── spending-limits.clar    # Spending caps
│   └── token-allowlist.clar    # Token whitelisting
├── tests/
│   ├── multisig.test.ts
│   ├── mock-token.test.ts
│   ├── signer-manager.test.ts
│   ├── timelock.test.ts
│   ├── spending-limits.test.ts
│   └── token-allowlist.test.ts
├── frontend/                    # Web UI demo
└── [documentation files]
```
