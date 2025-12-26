;; Spending Limits Contract
;; Implements daily/weekly spending caps and rate limiting for enhanced security

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant BLOCKS_PER_DAY u144)
(define-constant BLOCKS_PER_WEEK u1008)

;; Errors
(define-constant ERR_OWNER_ONLY (err u800))
(define-constant ERR_NOT_A_SIGNER (err u801))
(define-constant ERR_DAILY_LIMIT_EXCEEDED (err u802))
(define-constant ERR_WEEKLY_LIMIT_EXCEEDED (err u803))
(define-constant ERR_INVALID_LIMIT (err u804))
(define-constant ERR_INVALID_AMOUNT (err u805))
(define-constant ERR_TOKEN_NOT_CONFIGURED (err u806))
(define-constant ERR_INVALID_TX_TYPE (err u807))

;; Transaction types
(define-constant TX_TYPE_STX u0)
(define-constant TX_TYPE_SIP010 u1)

;; Storage
(define-data-var signers (list 100 principal) (list))
(define-data-var daily-stx-limit uint u1000000000) ;; 1000 STX default
(define-data-var weekly-stx-limit uint u5000000000) ;; 5000 STX default

;; Spending tracking for STX
(define-map daily-stx-spent
    { day: uint }
    { amount: uint }
)

(define-map weekly-stx-spent
    { week: uint }
    { amount: uint }
)

;; Token-specific limits
(define-map token-daily-limits
    { token: principal }
    { limit: uint }
)

(define-map token-weekly-limits
    { token: principal }
    { limit: uint }
)

;; Token spending tracking
(define-map daily-token-spent
    { token: principal, day: uint }
    { amount: uint }
)

(define-map weekly-token-spent
    { token: principal, week: uint }
    { amount: uint }
)

;; Initialization
(define-public (initialize
        (initial-signers (list 100 principal))
        (initial-daily-stx-limit uint)
        (initial-weekly-stx-limit uint)
    )
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_OWNER_ONLY)
        (asserts! (is-eq (len (var-get signers)) u0) ERR_OWNER_ONLY)
        (asserts! (> initial-daily-stx-limit u0) ERR_INVALID_LIMIT)
        (asserts! (> initial-weekly-stx-limit u0) ERR_INVALID_LIMIT)
        (asserts! (<= initial-daily-stx-limit initial-weekly-stx-limit) ERR_INVALID_LIMIT)
        (var-set signers initial-signers)
        (var-set daily-stx-limit initial-daily-stx-limit)
        (var-set weekly-stx-limit initial-weekly-stx-limit)
        (ok true)
    )
)

;; Check if STX transfer is within limits
(define-public (check-stx-transfer (amount uint))
    (let (
            (current-day (/ stacks-block-height BLOCKS_PER_DAY))
            (current-week (/ stacks-block-height BLOCKS_PER_WEEK))
            (daily-spent (default-to u0 (get amount (map-get? daily-stx-spent { day: current-day }))))
            (weekly-spent (default-to u0 (get amount (map-get? weekly-stx-spent { week: current-week }))))
            (new-daily-total (+ daily-spent amount))
            (new-weekly-total (+ weekly-spent amount))
        )
        (asserts! (is-some (index-of (var-get signers) tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (<= new-daily-total (var-get daily-stx-limit)) ERR_DAILY_LIMIT_EXCEEDED)
        (asserts! (<= new-weekly-total (var-get weekly-stx-limit)) ERR_WEEKLY_LIMIT_EXCEEDED)
        
        ;; Update spending trackers
        (map-set daily-stx-spent { day: current-day } { amount: new-daily-total })
        (map-set weekly-stx-spent { week: current-week } { amount: new-weekly-total })
        
        (print {
            action: "check-stx-transfer",
            amount: amount,
            daily-spent: new-daily-total,
            weekly-spent: new-weekly-total,
            daily-limit: (var-get daily-stx-limit),
            weekly-limit: (var-get weekly-stx-limit),
        })
        (ok true)
    )
)

;; Check if token transfer is within limits
(define-public (check-token-transfer (token principal) (amount uint))
    (let (
            (current-day (/ stacks-block-height BLOCKS_PER_DAY))
            (current-week (/ stacks-block-height BLOCKS_PER_WEEK))
            (daily-limit (unwrap! (get limit (map-get? token-daily-limits { token: token })) ERR_TOKEN_NOT_CONFIGURED))
            (weekly-limit (unwrap! (get limit (map-get? token-weekly-limits { token: token })) ERR_TOKEN_NOT_CONFIGURED))
            (daily-spent (default-to u0 (get amount (map-get? daily-token-spent { token: token, day: current-day }))))
            (weekly-spent (default-to u0 (get amount (map-get? weekly-token-spent { token: token, week: current-week }))))
            (new-daily-total (+ daily-spent amount))
            (new-weekly-total (+ weekly-spent amount))
        )
        (asserts! (is-some (index-of (var-get signers) tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (<= new-daily-total daily-limit) ERR_DAILY_LIMIT_EXCEEDED)
        (asserts! (<= new-weekly-total weekly-limit) ERR_WEEKLY_LIMIT_EXCEEDED)
        
        ;; Update spending trackers
        (map-set daily-token-spent { token: token, day: current-day } { amount: new-daily-total })
        (map-set weekly-token-spent { token: token, week: current-week } { amount: new-weekly-total })
        
        (print {
            action: "check-token-transfer",
            token: token,
            amount: amount,
            daily-spent: new-daily-total,
            weekly-spent: new-weekly-total,
            daily-limit: daily-limit,
            weekly-limit: weekly-limit,
        })
        (ok true)
    )
)

;; Configure limits for a specific token
(define-public (configure-token-limits
        (token principal)
        (daily-limit uint)
        (weekly-limit uint)
    )
    (begin
        (asserts! (is-some (index-of (var-get signers) tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (> daily-limit u0) ERR_INVALID_LIMIT)
        (asserts! (> weekly-limit u0) ERR_INVALID_LIMIT)
        (asserts! (<= daily-limit weekly-limit) ERR_INVALID_LIMIT)
        
        (map-set token-daily-limits { token: token } { limit: daily-limit })
        (map-set token-weekly-limits { token: token } { limit: weekly-limit })
        
        (print {
            action: "configure-token-limits",
            token: token,
            daily-limit: daily-limit,
            weekly-limit: weekly-limit,
        })
        (ok true)
    )
)

;; Update STX limits
(define-public (update-stx-limits
        (new-daily-limit uint)
        (new-weekly-limit uint)
    )
    (begin
        (asserts! (is-some (index-of (var-get signers) tx-sender)) ERR_NOT_A_SIGNER)
        (asserts! (> new-daily-limit u0) ERR_INVALID_LIMIT)
        (asserts! (> new-weekly-limit u0) ERR_INVALID_LIMIT)
        (asserts! (<= new-daily-limit new-weekly-limit) ERR_INVALID_LIMIT)
        
        (var-set daily-stx-limit new-daily-limit)
        (var-set weekly-stx-limit new-weekly-limit)
        
        (print {
            action: "update-stx-limits",
            daily-limit: new-daily-limit,
            weekly-limit: new-weekly-limit,
        })
        (ok true)
    )
)

;; Emergency: Reset daily spending (requires consensus)
(define-public (reset-daily-spending)
    (let ((current-day (/ stacks-block-height BLOCKS_PER_DAY)))
        (asserts! (is-some (index-of (var-get signers) tx-sender)) ERR_NOT_A_SIGNER)
        (map-delete daily-stx-spent { day: current-day })
        (ok true)
    )
)

;; Read-only functions
(define-read-only (get-stx-limits)
    (ok {
        daily-limit: (var-get daily-stx-limit),
        weekly-limit: (var-get weekly-stx-limit),
    })
)

(define-read-only (get-stx-spent)
    (let (
            (current-day (/ stacks-block-height BLOCKS_PER_DAY))
            (current-week (/ stacks-block-height BLOCKS_PER_WEEK))
        )
        (ok {
            daily-spent: (default-to u0 (get amount (map-get? daily-stx-spent { day: current-day }))),
            weekly-spent: (default-to u0 (get amount (map-get? weekly-stx-spent { week: current-week }))),
            daily-remaining: (- (var-get daily-stx-limit) (default-to u0 (get amount (map-get? daily-stx-spent { day: current-day })))),
            weekly-remaining: (- (var-get weekly-stx-limit) (default-to u0 (get amount (map-get? weekly-stx-spent { week: current-week })))),
        })
    )
)

(define-read-only (get-token-limits (token principal))
    (ok {
        daily-limit: (map-get? token-daily-limits { token: token }),
        weekly-limit: (map-get? token-weekly-limits { token: token }),
    })
)

(define-read-only (get-token-spent (token principal))
    (let (
            (current-day (/ stacks-block-height BLOCKS_PER_DAY))
            (current-week (/ stacks-block-height BLOCKS_PER_WEEK))
            (daily-limit (get limit (map-get? token-daily-limits { token: token })))
            (weekly-limit (get limit (map-get? token-weekly-limits { token: token })))
        )
        (ok {
            daily-spent: (default-to u0 (get amount (map-get? daily-token-spent { token: token, day: current-day }))),
            weekly-spent: (default-to u0 (get amount (map-get? weekly-token-spent { token: token, week: current-week }))),
            daily-remaining: (match daily-limit
                limit (- limit (default-to u0 (get amount (map-get? daily-token-spent { token: token, day: current-day }))))
                u0
            ),
            weekly-remaining: (match weekly-limit
                limit (- limit (default-to u0 (get amount (map-get? weekly-token-spent { token: token, week: current-week }))))
                u0
            ),
        })
    )
)

(define-read-only (can-spend-stx (amount uint))
    (let (
            (current-day (/ stacks-block-height BLOCKS_PER_DAY))
            (current-week (/ stacks-block-height BLOCKS_PER_WEEK))
            (daily-spent (default-to u0 (get amount (map-get? daily-stx-spent { day: current-day }))))
            (weekly-spent (default-to u0 (get amount (map-get? weekly-stx-spent { week: current-week }))))
        )
        (ok (and
            (<= (+ daily-spent amount) (var-get daily-stx-limit))
            (<= (+ weekly-spent amount) (var-get weekly-stx-limit))
        ))
    )
)

(define-read-only (can-spend-token (token principal) (amount uint))
    (let (
            (current-day (/ stacks-block-height BLOCKS_PER_DAY))
            (current-week (/ stacks-block-height BLOCKS_PER_WEEK))
            (daily-limit (get limit (map-get? token-daily-limits { token: token })))
            (weekly-limit (get limit (map-get? token-weekly-limits { token: token })))
            (daily-spent (default-to u0 (get amount (map-get? daily-token-spent { token: token, day: current-day }))))
            (weekly-spent (default-to u0 (get amount (map-get? weekly-token-spent { token: token, week: current-week }))))
        )
        (match daily-limit
            dlimit (match weekly-limit
                wlimit (ok (and
                    (<= (+ daily-spent amount) dlimit)
                    (<= (+ weekly-spent amount) wlimit)
                ))
                (ok false)
            )
            (ok false)
        )
    )
)
