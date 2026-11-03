# Module design

How the code is split into deep modules: small interfaces with a lot of behavior behind them. Each module lists its **interface** (everything a caller has to know), the **seam** where that interface lives, and how it is tested. Terms follow [GLOSSARY.md](../GLOSSARY.md). Decisions follow [decisions.md](./decisions.md).

## Layout

```
src/
  contracts/          Zod schemas: REST bodies, events, errors, form inputs. No behavior.
  lib/
    money/            ETH math (in-process)
    i18n/             typed dictionaries + t()
  mocks/              THE SIMULATED BACKEND. App code never imports from here (lint rule).
    world/            domain rules + mock DB + Scenarios; pure, with clock/storage/ids injected
    http/             MSW REST handlers: thin adapters, HTTP ↔ world
    realtime/         Socket.IO binding adapter: connections, pings, routing events to the right Collector
    control.ts        Mock Control interface (shared by the Mock Lab and window.__mock)
    lab/              Mock Lab panel (lazy-loaded)
    start.ts          boots the worker, then resolves; the only entry point into mocks/
  app/
    api/              Axios client, typed endpoints, ApiError
    query/            QueryClient, key factory, cache/retry policy
    session/          Zustand store + session lifecycle
    realtime/         socket client + event reconciler
  features/           catalog/ nft/ favorites/ cart/ checkout/ orders/ auth/ profile/ wallets/
                      each owns its queryOptions, mutations, components and hooks
  routes/             TanStack Router file routes: thin; loaders call ensureQueryData
  ui/                 shadcn components themed to Kurio, Skeleton, Announcer, layout
```

**Dependency direction:** `routes → features → app → contracts/lib`. `mocks → contracts/lib` only. `main.tsx` is the single place that knows mocks exist: `if (VITE_MOCKS) await import('./mocks/start')`, then it renders and starts realtime.

---

## 1. Mock World: `src/mocks/world/` (the deepest module)

The whole simulated backend: Collectors, Sessions, catalog, Favorites, Carts, Coupons, Quotes, Orders, profile, Wallets, Wallet Connections, Scenarios and network conditions.

**Interface**
```ts
createWorld(deps: { storage: KeyValueStore; clock: Clock; ids: IdSource }): World

world.exec(command)                 // all REST-backed operations, typed by contracts
  → Result<Response, DomainError>   // DomainError maps 1:1 to HTTP status + error code
world.subscribe(listener: (e: { event: RealtimeEvent; audience: 'all' | CollectorId }) => void)
world.control                       // Mock Control: see §2
```

**Invariants callers rely on**
- Every state change goes through `exec` or `control`, is saved, and emits its events after the change is committed. REST and events can never disagree (ADR 0001).
- `exec` is deterministic given the Scenario, the clock and the id source.
- Domain errors are values, not exceptions.

**Seam and tests:** this module is in-process. Vitest drives it with an in-memory `storage`, a fake `clock` and sequential `ids`, through `exec` and `control` only. Business rules get most of their coverage here: Guest Cart merge, Coupon validity, Quote hash, `QUOTE_STALE`, idempotency, Order lifecycle, per-Collector isolation. The MSW handlers in `mocks/http/` are thin adapters: they parse the request, call `exec`, and serialize the result. They add network conditions (latency, failure injection) but no rules.

## 2. Mock Control: `src/mocks/control.ts`

A **real seam with two adapters**: the Mock Lab panel (for people) and `window.__mock` (for Playwright).

**Interface**
```ts
selectScenario(name: ScenarioName, opts?: { reset?: boolean })
reset()
setNetwork(profile: 'normal' | 'slow' | 'variable' | 'offline')
failNext(operation: OperationName, failure: 'http500' | 'http503' | 'timeout' | 'drop')
changePrice(nftId, price) / setAvailability(editionId, n)
resolveOrder(orderId, 'confirmed' | 'rejected')
expireSession(collectorId?)
dropRealtime() / emitDuplicate(lastEventId) / emitStale(resourceId)
```
Every call mutates the World, which then emits real Socket.IO events. Nothing here touches app state, which would be a disqualifying item.

## 3. Realtime Hub: `src/mocks/realtime/`

Adapter between `world.subscribe` and `@mswjs/socket.io-binding`. It keeps open connections keyed by Collector (from the token in the query string), sends Engine.IO pings every 20 s, delivers `audience`-scoped events only to that Collector's sockets, and closes connections when a token is invalid. The ADR 0001 constraints live here and in `app/realtime`, nowhere else.

## 4. ETH math: `src/lib/money/`

**Interface:** `Eth` (a branded decimal string). Functions: `add`, `sub`, `times(eth, qty)`, `percentOf(eth, bps)`, `compare`, `isZero`, and `format(eth, locale)`. It is the only code that converts between strings and `bigint`. **Tests:** Vitest, table-driven (ADR 0006). The World uses it to compute Quotes; the UI uses it only for display.

## 5. API client: `src/app/api/`

**Interface:** `api.<resource>.<operation>(input, { signal? })` → `Promise<Output>`. The output is parsed with the contract schema. Failures throw `ApiError`, a discriminated union on `kind`:

`validation (fieldErrors) | unauthenticated | sessionExpired | forbidden | notFound | conflict (reason) | quoteStale | idempotencyConflict | transient | network | timeout`

**Behavior hidden inside:** the Axios instance; attaching the token and `Idempotency-Key`; timeouts; mapping status and code to `kind`; running the session-expiry hook on `sessionExpired`. **There is no fake adapter.** It's tested over the network through MSW (a local stand-in), which is also how the spec requires it.

## 6. Query layer: `src/app/query/` + each feature's `queries.ts`

**Interface:** `queryOptions` factories per resource, e.g. `catalogQueries.list(params)`, `cartQueries.cart()`, `orderQueries.byId(id)`, plus mutation hooks that own their own invalidations.

**Key rules**
- Public data: `['public', resource, …params]`.
- Private data: `['private', collectorId, resource, …]`. Isolation is structural: one Collector's keys can never match another's.
- Session change → `queryClient.removeQueries({ queryKey: ['private'] })`, done by Session (§7).
- Cache, retry and staleness policy is set once in `app/query/policy.ts` and documented in ARCHITECTURE:
  - no retry on 4xx;
  - up to 2 retries with backoff on `transient`, `network` and `timeout`;
  - never retry Order creation automatically. Recovery goes through the Checkout Attempt (§9).

## 7. Session: `src/app/session/`

**Interface**
```ts
useSession() → { status: 'guest' | 'authenticated' | 'expired'; collector? }
session.login(credentials) / session.signup(input) / session.logout()
session.getToken()                  // for the API client and Realtime, outside React
```
**Behavior hidden inside** (the whole session-change choreography, in one place): save the token (Zustand persist); on login, merge the Guest Cart and drop the guest `cartId`; on any change of Collector, purge `['private']` queries, rebind Realtime, and discard another Collector's checkout draft. On expiry, keep the redirect target and the draft. Callers never manage these side effects themselves.

## 8. Realtime client: `src/app/realtime/`

**Interface:** `startRealtime(queryClient)` once at boot, plus `useRealtimeStatus()` → `'connecting' | 'online' | 'offline'`. Announcements go to the shared Announcer (aria-live).

**Behavior hidden inside:** the dynamic import of `socket.io-client` (after mocks start); `transports: ['websocket']`; the token in the query string; reconnecting when the Session changes; dropping stale events and events for another Collector by `version` and `userId`; patching or invalidating the affected queries; refetching active resources over REST after a reconnect (ADR 0002).

**Internal seam:** a pure `reconcile(versions, event) → { versions, effects }`, unit-tested with Vitest. Effects are data (`patch`, `invalidate`, `announce`), so duplicates, stale events and other-Collector events are trivial to test.

## 9. Checkout Attempt: `src/features/checkout/attempt/`

The riskiest flow, so it gets its own deep module.

**Interface**
```ts
useCheckoutAttempt() → {
  state: 'reviewing' | 'quoteChanged' | 'submitting' | 'pending' | 'recovering' | 'confirmed' | 'rejected' | 'failed'
  quote, order?, error?
  confirm(formValues)               // locks on the first call
  acceptNewQuote()                  // after QUOTE_STALE or a realtime price change
  retry()                           // same Idempotency Key; never creates a second Order
  startOver()                       // after rejected: new attempt, new key
}
```
**Behavior hidden inside:** a pure reducer (an internal seam, tested with Vitest) for the state machine; one Idempotency Key per attempt, saved in `sessionStorage` with the quote hash and Order id; resuming after a refresh or reconnect; reacting to `order.updated`; removing only the purchased quantities after confirmation.

## 10. Smaller modules

- **Cart** (`features/cart`): `useCart()`, `useCartLine(id).setQuantity(n)`. Rapid changes are collapsed into one mutation (400 ms, latest wins). The guest `cartId` lives here.
- **Favorites** (`features/favorites`): `useFavorite(nftId) → { isFavorite, toggle }`. Optimistic, queued per NFT, rolled back on failure.
- **i18n** (`lib/i18n`): `t(key, params)` (keys typed from the PT-BR dictionary), `useLocale()`.
- **UI kit** (`ui/`): shadcn components themed with the Kurio tokens; `Skeleton` (shimmer, respects reduced motion); `Announcer`; `Unavailable` (out-of-scope actions).

---

## Build split

**Foundation (built by one agent, before any fan-out):**
- `contracts/` for **every** resource
- `lib/money` and `lib/i18n` (the framework plus the shared strings)
- the whole of `mocks/`: World, all resources, Scenarios, Control, Realtime Hub, the http adapters and the Mock Lab shell
- `app/` (api, query, session, realtime)
- the `ui/` kit and theme, the app shell (header, footer, mobile tab bar), routes stubbed for every screen
- Playwright and Vitest setup, CI

The World is built whole because it is one consistent DB. Splitting it across agents is where merge conflicts and contract drift would come from.

**Parallel slices** (each in its own git worktree, each only adding `features/*`, `routes/*`, dictionary keys under its own namespace, and `e2e/<slice>/`):

| Slice | Screens | E2E scenarios |
|---|---|---|
| A: Catalog & NFT | Início, Detalhes do NFT, Favorites | 1, 2, 4, 12 |
| B: Purchase | Carrinho, Pagamento, Confirmação, Order recovery | 5, 6, 7, 9, 10 |
| C: Account | Login, Cadastro, Perfil, Carteiras | 3, 8, 11 |

Done after the merge: visual baselines, Lighthouse, README/ARCHITECTURE (PT-BR + EN), deploy.
