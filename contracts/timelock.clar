;; Timelock Contract
;; Adds a delay period between transaction approval and execution for enhanced security

(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant MIN_DELAY u144) ;; ~1 day in blocks
(define-constant MAX_DELAY u4320) ;; ~30 days in blocks
(define-constant GRACE_PERIOD u288) ;; ~2 days to execute after delay

;; Errors
(define-constant ERR_OWNER_ONLY (err u700))
(define-constant ERR_NOT_A_SIGNER (err u701))
(define-constant ERR_INVALID_TX_ID (err u702))
(define-constant ERR_ALREADY_QUEUED (err u703))
(define-constant ERR_NOT_QUEUED (err u704))
(define-constant ERR_TIMELOCK_NOT_MET (err u705))
(define-constant ERR_TIMELOCK_EXPIRED (err u706))
(define-constant ERR_ALREADY_EXECUTED (err u707))
(define-constant ERR_ALREADY_CANCELLED (err u708))
(define-constant ERR_INVALID_DELAY (err u709))
(define-constant ERR_THRESHOLD_NOT_MET (err u710))
(define-constant ERR_INVALID_TX_TYPE (err u711))
(define-constant ERR_INVALID_AMOUNT (err u712))

;; Transaction types
(define-constant TX_TYPE_STX u0)
(define-constant TX_TYPE_SIP010 u1)

;; Storage
(define-data-var signers (list 100 principal) (list))
(define-data-var threshold uint u2)
(define-data-var delay uint u144) ;; Default 1 day
(define-data-var tx-nonce uint u0)

;; Queued transaction storage
(define-map queued-transactions
    { id: uint }
    {
        tx-type: uint,
        amount: uint,
        recipient: principal,
        token: (optional principal),
        queued-at: uint,
        execute-after: uint,
        expires-at: uint,
        approvals: uint,
        executed: bool,
        cancelled: bool,
    }
)

;; Approval tracking
(define-map transaction-approvals
    { tx-id: uint, approver: principal }
    { approved: bool }
)

;; Initialization
(define-public (initialize
        (initial-signers (list 100 principal))
        (initial-threshold uint)
        (initial-delay uint)
    )
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
        (asserts! (is-eq (len (var-get signers)) u0) ERR_OWNER_ONLY)
        (asserts! (>= initial-delay MIN_DELAY) ERR_INVALID_DELAY)
        (asserts! (<= initial-delay MAX_DELAY) ERR_INVALID_DELAY)
        (var-set signers initial-signers)
        (var-set threshold initial-threshold)
        (var-set delay initial-delay)
        (ok true)
    )
)

;; Queue a new transaction
(define-public (queue-transaction
        (tx-type uint)
        (amount uint)
        (recipient principal)
        (token (optional principal))
    )
    (let (
            (tx-id (var-get tx-nonce))
            (current-delay (var-get delay))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (or (is-eq tx-type TX_TYPE_STX) (is-eq tx-type TX_TYPE_SIP010)) ERR_INVALID_TX_TYPE)
        
        (map-set queued-transactions { id: tx-id } {
            tx-type: tx-type,
            amount: amount,
            recipient: recipient,
            token: token,
            queued-at: stacks-block-height,
            execute-after: (+ stacks-block-height current-delay),
            expires-at: (+ stacks-block-height current-delay GRACE_PERIOD),
            approvals: u1,
            executed: false,
            cancelled: false,
        })
        
        (map-set transaction-approvals { tx-id: tx-id, approver: tx-sender } { approved: true })
        (var-set tx-nonce (+ tx-id u1))
        
        (print {
            action: "queue-transaction",
            tx-id: tx-id,
            tx-type: tx-type,
            amount: amount,
            recipient: recipient,
            execute-after: (+ stacks-block-height current-delay),
            queuer: tx-sender,
        })
        (ok tx-id)
    )
)

;; Approve a queued transaction
(define-public (approve-transaction (tx-id uint))
    (let (
            (tx (unwrap! (map-get? queued-transactions { id: tx-id }) ERR_INVALID_TX_ID))
            (current-signers (var-get signers))
            (already-approved (default-to false (get approved (map-get? transaction-approvals { tx-id: tx-id, approver: tx-sender }))))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (not already-approved) ERR_ALREADY_QUEUED)
        (asserts! (is-eq (get executed tx) false) ERR_ALREADY_EXECUTED)
        (asserts! (is-eq (get cancelled tx) false) ERR_ALREADY_CANCELLED)
        
        (map-set transaction-approvals { tx-id: tx-id, approver: tx-sender } { approved: true })
        (map-set queued-transactions { id: tx-id } (merge tx { approvals: (+ (get approvals tx) u1) }))
        
        (print {
            action: "approve-transaction",
            tx-id: tx-id,
            approver: tx-sender,
            total-approvals: (+ (get approvals tx) u1),
        })
        (ok true)
    )
)

;; Execute STX transfer after timelock
(define-public (execute-stx-transfer (tx-id uint))
    (let (
            (tx (unwrap! (map-get? queued-transactions { id: tx-id }) ERR_INVALID_TX_ID))
            (current-threshold (var-get threshold))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-eq (get tx-type tx) TX_TYPE_STX) ERR_INVALID_TX_TYPE)
        (asserts! (is-eq (get executed tx) false) ERR_ALREADY_EXECUTED)
        (asserts! (is-eq (get cancelled tx) false) ERR_ALREADY_CANCELLED)
        (asserts! (>= (get approvals tx) current-threshold) ERR_THRESHOLD_NOT_MET)
        (asserts! (>= stacks-block-height (get execute-after tx)) ERR_TIMELOCK_NOT_MET)
        (asserts! (< stacks-block-height (get expires-at tx)) ERR_TIMELOCK_EXPIRED)
        
        (try! (as-contract (stx-transfer? (get amount tx) tx-sender (get recipient tx))))
        (map-set queued-transactions { id: tx-id } (merge tx { executed: true }))
        
        (print {
            action: "execute-stx-transfer",
            tx-id: tx-id,
            amount: (get amount tx),
            recipient: (get recipient tx),
            executor: tx-sender,
        })
        (ok true)
    )
)

;; Execute SIP-010 token transfer after timelock
(define-public (execute-token-transfer
        (tx-id uint)
        (token <ft-trait>)
    )
    (let (
            (tx (unwrap! (map-get? queued-transactions { id: tx-id }) ERR_INVALID_TX_ID))
            (current-threshold (var-get threshold))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-eq (get tx-type tx) TX_TYPE_SIP010) ERR_INVALID_TX_TYPE)
        (asserts! (is-eq (get executed tx) false) ERR_ALREADY_EXECUTED)
        (asserts! (is-eq (get cancelled tx) false) ERR_ALREADY_CANCELLED)
        (asserts! (>= (get approvals tx) current-threshold) ERR_THRESHOLD_NOT_MET)
        (asserts! (>= stacks-block-height (get execute-after tx)) ERR_TIMELOCK_NOT_MET)
        (asserts! (< stacks-block-height (get expires-at tx)) ERR_TIMELOCK_EXPIRED)
        (asserts! (is-eq (unwrap-panic (get token tx)) (contract-of token)) ERR_INVALID_TX_TYPE)
        
        (try! (as-contract (contract-call? token transfer (get amount tx) tx-sender (get recipient tx) none)))
        (map-set queued-transactions { id: tx-id } (merge tx { executed: true }))
        
        (print {
            action: "execute-token-transfer",
            tx-id: tx-id,
            amount: (get amount tx),
            recipient: (get recipient tx),
            token: (contract-of token),
            executor: tx-sender,
        })
        (ok true)
    )
)

;; Cancel a queued transaction (requires threshold approvals)
(define-public (cancel-transaction (tx-id uint))
    (let (
            (tx (unwrap! (map-get? queued-transactions { id: tx-id }) ERR_INVALID_TX_ID))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-eq (get executed tx) false) ERR_ALREADY_EXECUTED)
        (asserts! (is-eq (get cancelled tx) false) ERR_ALREADY_CANCELLED)
        
        (map-set queued-transactions { id: tx-id } (merge tx { cancelled: true }))
        
        (print {
            action: "cancel-transaction",
            tx-id: tx-id,
            canceller: tx-sender,
        })
        (ok true)
    )
)

;; Update delay period (requires owner)
(define-public (update-delay (new-delay uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
        (asserts! (>= new-delay MIN_DELAY) ERR_INVALID_DELAY)
        (asserts! (<= new-delay MAX_DELAY) ERR_INVALID_DELAY)
        (var-set delay new-delay)
        (ok true)
    )
)

;; Read-only functions
(define-read-only (get-transaction (tx-id uint))
    (ok (map-get? queued-transactions { id: tx-id }))
)

(define-read-only (get-delay)
    (ok (var-get delay))
)

(define-read-only (get-signers)
    (ok (var-get signers))
)

(define-read-only (get-threshold)
    (ok (var-get threshold))
)

(define-read-only (has-approved (tx-id uint) (approver principal))
    (ok (default-to false (get approved (map-get? transaction-approvals { tx-id: tx-id, approver: approver }))))
)

(define-read-only (can-execute (tx-id uint))
    (match (map-get? queued-transactions { id: tx-id })
        tx (ok (and
            (is-eq (get executed tx) false)
            (is-eq (get cancelled tx) false)
            (>= (get approvals tx) (var-get threshold))
            (>= stacks-block-height (get execute-after tx))
            (< stacks-block-height (get expires-at tx))
        ))
        (ok false)
    )
)
