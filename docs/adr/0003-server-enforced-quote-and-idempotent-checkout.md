# The server enforces Quote freshness and Checkout Attempt idempotency

A Quote has an `id`, a `hash` of its lines, Prices, Coupon and Network Fee, and an `expiresAt`. Creating an Order requires a `quoteId` and an `Idempotency-Key` header. The mock server answers `409 QUOTE_STALE` if anything behind the hash changed. It returns the same Order when a key is reused with the same content, and `409 IDEMPOTENCY_CONFLICT` when a key is reused with different content. The client generates one key per Checkout Attempt and stores it in `sessionStorage` together with the quote hash and the Order id once known. Recovery after a timeout, refresh or reconnect resends the same key.

We chose server enforcement over client-side checks because the challenge's eliminatory items ("confirmed purchase without a simulation response", duplicate orders) must hold even when the UI is wrong or the network drops between the request and the response.
