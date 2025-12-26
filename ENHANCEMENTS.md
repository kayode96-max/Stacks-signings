# Stacks Multisig - Enhancement Documentation

## Overview of Enhancements

This document describes the new Clarity contracts added to enhance the multisig system with advanced security and governance features.

## New Contracts

### 1. Signer Manager (`signer-manager.clar`)

**Purpose**: Dynamic signer and threshold management through governance proposals.

**Key Features**:
- Add/remove signers via voting
- Update threshold requirements
- Proposal-based governance system
- Time-limited proposals (10 day expiry)
- Prevents duplicate signers

**Core Functions**:
- `initialize(signers, threshold)` - Set initial signers and threshold
- `propose-add-signer(new-signer)` - Create proposal to add a signer
- `propose-remove-signer(signer)` - Create proposal to remove a signer
- `propose-update-threshold(new-threshold)` - Create proposal to update threshold
- `vote-proposal(proposal-id)` - Vote on an active proposal
- `execute-proposal(proposal-id)` - Execute approved proposal

**Use Cases**:
- Rotating team members without redeploying
- Adjusting security thresholds as organization grows
- Emergency signer replacement

---

### 2. Timelock (`timelock.clar`)

**Purpose**: Enforce a mandatory delay between transaction approval and execution.

**Key Features**:
- Configurable delay period (1-30 days)
- Grace period for execution (2 days after delay)
- Queue transactions before execution
- Cancel transactions during delay
- Supports STX and SIP-010 token transfers

**Core Functions**:
- `initialize(signers, threshold, delay)` - Setup with delay in blocks
- `queue-transaction(type, amount, recipient, token)` - Queue a new transaction
- `approve-transaction(tx-id)` - Add approval to queued transaction
- `execute-stx-transfer(tx-id)` - Execute STX transfer after delay
- `execute-token-transfer(tx-id, token)` - Execute token transfer after delay
- `cancel-transaction(tx-id)` - Cancel pending transaction
- `can-execute(tx-id)` - Check if transaction can execute

**Security Benefits**:
- Prevents rushed or compromised transactions
- Allows time for security review
- Enables cancellation of suspicious transactions
- Protects against key compromise scenarios

**Constants**:
- MIN_DELAY: 144 blocks (~1 day)
- MAX_DELAY: 4320 blocks (~30 days)
- GRACE_PERIOD: 288 blocks (~2 days)

---

### 3. Spending Limits (`spending-limits.clar`)

**Purpose**: Implement daily and weekly spending caps for enhanced security.

**Key Features**:
- Separate limits for STX and SIP-010 tokens
- Daily and weekly spending tracking
- Automatic reset per time period
- Per-token configuration
- Real-time spending validation

**Core Functions**:
- `initialize(signers, daily-stx-limit, weekly-stx-limit)` - Setup STX limits
- `check-stx-transfer(amount)` - Validate and track STX transfer
- `check-token-transfer(token, amount)` - Validate and track token transfer
- `configure-token-limits(token, daily, weekly)` - Set token-specific limits
- `update-stx-limits(daily, weekly)` - Update STX limits
- `get-stx-spent()` - Get current spending and remaining limits
- `can-spend-stx(amount)` - Check if amount is within limits

**Time Periods**:
- Daily: 144 blocks (~24 hours)
- Weekly: 1008 blocks (~7 days)

**Use Cases**:
- Limit exposure to compromised keys
- Rate limiting for security
- Budget enforcement
- Regulatory compliance

---

### 4. Token Allowlist (`token-allowlist.clar`)

**Purpose**: Whitelist approved SIP-010 tokens for multisig transfers.

**Key Features**:
- Proposal-based token allowlisting
- Add/remove tokens via voting
- Direct addition by owner for initial setup
- Track when tokens were added
- Prevents unauthorized token transfers

**Core Functions**:
- `initialize(signers, threshold)` - Setup governance
- `add-token-direct(token)` - Owner directly adds token (initial setup)
- `propose-add-token(token)` - Propose adding token to allowlist
- `propose-remove-token(token)` - Propose removing token
- `vote-on-proposal(proposal-id)` - Vote on token proposal
- `execute-proposal(proposal-id)` - Execute approved proposal
- `is-token-allowed(token)` - Check if token is whitelisted

**Security Benefits**:
- Prevents interaction with malicious tokens
- Controls which assets can be transferred
- Protects against token scams
- Governance over asset exposure

---

## Integration Examples

### Example 1: Setting Up Signer Management

```clarity
;; Initialize signer manager
(contract-call? .signer-manager initialize
  (list 'ST1ALICE 'ST1BOB 'ST1CHARLIE)
  u2
)

;; Propose adding a new signer
(contract-call? .signer-manager propose-add-signer 'ST1DAVE)

;; Other signers vote
(contract-call? .signer-manager vote-proposal u0)

;; Execute when threshold met
(contract-call? .signer-manager execute-proposal u0)
```

### Example 2: Using Timelock for Secure Transfers

```clarity
;; Initialize with 2-day delay
(contract-call? .timelock initialize
  (list 'ST1ALICE 'ST1BOB 'ST1CHARLIE)
  u2
  u288  ;; ~2 days
)

;; Queue a transaction
(contract-call? .timelock queue-transaction
  u0  ;; STX transfer
  u1000000  ;; 1 STX
  'ST1RECIPIENT
  none
)

;; Second signer approves
(contract-call? .timelock approve-transaction u0)

;; Wait for delay period...
;; Mine 290 blocks

;; Execute after delay
(contract-call? .timelock execute-stx-transfer u0)
```

### Example 3: Configuring Spending Limits

```clarity
;; Initialize with STX limits
(contract-call? .spending-limits initialize
  (list 'ST1ALICE 'ST1BOB)
  u1000000000  ;; 1000 STX daily
  u5000000000  ;; 5000 STX weekly
)

;; Configure token limits
(contract-call? .spending-limits configure-token-limits
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-token
  u10000  ;; Daily token limit
  u50000  ;; Weekly token limit
)

;; Check before transfer
(contract-call? .spending-limits check-stx-transfer u500000000)
```

### Example 4: Managing Token Allowlist

```clarity
;; Initialize
(contract-call? .token-allowlist initialize
  (list 'ST1ALICE 'ST1BOB 'ST1CHARLIE)
  u2
)

;; Owner adds initial tokens
(contract-call? .token-allowlist add-token-direct
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.trusted-token
)

;; Later, signers can propose new tokens
(contract-call? .token-allowlist propose-add-token
  'ST1NEWTOKEN.new-token
)

;; Vote and execute
(contract-call? .token-allowlist vote-on-proposal u0)
(contract-call? .token-allowlist execute-proposal u0)
```

---

## Security Architecture

### Defense in Depth

The new contracts implement multiple security layers:

1. **Access Control** (All Contracts)
   - Signer verification on all operations
   - Threshold-based approvals
   - Owner-only administrative functions

2. **Time-based Security** (Timelock)
   - Mandatory delay prevents rushed decisions
   - Grace period for execution window
   - Cancellation during delay period

3. **Rate Limiting** (Spending Limits)
   - Daily caps prevent bulk withdrawals
   - Weekly caps provide additional protection
   - Per-token granular controls

4. **Asset Control** (Token Allowlist)
   - Whitelist approved tokens only
   - Prevents malicious token interactions
   - Governance over allowed assets

5. **Governance** (Signer Manager)
   - Proposal-based changes
   - Vote-based execution
   - Time-limited proposals

### Attack Mitigation

| Attack Vector | Mitigation |
|--------------|------------|
| Compromised single key | Threshold signatures required |
| Rushed malicious transaction | Timelock delay + cancellation |
| Bulk fund theft | Spending limits |
| Malicious token interaction | Token allowlist |
| Lost signer keys | Signer rotation via proposals |
| Threshold bypass attempt | Multiple validation layers |

---

## Testing

Each contract has comprehensive test coverage:

- `tests/signer-manager.test.ts` - Signer management tests
- `tests/timelock.test.ts` - Timelock functionality tests
- `tests/spending-limits.test.ts` - Spending limit tests
- `tests/token-allowlist.test.ts` - Token allowlist tests

Run all tests:
```bash
npm test
```

Run specific contract tests:
```bash
npm test signer-manager
npm test timelock
npm test spending-limits
npm test token-allowlist
```

---

## Configuration

All contracts are registered in `Clarinet.toml`:

```toml
[contracts.signer-manager]
path = 'contracts/signer-manager.clar'
clarity_version = 3
epoch = 3.1

[contracts.timelock]
path = 'contracts/timelock.clar'
clarity_version = 3
epoch = 3.1

[contracts.spending-limits]
path = 'contracts/spending-limits.clar'
clarity_version = 3
epoch = 3.1

[contracts.token-allowlist]
path = 'contracts/token-allowlist.clar'
clarity_version = 3
epoch = 3.1
```

---

## Best Practices

### Recommended Setup Sequence

1. **Deploy Core Multisig**
   ```clarity
   (contract-call? .multisig initialize
     (list 'SIGNER1 'SIGNER2 'SIGNER3)
     u2
   )
   ```

2. **Setup Signer Management**
   ```clarity
   (contract-call? .signer-manager initialize
     (list 'SIGNER1 'SIGNER2 'SIGNER3)
     u2
   )
   ```

3. **Configure Timelock** (Recommended: 2-3 days)
   ```clarity
   (contract-call? .timelock initialize
     (list 'SIGNER1 'SIGNER2 'SIGNER3)
     u2
     u288  ;; 2 days
   )
   ```

4. **Set Spending Limits**
   ```clarity
   (contract-call? .spending-limits initialize
     (list 'SIGNER1 'SIGNER2 'SIGNER3)
     u10000000000  ;; 10,000 STX daily
     u50000000000  ;; 50,000 STX weekly
   )
   ```

5. **Setup Token Allowlist**
   ```clarity
   (contract-call? .token-allowlist initialize
     (list 'SIGNER1 'SIGNER2 'SIGNER3)
     u2
   )
   ```

### Production Recommendations

- **Timelock Delay**: Use at least 2 days (288 blocks) for production
- **Spending Limits**: Set conservative limits; easier to increase than decrease
- **Token Allowlist**: Only add well-audited, trusted tokens
- **Threshold**: Use at least 2-of-3 or higher for production funds
- **Signer Count**: Maintain odd number of signers when possible
- **Key Security**: Use hardware wallets for all signers

---

## Error Codes

### Signer Manager (600-699)
- 600: Owner only
- 601: Not a signer
- 602: Invalid proposal ID
- 603: Already voted
- 604: Already executed
- 605: Threshold not met
- 606: Invalid threshold
- 607: Signer already exists
- 608: Signer does not exist
- 609: Too many signers
- 610: Cannot remove last signer
- 611: Threshold exceeds signers
- 612: Duplicate signers
- 613: Proposal expired

### Timelock (700-799)
- 700: Owner only
- 701: Not a signer
- 702: Invalid transaction ID
- 703: Already queued
- 704: Not queued
- 705: Timelock not met
- 706: Timelock expired
- 707: Already executed
- 708: Already cancelled
- 709: Invalid delay
- 710: Threshold not met
- 711: Invalid transaction type
- 712: Invalid amount

### Spending Limits (800-899)
- 800: Owner only
- 801: Not a signer
- 802: Daily limit exceeded
- 803: Weekly limit exceeded
- 804: Invalid limit
- 805: Invalid amount
- 806: Token not configured
- 807: Invalid transaction type

### Token Allowlist (900-999)
- 900: Owner only
- 901: Not a signer
- 902: Token not allowed
- 903: Token already allowed
- 904: Proposal not found
- 905: Already voted
- 906: Threshold not met
- 907: Already executed

---

## Future Enhancements

Potential additions for future versions:

1. **Batch Operations**: Execute multiple transactions atomically
2. **Recovery Mechanisms**: Social recovery for lost keys
3. **Transaction Queuing**: Priority queue for transactions
4. **Event Notifications**: On-chain events for monitoring
5. **Multi-token Transfers**: Single transaction for multiple tokens
6. **Conditional Execution**: Execute based on oracle data
7. **Scheduled Transactions**: Execute at specific block heights
8. **Fee Optimization**: Gas optimization for large multisigs

---

## Support and Documentation

- Main README: `README.md`
- Contract source: `contracts/`
- Tests: `tests/`
- Configuration: `Clarinet.toml`

For questions or issues, refer to the Stacks documentation at https://docs.stacks.co
