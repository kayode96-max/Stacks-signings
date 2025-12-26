# Quick Start Guide - Enhanced Multisig

## Setup for Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
# Run all tests
npm test

# Run specific contract tests
npm test multisig
npm test signer-manager
npm test timelock
npm test spending-limits
npm test token-allowlist
```

### 3. Try the Frontend Demo
```bash
# Open in browser
open frontend/index.html
```

---

## Quick Examples

### Example 1: Basic Multisig (Original Contract)

```clarity
;; 1. Initialize multisig with 3 signers, 2-of-3 threshold
(contract-call? .multisig initialize
  (list 'ST1ALICE 'ST1BOB 'ST1CHARLIE)
  u2
)

;; 2. Alice submits a transaction
(contract-call? .multisig submit-txn
  u0  ;; Type: STX transfer
  u1000000  ;; Amount: 1 STX
  'ST1RECIPIENT  ;; Recipient
  none  ;; No token (STX transfer)
)
;; Returns: (ok u0) - transaction ID 0

;; 3. Signers create signatures off-chain for tx-id 0

;; 4. Execute with threshold signatures
(contract-call? .multisig execute-stx-transfer-txn
  u0  ;; Transaction ID
  (list signature1 signature2)  ;; 2 signatures
)
```

### Example 2: Enhanced Multisig with Timelock

```clarity
;; 1. Initialize timelock with 2-day delay
(contract-call? .timelock initialize
  (list 'ST1ALICE 'ST1BOB 'ST1CHARLIE)
  u2  ;; Threshold
  u288  ;; Delay: 2 days (288 blocks)
)

;; 2. Alice queues a transaction
(contract-call? .timelock queue-transaction
  u0  ;; STX transfer
  u5000000  ;; 5 STX
  'ST1RECIPIENT
  none
)
;; Returns: (ok u0) - queued with ID 0

;; 3. Bob approves the queued transaction
(contract-call? .timelock approve-transaction u0)
;; Threshold met: 2-of-3 approved

;; 4. Wait 2 days (288+ blocks must pass)

;; 5. Anyone can execute after delay
(contract-call? .timelock execute-stx-transfer u0)
```

### Example 3: Dynamic Signer Management

```clarity
;; 1. Initialize signer manager
(contract-call? .signer-manager initialize
  (list 'ST1ALICE 'ST1BOB 'ST1CHARLIE)
  u2
)

;; 2. Alice proposes adding Dave
(contract-call? .signer-manager propose-add-signer 'ST1DAVE)
;; Returns: (ok u0) - proposal ID 0

;; 3. Bob votes for the proposal
(contract-call? .signer-manager vote-proposal u0)
;; Threshold met: 2 votes

;; 4. Charlie executes the approved proposal
(contract-call? .signer-manager execute-proposal u0)
;; Dave is now a signer!

;; 5. Update threshold to 3-of-4
(contract-call? .signer-manager propose-update-threshold u3)
(contract-call? .signer-manager vote-proposal u1)
(contract-call? .signer-manager vote-proposal u1)  ;; Need 3rd vote
(contract-call? .signer-manager execute-proposal u1)
```

### Example 4: Spending Limits

```clarity
;; 1. Initialize with spending limits
(contract-call? .spending-limits initialize
  (list 'ST1ALICE 'ST1BOB)
  u1000000000  ;; Daily: 1,000 STX
  u5000000000  ;; Weekly: 5,000 STX
)

;; 2. Check if transfer is allowed
(contract-call? .spending-limits check-stx-transfer u500000000)
;; Returns: (ok true) - 500 STX is within limits

;; 3. Try to exceed daily limit
(contract-call? .spending-limits check-stx-transfer u1500000000)
;; Returns: (err u802) - ERR_DAILY_LIMIT_EXCEEDED

;; 4. Configure token limits
(contract-call? .spending-limits configure-token-limits
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-token
  u10000  ;; Daily
  u50000  ;; Weekly
)

;; 5. Check current spending
(contract-call? .spending-limits get-stx-spent)
;; Returns info about daily/weekly spent and remaining
```

### Example 5: Token Allowlist

```clarity
;; 1. Initialize token allowlist
(contract-call? .token-allowlist initialize
  (list 'ST1ALICE 'ST1BOB 'ST1CHARLIE)
  u2
)

;; 2. Owner adds initial trusted token
(contract-call? .token-allowlist add-token-direct
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trusted-token
)

;; 3. Check if token is allowed
(contract-call? .token-allowlist is-token-allowed
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trusted-token
)
;; Returns: (ok true)

;; 4. Propose adding new token via governance
(contract-call? .token-allowlist propose-add-token
  'ST1NEWTOKEN.new-token
)

;; 5. Vote and execute
(contract-call? .token-allowlist vote-on-proposal u0)
(contract-call? .token-allowlist execute-proposal u0)
```

---

## Common Workflows

### Secure High-Value Transfer

1. **Queue with Timelock** - Prevents rushed decisions
2. **Check Spending Limits** - Ensures within caps
3. **Verify Token Allowlist** - Confirms approved token
4. **Gather Approvals** - Meet threshold requirement
5. **Wait for Delay** - Security review period
6. **Execute** - Complete transfer

### Emergency Signer Rotation

1. **Create Proposal** - Remove compromised signer
2. **Fast-track Voting** - All remaining signers vote
3. **Execute Removal** - Signer removed
4. **Add Replacement** - New proposal for new signer
5. **Adjust Threshold** - If needed

### Adding New Token Support

1. **Research Token** - Verify legitimacy
2. **Propose Addition** - Create allowlist proposal
3. **Discussion Period** - Signers review
4. **Vote** - Meet threshold
5. **Execute** - Token now whitelisted
6. **Configure Limits** - Set spending caps

---

## Testing in Clarinet Console

```bash
# Start Clarinet console
clarinet console

# Deploy contracts
::deploy_contracts

# Get test addresses
::get_accounts

# Call functions
(contract-call? .multisig initialize
  (list tx-sender 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
  u2
)
```

---

## Production Deployment Checklist

- [ ] Set appropriate threshold (minimum 2-of-3)
- [ ] Configure timelock delay (recommended: 2-3 days)
- [ ] Set conservative spending limits
- [ ] Add only audited tokens to allowlist
- [ ] Test all functions on testnet first
- [ ] Use hardware wallets for all signers
- [ ] Document all signer addresses
- [ ] Setup monitoring for transactions
- [ ] Create incident response plan
- [ ] Regular security audits

---

## Useful Read-Only Queries

```clarity
;; Check current signers
(contract-call? .multisig get-signers)

;; Get threshold
(contract-call? .multisig get-threshold)

;; Check transaction status
(contract-call? .multisig get-transaction u0)

;; View timelock delay
(contract-call? .timelock get-delay)

;; Check if can execute
(contract-call? .timelock can-execute u0)

;; View spending limits
(contract-call? .spending-limits get-stx-limits)

;; Check remaining budget
(contract-call? .spending-limits get-stx-spent)

;; Check token allowlist
(contract-call? .token-allowlist is-token-allowed 'ST1....token)
```

---

## Need Help?

- 📖 Full documentation: [ENHANCEMENTS.md](ENHANCEMENTS.md)
- 🔍 Contract source: `contracts/`
- ✅ Test examples: `tests/`
- 🌐 Stacks docs: https://docs.stacks.co
