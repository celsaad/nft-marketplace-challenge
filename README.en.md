# Kurio — NFT Marketplace

Frontend challenge: an NFT marketplace in React + TypeScript, backed by a **simulated** backend (MSW + Socket.IO) that behaves like a real one: REST, sessions, cart, quotes, idempotent orders and realtime events.

- **Live app:** https://nft-marketplace-challenge-one.vercel.app
- **Repository:** https://github.com/celsaad/nft-marketplace-challenge
- **Architecture and decisions:** [ARCHITECTURE.en.md](./ARCHITECTURE.en.md) · Português: [README.md](./README.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

## Stack

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Axios · Zod · Zustand · React Hook Form · Tailwind CSS 4 · shadcn/ui · MSW 2 + `@mswjs/socket.io-binding` + `socket.io-client` · Vitest · Playwright · Lighthouse CI · oxlint + Biome.

## Running it

Requires **Node 22+** and **pnpm 12** (the version pinned in `package.json`). On Node 22 to 24, Corepack ships with Node and installs that version for you; from Node 25 on it is no longer bundled, so install pnpm directly.

```sh
corepack enable          # Node 22–24, once per machine
npm install -g pnpm@12   # Node 25+ (no Corepack)
pnpm install
pnpm dev                 # http://localhost:5173, with the simulated backend on
```

There are no private services and no real backend: a clean checkout runs end to end, tests included.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Development with mocks (MSW + simulated Socket.IO) |
| `pnpm build` | Optimized build (includes the simulated backend, like the deployed app) |
| `pnpm preview` | Serves the build at http://localhost:4173 |
| `pnpm typecheck` | Type checking |
| `pnpm lint` | oxlint (rules) + Biome (formatting and imports) |
| `pnpm format` | Fixes formatting and whatever lint can fix |
| `pnpm test` | Unit tests (Vitest): simulated backend rules, ETH math, realtime reconciliation, checkout state machine |
| `pnpm e2e` | E2E tests (Playwright) on desktop 1440×900 and mobile 390×844, against the optimized build |
| `pnpm e2e:update` | Regenerates the visual regression baselines |
| `pnpm e2e:report` | Opens the HTML report of the last E2E run (with traces of failures) |
| `pnpm lighthouse` | Lighthouse audit of the public deployment (mobile and desktop, 3 runs, median in `docs/lighthouse/summary.md`). Needs Chrome; without it, set `CHROME_PATH` to Playwright's Chromium |
| `pnpm lighthouse:local` | Same audit against `pnpm build` served by `vite preview` on localhost (HTTP/1.1, uncompressed, so mobile scores lower) |

Before the first `pnpm e2e`, install the browser: `pnpm exec playwright install chromium`. To use another port: `E2E_PORT=4410 pnpm e2e`.

### Environment variables

Defaults live in `.env` (committed, no secrets) and are documented in `.env.example`:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_MOCKS` | `on` | Turns the simulated backend on. The deployed demo needs it on. |
| `VITE_API_URL` | `/api` | REST API base (served by MSW). |
| `VITE_REALTIME_URL` | `wss://realtime.kurio.test` | Socket.IO endpoint (intercepted by MSW). |

## Fictional credentials

| Collector | Email | Password |
|---|---|---|
| Ana Souza | `ana@jungle.test` | `Password123!` |
| Bruno Lima | `bruno@jungle.test` | `Password123!` |

Ana has a primary wallet (Ethereum, MetaMask) and a secondary one (Polygon). Bruno has a primary (Ethereum) and a secondary (Solana). Coupons: `KURIO10` (10%), `LAUNCH05` (0.05 ETH, 1 ETH minimum), `EXPIRED20` (expired). Passwords are stored only as salted SHA-256 hashes, even in the mock.

## Scenarios, Mock Lab and reset

The simulated backend has deterministic **scenarios**. Each scenario's state is saved in the browser's `localStorage` and survives a page reload.

- **Pick a scenario:** `?scenario=<name>` in the URL (e.g. `/?scenario=slow-network`), or through the **Mock Lab**.
- **Reset:** `?reset=1` puts the scenario back to its initial state (the parameter is then removed from the URL, so a later reload doesn't reset again).
- **Mock Lab:** the "Mock Lab" button in the bottom-left corner of the app (also on the deployed version). It switches and resets scenarios, changes latency, goes offline, makes the next request fail, changes any NFT's price or availability, drops the realtime connection, re-sends duplicate or stale events, expires sessions, makes the wallet reject connections, and confirms or rejects pending orders. Everything goes through the simulated backend and reaches the app as real REST responses and Socket.IO events.

| Scenario | What changes |
|---|---|
| `default` | Full catalog, two collectors, payments confirm after 2.5 s |
| `empty-catalog` | No NFTs listed (empty states) |
| `slow-network` | Responses take 2–3.5 s (skeletons, pending states) |
| `variable-latency` | Responses take 50 ms–2.5 s (they can arrive out of order) |
| `flaky` | 30% of requests fail with 503 (retry and recovery) |
| `offline` | Every request fails as a network error |
| `short-session` | Sessions expire 60 s after login |
| `payment-rejected` | Every payment is declined after 2.5 s |
| `slow-confirm` | Orders stay pending until confirmed/rejected in the Mock Lab |
| `order-timeout` | The order is created but its response is lost; retrying recovers the same order |
| `wallet-rejected` | The simulated wallet rejects every connection |

## Reproducing the failure flows

Sign in as Ana for every flow below. For a clean state, open the URL with `&reset=1`.

1. **Price change during checkout (realtime):** put an NFT in the cart and go to checkout. In Mock Lab › Catalog, change that NFT's price. The screen announces the change, the summary updates, and confirming requires a new review with the new quote.
2. **Payment rejected:** `/?scenario=payment-rejected&reset=1`, buy something. The order ends rejected, the items stay in the cart, and "Tentar novamente" starts a new attempt.
3. **Timeout with recovery of the same order:** `/?scenario=order-timeout&reset=1`, confirm the purchase. The response is lost; the attempt goes into recovery and, on retry, gets the **same** order (same idempotency key). Mock Lab › "Next order: lose response" does it just once.
4. **Repeated clicks:** click confirm several times. The button locks on the first click and only one order is created.
5. **Connection drop with a pending order:** `/?scenario=slow-confirm&reset=1`, confirm a purchase (it stays pending). In the Mock Lab, "Drop connection", then reload the page. The screen recovers the same pending order; then confirm it in Mock Lab › Pending Orders.
6. **Duplicate/stale events:** Mock Lab › Realtime, "Re-send last event" and "Send stale event". Nothing on screen goes backwards.
7. **Session expiring mid-flow:** on `/perfil` or checkout, Mock Lab › "Expire Sessions", then do anything. You go to login with the way back kept; after signing in again you return to where you were (the checkout draft is restored for the same collector).
8. **Unstable, slow or offline network:** the `flaky`, `slow-network`, `variable-latency` and `offline` scenarios, or the Mock Lab's network controls.
9. **Sign-up conflicts and validation:** sign up with `ana@jungle.test` or the username `ana_souza`. The error shows on the right field.
10. **Invalid/expired coupon:** in the cart, apply `NOPE` or `EXPIRED20`.

## Tests

- **Unit (Vitest):** the simulated backend's rules (isolation between collectors, guest cart merge, coupons, stale quotes, idempotency, order lifecycle, persistence and scenarios), `bigint` ETH math, the realtime event reconciler, and the checkout attempt state machine.
- **E2E (Playwright):** the challenge's 12 scenarios, on desktop and mobile, against the optimized build, plus a horizontal-scroll check of every screen at 390, 768 and 1440 px (`e2e/layout.spec.ts`), with an HTML report and traces of failures. Visual regression (home, detail, cart and checkout) has committed baselines generated on macOS/Chromium (`-darwin` suffix); CI (Linux) runs only the functional tests.
- **Controlled clock:** the time-sensitive scenarios (the `short-session` scenario's 60 s session, the simulated payment delay, the 10 s request timeout) use Playwright's `page.clock` and jump over the wait instead of sitting through it (`e2e/clock.spec.ts`). Latency and events are controlled through the Mock API.
- **Current counts:** 114 unit tests; 71 E2E tests per project (desktop and mobile), 142 runs in all, including the 8 visual captures (one is skipped on desktop: the filter sheet, which exists only on mobile/tablet).
- **Lighthouse:** see [docs/lighthouse/summary.md](./docs/lighthouse/summary.md) and the analysis in [ARCHITECTURE.en.md](./ARCHITECTURE.en.md#performance).

## Image credits

The 4 illustrations come from the challenge's Figma file. The other NFT artworks are public domain (CC0), from the Nouns project, under fictional names; no art from commercial collections was used (ADR 0007). Each artwork's source and license are in the header of `scripts/build-images.mjs`.
