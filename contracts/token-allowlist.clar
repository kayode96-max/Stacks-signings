;; Token Allowlist Contract
;; Manages a whitelist of approved SIP-010 tokens for multisig transfers

;; Constants
(define-constant CONTRACT_OWNER tx-sender)

;; Errors
(define-constant ERR_OWNER_ONLY (err u900))
(define-constant ERR_NOT_A_SIGNER (err u901))
(define-constant ERR_TOKEN_NOT_ALLOWED (err u902))
(define-constant ERR_TOKEN_ALREADY_ALLOWED (err u903))
(define-constant ERR_PROPOSAL_NOT_FOUND (err u904))
(define-constant ERR_ALREADY_VOTED (err u905))
(define-constant ERR_THRESHOLD_NOT_MET (err u906))
(define-constant ERR_ALREADY_EXECUTED (err u907))

;; Proposal actions
(define-constant ACTION_ADD u1)
(define-constant ACTION_REMOVE u2)

;; Storage
(define-data-var signers (list 100 principal) (list))
(define-data-var threshold uint u2)
(define-data-var proposal-nonce uint u0)

;; Allowlist storage
(define-map allowed-tokens
    { token: principal }
    { allowed: bool, added-at: uint }
)

;; Proposal storage for adding/removing tokens
(define-map token-proposals
    { id: uint }
    {
        action: uint,
        token: principal,
        votes: uint,
        executed: bool,
        created-at: uint,
    }
)

;; Vote tracking
(define-map proposal-votes
    { proposal-id: uint, voter: principal }
    { voted: bool }
)

;; Initialization
(define-public (initialize
        (initial-signers (list 100 principal))
        (initial-threshold uint)
    )
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
        (asserts! (is-eq (len (var-get signers)) u0) ERR_OWNER_ONLY)
        (var-set signers initial-signers)
        (var-set threshold initial-threshold)
        (ok true)
    )
)

;; Propose adding a token to the allowlist
(define-public (propose-add-token (token principal))
    (let (
            (proposal-id (var-get proposal-nonce))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-none (map-get? allowed-tokens { token: token })) ERR_TOKEN_ALREADY_ALLOWED)
        
        (map-set token-proposals { id: proposal-id } {
            action: ACTION_ADD,
            token: token,
            votes: u1,
            executed: false,
            created-at: stacks-block-height,
        })
        
        (map-set proposal-votes { proposal-id: proposal-id, voter: tx-sender } { voted: true })
        (var-set proposal-nonce (+ proposal-id u1))
        
        (print {
            action: "propose-add-token",
            proposal-id: proposal-id,
            token: token,
            proposer: tx-sender,
        })
        (ok proposal-id)
    )
)

;; Propose removing a token from the allowlist
(define-public (propose-remove-token (token principal))
    (let (
            (proposal-id (var-get proposal-nonce))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (default-to false (get allowed (map-get? allowed-tokens { token: token }))) ERR_TOKEN_NOT_ALLOWED)
        
        (map-set token-proposals { id: proposal-id } {
            action: ACTION_REMOVE,
            token: token,
            votes: u1,
            executed: false,
            created-at: stacks-block-height,
        })
        
        (map-set proposal-votes { proposal-id: proposal-id, voter: tx-sender } { voted: true })
        (var-set proposal-nonce (+ proposal-id u1))
        
        (print {
            action: "propose-remove-token",
            proposal-id: proposal-id,
            token: token,
            proposer: tx-sender,
        })
        (ok proposal-id)
    )
)

;; Vote on a token proposal
(define-public (vote-on-proposal (proposal-id uint))
    (let (
            (proposal (unwrap! (map-get? token-proposals { id: proposal-id }) ERR_PROPOSAL_NOT_FOUND))
            (current-signers (var-get signers))
            (has-voted (default-to false (get voted (map-get? proposal-votes { proposal-id: proposal-id, voter: tx-sender }))))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (not has-voted) ERR_ALREADY_VOTED)
        (asserts! (is-eq (get executed proposal) false) ERR_ALREADY_EXECUTED)
        
        (map-set proposal-votes { proposal-id: proposal-id, voter: tx-sender } { voted: true })
        (map-set token-proposals { id: proposal-id } (merge proposal { votes: (+ (get votes proposal) u1) }))
        
        (print {
            action: "vote-on-proposal",
            proposal-id: proposal-id,
            voter: tx-sender,
            total-votes: (+ (get votes proposal) u1),
        })
        (ok true)
    )
)

;; Execute a token proposal
(define-public (execute-proposal (proposal-id uint))
    (let (
            (proposal (unwrap! (map-get? token-proposals { id: proposal-id }) ERR_PROPOSAL_NOT_FOUND))
            (current-threshold (var-get threshold))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-eq (get executed proposal) false) ERR_ALREADY_EXECUTED)
        (asserts! (>= (get votes proposal) current-threshold) ERR_THRESHOLD_NOT_MET)
        
        ;; Execute based on action type
        (if (is-eq (get action proposal) ACTION_ADD)
            (map-set allowed-tokens { token: (get token proposal) } { allowed: true, added-at: stacks-block-height })
            (map-delete allowed-tokens { token: (get token proposal) })
        )
        
        (map-set token-proposals { id: proposal-id } (merge proposal { executed: true }))
        
        (print {
            action: "execute-proposal",
            proposal-id: proposal-id,
            proposal-action: (get action proposal),
            token: (get token proposal),
            executor: tx-sender,
        })
        (ok true)
    )
)

;; Directly add a token (owner only, for initial setup)
(define-public (add-token-direct (token principal))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
        (asserts! (is-none (map-get? allowed-tokens { token: token })) ERR_TOKEN_ALREADY_ALLOWED)
        (map-set allowed-tokens { token: token } { allowed: true, added-at: stacks-block-height })
        (ok true)
    )
)

;; Read-only functions
(define-read-only (is-token-allowed (token principal))
    (ok (default-to false (get allowed (map-get? allowed-tokens { token: token }))))
)

(define-read-only (get-token-info (token principal))
    (ok (map-get? allowed-tokens { token: token }))
)

(define-read-only (get-proposal (proposal-id uint))
    (ok (map-get? token-proposals { id: proposal-id }))
)

(define-read-only (has-voted-on-proposal (proposal-id uint) (voter principal))
    (ok (default-to false (get voted (map-get? proposal-votes { proposal-id: proposal-id, voter: voter }))))
)

(define-read-only (get-signers)
    (ok (var-get signers))
)

(define-read-only (get-threshold)
    (ok (var-get threshold))
)
