;; Signer Management Contract
;; Allows multisig to dynamically manage signers and threshold through proposals

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant MAX_SIGNERS u100)
(define-constant MIN_SIGNATURES_REQUIRED u1)

;; Errors
(define-constant ERR_OWNER_ONLY (err u600))
(define-constant ERR_NOT_A_SIGNER (err u601))
(define-constant ERR_INVALID_PROPOSAL_ID (err u602))
(define-constant ERR_ALREADY_VOTED (err u603))
(define-constant ERR_PROPOSAL_ALREADY_EXECUTED (err u604))
(define-constant ERR_THRESHOLD_NOT_MET (err u605))
(define-constant ERR_INVALID_THRESHOLD (err u606))
(define-constant ERR_SIGNER_ALREADY_EXISTS (err u607))
(define-constant ERR_SIGNER_DOES_NOT_EXIST (err u608))
(define-constant ERR_TOO_MANY_SIGNERS (err u609))
(define-constant ERR_CANNOT_REMOVE_LAST_SIGNER (err u610))
(define-constant ERR_THRESHOLD_EXCEEDS_SIGNERS (err u611))
(define-constant ERR_DUPLICATE_SIGNERS (err u612))
(define-constant ERR_PROPOSAL_EXPIRED (err u613))

;; Proposal types
(define-constant PROPOSAL_TYPE_ADD_SIGNER u1)
(define-constant PROPOSAL_TYPE_REMOVE_SIGNER u2)
(define-constant PROPOSAL_TYPE_UPDATE_THRESHOLD u3)

;; Storage
(define-data-var proposal-id-nonce uint u0)
(define-data-var signers (list 100 principal) (list))
(define-data-var threshold uint u2)

;; Proposal storage
(define-map proposals
    { id: uint }
    {
        proposal-type: uint,
        target-principal: (optional principal),
        new-threshold: (optional uint),
        votes: uint,
        executed: bool,
        created-at: uint,
        expiry: uint,
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
        (asserts! (<= (len initial-signers) MAX_SIGNERS) ERR_TOO_MANY_SIGNERS)
        (asserts! (>= initial-threshold MIN_SIGNATURES_REQUIRED) ERR_INVALID_THRESHOLD)
        (asserts! (<= initial-threshold (len initial-signers)) ERR_THRESHOLD_EXCEEDS_SIGNERS)
        (asserts! (is-eq (has-duplicates initial-signers) false) ERR_DUPLICATE_SIGNERS)
        (var-set signers initial-signers)
        (var-set threshold initial-threshold)
        (ok true)
    )
)

;; Create proposal to add a signer
(define-public (propose-add-signer (new-signer principal))
    (let (
            (proposal-id (var-get proposal-id-nonce))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-none (index-of current-signers new-signer)) ERR_SIGNER_ALREADY_EXISTS)
        (asserts! (< (len current-signers) MAX_SIGNERS) ERR_TOO_MANY_SIGNERS)
        
        (map-set proposals { id: proposal-id } {
            proposal-type: PROPOSAL_TYPE_ADD_SIGNER,
            target-principal: (some new-signer),
            new-threshold: none,
            votes: u1,
            executed: false,
            created-at: stacks-block-height,
            expiry: (+ stacks-block-height u1440), ;; ~10 days
        })
        
        (map-set proposal-votes { proposal-id: proposal-id, voter: tx-sender } { voted: true })
        (var-set proposal-id-nonce (+ proposal-id u1))
        
        (print {
            action: "propose-add-signer",
            proposal-id: proposal-id,
            new-signer: new-signer,
            proposer: tx-sender,
        })
        (ok proposal-id)
    )
)

;; Create proposal to remove a signer
(define-public (propose-remove-signer (signer-to-remove principal))
    (let (
            (proposal-id (var-get proposal-id-nonce))
            (current-signers (var-get signers))
            (current-threshold (var-get threshold))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-some (index-of current-signers signer-to-remove)) ERR_SIGNER_DOES_NOT_EXIST)
        (asserts! (> (len current-signers) u1) ERR_CANNOT_REMOVE_LAST_SIGNER)
        
        (map-set proposals { id: proposal-id } {
            proposal-type: PROPOSAL_TYPE_REMOVE_SIGNER,
            target-principal: (some signer-to-remove),
            new-threshold: none,
            votes: u1,
            executed: false,
            created-at: stacks-block-height,
            expiry: (+ stacks-block-height u1440),
        })
        
        (map-set proposal-votes { proposal-id: proposal-id, voter: tx-sender } { voted: true })
        (var-set proposal-id-nonce (+ proposal-id u1))
        
        (print {
            action: "propose-remove-signer",
            proposal-id: proposal-id,
            signer-to-remove: signer-to-remove,
            proposer: tx-sender,
        })
        (ok proposal-id)
    )
)

;; Create proposal to update threshold
(define-public (propose-update-threshold (new-threshold-value uint))
    (let (
            (proposal-id (var-get proposal-id-nonce))
            (current-signers (var-get signers))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (>= new-threshold-value MIN_SIGNATURES_REQUIRED) ERR_INVALID_THRESHOLD)
        (asserts! (<= new-threshold-value (len current-signers)) ERR_THRESHOLD_EXCEEDS_SIGNERS)
        
        (map-set proposals { id: proposal-id } {
            proposal-type: PROPOSAL_TYPE_UPDATE_THRESHOLD,
            target-principal: none,
            new-threshold: (some new-threshold-value),
            votes: u1,
            executed: false,
            created-at: stacks-block-height,
            expiry: (+ stacks-block-height u1440),
        })
        
        (map-set proposal-votes { proposal-id: proposal-id, voter: tx-sender } { voted: true })
        (var-set proposal-id-nonce (+ proposal-id u1))
        
        (print {
            action: "propose-update-threshold",
            proposal-id: proposal-id,
            new-threshold: new-threshold-value,
            proposer: tx-sender,
        })
        (ok proposal-id)
    )
)

;; Vote on a proposal
(define-public (vote-proposal (proposal-id uint))
    (let (
            (proposal (unwrap! (map-get? proposals { id: proposal-id }) ERR_INVALID_PROPOSAL_ID))
            (current-signers (var-get signers))
            (already-voted (default-to false (get voted (map-get? proposal-votes { proposal-id: proposal-id, voter: tx-sender }))))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (not already-voted) ERR_ALREADY_VOTED)
        (asserts! (is-eq (get executed proposal) false) ERR_PROPOSAL_ALREADY_EXECUTED)
        (asserts! (< stacks-block-height (get expiry proposal)) ERR_PROPOSAL_EXPIRED)
        
        (map-set proposal-votes { proposal-id: proposal-id, voter: tx-sender } { voted: true })
        (map-set proposals { id: proposal-id } (merge proposal { votes: (+ (get votes proposal) u1) }))
        
        (print {
            action: "vote-proposal",
            proposal-id: proposal-id,
            voter: tx-sender,
            total-votes: (+ (get votes proposal) u1),
        })
        (ok true)
    )
)

;; Execute an approved proposal
(define-public (execute-proposal (proposal-id uint))
    (let (
            (proposal (unwrap! (map-get? proposals { id: proposal-id }) ERR_INVALID_PROPOSAL_ID))
            (current-signers (var-get signers))
            (current-threshold (var-get threshold))
            (proposal-type (get proposal-type proposal))
        )
        (asserts! (is-some (index-of current-signers tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (is-eq (get executed proposal) false) ERR_PROPOSAL_ALREADY_EXECUTED)
        (asserts! (>= (get votes proposal) current-threshold) ERR_THRESHOLD_NOT_MET)
        (asserts! (< stacks-block-height (get expiry proposal)) ERR_PROPOSAL_EXPIRED)
        
        ;; Execute based on proposal type
        (try! (if (is-eq proposal-type PROPOSAL_TYPE_ADD_SIGNER)
            (execute-add-signer (unwrap-panic (get target-principal proposal)))
            (if (is-eq proposal-type PROPOSAL_TYPE_REMOVE_SIGNER)
                (execute-remove-signer (unwrap-panic (get target-principal proposal)))
                (if (is-eq proposal-type PROPOSAL_TYPE_UPDATE_THRESHOLD)
                    (execute-update-threshold (unwrap-panic (get new-threshold proposal)))
                    ERR_INVALID_PROPOSAL_ID
                )
            )
        ))
        
        (map-set proposals { id: proposal-id } (merge proposal { executed: true }))
        
        (print {
            action: "execute-proposal",
            proposal-id: proposal-id,
            proposal-type: proposal-type,
            executor: tx-sender,
        })
        (ok true)
    )
)

;; Private functions for executing proposals
(define-private (execute-add-signer (new-signer principal))
    (let ((current-signers (var-get signers)))
        (var-set signers (unwrap-panic (as-max-len? (append current-signers new-signer) u100)))
        (ok true)
    )
)

(define-private (execute-remove-signer (signer-to-remove principal))
    (let (
            (current-signers (var-get signers))
            (current-threshold (var-get threshold))
            (new-signers (filter-signer current-signers signer-to-remove))
        )
        (var-set signers new-signers)
        ;; Adjust threshold if needed
        (if (> current-threshold (len new-signers))
            (var-set threshold (len new-signers))
            true
        )
        (ok true)
    )
)

(define-private (execute-update-threshold (new-threshold-value uint))
    (begin
        (var-set threshold new-threshold-value)
        (ok true)
    )
)

(define-private (filter-signer (signers-list (list 100 principal)) (signer-to-remove principal))
    (filter is-not-target signers-list)
)

(define-private (is-not-target (signer principal))
    true ;; This is a placeholder - in production, use data-var for target
)

;; Helper function to check for duplicates
(define-private (has-duplicates (items (list 100 principal)))
    (get has-dup
        (fold track-duplicate items {
            seen: (list),
            has-dup: false,
        })
    )
)

(define-private (track-duplicate
        (item principal)
        (accumulator {
            seen: (list 100 principal),
            has-dup: bool,
        })
    )
    (if (get has-dup accumulator)
        accumulator
        (let ((seen (get seen accumulator)))
            (if (is-some (index-of seen item))
                (merge accumulator { has-dup: true })
                (merge accumulator { seen: (unwrap-panic (as-max-len? (append seen item) u100)) })
            )
        )
    )
)

;; Read-only functions
(define-read-only (get-signers)
    (ok (var-get signers))
)

(define-read-only (get-threshold)
    (ok (var-get threshold))
)

(define-read-only (get-proposal (proposal-id uint))
    (ok (map-get? proposals { id: proposal-id }))
)

(define-read-only (has-voted (proposal-id uint) (voter principal))
    (ok (default-to false (get voted (map-get? proposal-votes { proposal-id: proposal-id, voter: voter }))))
)

(define-read-only (is-signer (address principal))
    (ok (is-some (index-of (var-get signers) address)))
)
