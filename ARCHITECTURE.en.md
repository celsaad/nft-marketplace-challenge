# Architecture

How the app is organized, the contracts between its parts, and why things were chosen. Português: [ARCHITECTURE.md](./ARCHITECTURE.md).

Going deeper: [GLOSSARY.md](./GLOSSARY.md) (domain vocabulary), [docs/decisions.md](./docs/decisions.md) (every decision), [docs/module-design.md](./docs/module-design.md) (modules and interfaces) and [docs/adr/](./docs/adr/) (the 8 hard-to-reverse decisions).

## 1. Overview

```
routes/ (TanStack Router: screens, search params, private-route guard)
   └─ features/ (catalog, nft, favorites, cart, checkout, orders, auth, account, wallets)
        └─ app/ (api: Axios + typed errors · query: keys and cache policy
                 · session: session lifecycle · realtime: socket + reconciler)
             └─ contracts/ (Zod: REST, events, forms)   lib/ (bigint ETH, i18n)

mocks/ (the simulated backend, loaded only by src/main.tsx)
   world/ (business rules, scenarios, persistence)  http/ (MSW REST)  realtime/ (MSW Socket.IO)
```

- **App code never imports `src/mocks`.** An oxlint rule (`no-restricted-imports`) enforces it; only `src/main.tsx` knows the mock exists and turns it on through configuration (`VITE_MOCKS`). Components, hooks and the Axios client hold no fake responses and no alternative paths (ADR 0001).
- **One set of contracts.** The Zod schemas in `src/contracts/` validate the transport (every API response is parsed), the forms (React Hook Form + `zodResolver`) and the mock itself. Validation messages are i18n keys, so the server's error and the form's error are the same text.
- **Each kind of state has one home** (docs/decisions.md §State management):

| Kind of state | Where it lives |
|---|---|
| Server data (catalog, NFT, cart, quote, favorites, orders, profile, wallets) | TanStack Query, and only there |
| Search, filters, sort, page, `redirect` | TanStack Router search params, validated with Zod |
| Session token, current collector, guest cart id, language | Zustand (persisted), read outside React by Axios and the socket |
| Checkout attempt and checkout draft | `sessionStorage` |
| Forms | React Hook Form |

## 2. REST contract

Base `VITE_API_URL` (default `/api`). Headers: `Authorization: Bearer <token>` (session), `X-Cart-Id` (guest cart, only without a session), `Idempotency-Key` (order creation). The full table, with each route's input schema, is in `src/mocks/http/routes.ts`.

| Resource | Operations |
|---|---|
| Session and account | `POST /auth/signup`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| NFTs | `GET /nfts` (search, filters, sort, pagination, facet counts), `GET /nfts/:id`, `GET /nfts/:id/reviews` |
| Favorites | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId` |
| Cart | `GET /cart`, `POST /cart/lines`, `PATCH /cart/lines/:id`, `DELETE /cart/lines/:id`, `PUT /cart/coupon`, `DELETE /cart/coupon` |
| Quote | `POST /quotes` (payment network → subtotal, discount, network fee, total, `issues`, `hash`) |
| Orders | `POST /orders` (with `Idempotency-Key`), `GET /orders/:id` |
| Profile | `GET /me`, `PATCH /me`, `PUT /me/avatar`, `POST /me/password` |
| Wallets | `GET /wallets`, `POST /wallets`, `PATCH /wallets/:id`, `POST /wallets/:id/connect`, `POST /wallets/:id/disconnect` |

**Errors:** `{ error: { code, message, fieldErrors? } }`, with one HTTP status per code (`src/contracts/common.ts`):
- validation (422);
- invalid or expired session, and bad credentials (401);
- no permission (403);
- not found (404);
- conflicts (409): email or username taken, availability, per-order limit, invalid or expired coupon, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT`, wallet rejected, wrong network, or not connected;
- transient failure (503).

On the client everything becomes an `ApiError` with a discriminated `kind`.

**ETH amounts** travel as decimal strings and are computed as `bigint` (wei, 18 decimals). Quantities are integers. The API quote is the authority for totals (ADR 0006).

## 3. Event contract (Socket.IO)

Every event carries `{ eventId, type, resourceId, version, occurredAt, userId }` (ADR 0002):

| Event | Audience | Payload |
|---|---|---|
| `nft.updated` | everyone (`userId: null`) | price, previous price, availability per edition, sold out |
| `order.updated` | the buyer only | status (`pending` → `confirmed` or `rejected`) |

- `version` grows per resource. The client ignores anything not newer than what it last applied, so **duplicates and stale events do nothing**.
- A private event only applies to the collector it was addressed to; the server also delivers it only to that collector's sockets.
- The socket belongs to the session: login, logout, expiry and switching users disconnect and reconnect with the new identity (the token travels in the connection query).
- The reconciler is a pure function (`src/app/realtime/reconcile.ts`, tested) that returns effects as data: update the NFT in the cache, invalidate cart/quote/order, announce a change.

## 4. Session

- An opaque token with a server-controlled expiry, kept in `localStorage` and sent by an Axios interceptor (ADR 0004). It survives a page reload and is revalidated at boot.
- Any 401 on an authenticated request calls `expire()`. That clears all private data from the cache, reconnects the socket as a guest, and announces "session expired". An open private route goes to login with `redirect` and `reason=expired`; after signing in again, the person returns to where they were.
- The checkout draft is stored with the collector's id and only restored for them.
- **Isolation between users:** private data sits in the cache under `['private', collectorId, …]`. Any session change removes that whole branch and rebinds the socket, so nothing from one collector shows up for another.

## 5. Cart

- The cart lives on the server, for guests too (who get an `X-Cart-Id` kept in the browser). On login or sign-up, the server merges the guest cart into the collector's, capped by availability, and the guest cart stops existing.
- Each line remembers the price the person last saw. The next quote reports what changed (price, reduced quantity, sold out, coupon dropped) **once** and adjusts the cart.
- The quantity stepper updates the screen immediately and collapses clicks into one mutation 400 ms later, with the final value (latest wins).

## 6. Cache, retry and synchronization

| Policy | Value and reason |
|---|---|
| Default `staleTime` | 30 s, since the catalog is also kept fresh by events; the cart uses 10 s |
| Request timeout | 10 s, on a JS timer that aborts the request (not XHR's own timeout), so the tests' controlled clock reaches it; TanStack Query's cancellation still applies |
| Query retry | Only for failures where nothing was decided server-side (503, network, timeout): up to 2 times with backoff; never on 4xx |
| Mutation retry | Never automatic. Order creation recovers through the checkout attempt with the same key; everything else through the screen's "Tentar novamente" |
| Out-of-order responses | The query key is exactly the search sent, and each request is cancelled through its `signal` when the search changes; the previous page stays visible with "Atualizando…" |
| After a mutation | The cache is updated with the server's answer (cart, profile) or invalidated (wallets, quote) |
| Optimistic update | Favorites: the screen changes immediately, one request per NFT at a time, the latest intent wins, and a failure rolls back to the last confirmed state |
| Events | Update the NFT in the cache (only if the version is newer), invalidate the cart and quote if the NFT is in the cart, and the order on `order.updated` |

**Failures, in three layers.**
- **A failed request:** each query shows its own error state with "Tentar novamente" in the main content; secondary panels (featured NFT, "Mais desta coleção", cart recommendations) disappear without blocking the page. What to show (nothing if the session ended, field errors, or one message) is decided in one module, `src/ui/failure.ts`.
- **A section that crashes while drawing (a bug):** `SectionBoundary` contains it; secondary sections disappear and the others show a notice with a retry. The header, footer and tab bar are contained too.
- **A route that crashes:** the router's default error screen (`src/app/route-error.tsx`) shows inside the shell, in the app's look and language, with a retry and "Voltar ao início".

## 7. Reconciling REST and Socket.IO

REST is the source of truth; events are versioned hints (ADR 0002). A missed event only costs a refetch: on reconnect, the client invalidates every active query and fetches it again over REST, instead of trying to replay missed events. Changes to the mock, whether made through REST, the Mock Lab or the tests, all go through the same store, which emits the event only after saving the change, so REST and events never disagree (ADR 0001).

## 8. Checkout: integrity and idempotency

- **Quote freshness.** A quote has an `id`, a `hash` of its lines, prices, coupon and fee, and an expiry. Creating an order requires `quoteId` + `quoteHash` + `Idempotency-Key`. If anything changed since the quote, the server answers `409 QUOTE_STALE`, and the screen shows what changed and asks for a new confirmation (ADR 0003).
- **One order per attempt.** The checkout attempt is a pure state machine (`reviewing`, `quoteChanged`, `submitting`, `pending`, `recovering`, `confirmed`, `rejected`, `failed`), written test-first. Each attempt has one key, kept in `sessionStorage`:
  - repeated clicks, timeouts, reloads and reconnects reuse the same key and get the same order;
  - the same key with different content gives `409 IDEMPOTENCY_CONFLICT`.
- **Payment outcome.** Availability is reserved while the payment is pending and released if it's rejected. Confirmation only shows for orders confirmed by the simulation. On confirmation, only the purchased quantities leave the cart. The receipt is a frozen copy: later catalog changes never alter it.
- **Prefill from the wallet.** Each wallet carries the buyer details, and checkout is prefilled from the chosen wallet. The wallet and checkout schemas share the same validators, so a wallet can never hold details that checkout would reject.

## 9. Interaction safety

| Interaction | Handling |
|---|---|
| Search | 300 ms debounce, URL written with `replace`, previous request cancelled |
| Price range | Applies only on "Aplicar" |
| Cart quantity | Immediate on screen, one mutation after 400 ms with the final value |
| Favorite | Queued per NFT, latest intent wins, rollback on failure |
| Forms (coupon, profile, wallet, login) | Button disabled with a spinner while sending; no debounce |
| "Confirmar compra" | Locks on the first click + idempotency key |

## 10. Simulated backend

- **World** (`src/mocks/world/`): every rule (sessions, catalog, favorites, carts, coupons, quotes, orders, profile, wallets) behind one small interface, `exec(op, input, ctx)`, with the clock, storage and id generation injected. It is tested directly with Vitest, without a browser.
- **Persistence:** the state is saved to `localStorage` after every change, per scenario. Pending payments resume after a reload without creating another order. `reset` returns to the scenario's initial state.
- **Simulated network** (`src/mocks/http/`): latency, failure rate, offline and lost responses per scenario, with seeded randomness (reproducible), plus one-off failures from the Mock Lab or the tests.
- **Mock API** (`window.__mock`): the same interface the Mock Lab and Playwright use. It changes the simulated backend, never the app's state.

### Realtime transport and its limitations

Events use a real `socket.io-client`, intercepted by MSW's WebSocket support through `@mswjs/socket.io-binding`. A prototype (recorded in ADR 0001) found four conditions, all met in the code:

1. `socket.io-client` is imported only after the MSW worker starts; before that it captures the real `WebSocket`.
2. Only the `websocket` transport works; HTTP long-polling isn't supported by the binding.
3. The binding advertises a heartbeat but never sends pings, so the mock sends an Engine.IO ping every 20 s; without it the client would drop every 30 s.
4. The binding acknowledges the connection before reading `auth`, so the token travels in the URL query, and an invalid session is refused by closing the connection.

Other limitations:
- only the default namespace is supported, with no acknowledgement callbacks;
- the "server" runs inside the browser;
- the simulated state is per browser: two tabs share the saved data, but not each other's events.

## 11. Accessibility

- Keyboard navigation with visible focus and a "Skip to content" link.
- Focus trapped in dialogs and drawers, and returned to the trigger on close (shadcn/Radix).
- Labels and errors tied to their fields through `aria-describedby` (`FormField`).
- Realtime changes and action results announced in an `aria-live` region and in toasts.
- Skeletons with `role="status"` and a shimmer that respects `prefers-reduced-motion`.
- Alt text on NFT images, and states that never depend on color alone.
- No horizontal scrolling at 390, 768 and 1440 px, nor at 320 px, the width of 400% zoom at 1280 px, with no content lost (checked in `e2e/layout.spec.ts`).

Some lint rules are off in `src/ui/primitives/` (components generated by the shadcn CLI). The CLI follows the W3C ARIA patterns for carousels and breadcrumbs, which those rules would flag. App code keeps every rule.

## 12. Performance

Audited with Lighthouse CI (`pnpm lighthouse`, configs in `lighthouse/`) against the public deployment, which serves the same optimized build as `pnpm build` (asset hashes checked) over HTTPS, HTTP/2 and Brotli, as users get it. Default scenario, 3 runs per page and profile, median. Reports and environment in [docs/lighthouse/summary.md](./docs/lighthouse/summary.md). `pnpm lighthouse:local` audits `vite preview` on localhost instead.

| Profile | Page | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| mobile | Home | 93 | 100 | 100 | 100 | 3.04 s | 0.000 | 8 ms |
| mobile | NFT detail | 95 | 100 | 100 | 100 | 2.86 s | 0.000 | 0 ms |
| desktop | Home | 100 | 100 | 100 | 100 | 0.62 s | 0.000 | 0 ms |
| desktop | NFT detail | 100 | 100 | 100 | 100 | 0.58 s | 0.004 | 0 ms |

**Every target is met on both profiles. The mobile home page has the smallest margin, 3 points.**

The previous audit served the build with `vite preview` (HTTP/1.1, uncompressed) and scored 72 and 76 on mobile. The app didn't change between the two audits; the server did. Lighthouse's simulated throttling replays the page's requests over a modelled network. Over HTTP/1.1 it spreads the app's ~27 eager JS files across 6 connections that each fetch one file at a time, and uncompressed bytes all cross the simulated 1.6 Mbps link. Over HTTP/2 with Brotli the same files share one connection and are compressed. Details and measurements: [docs/lighthouse/improvement-research.md](./docs/lighthouse/improvement-research.md).

Why the mobile home page has the smallest margin (Lighthouse's default profile: simulated slow 4G, 4× slower CPU):
- The LCP element is the first catalog card's image. It only exists once the catalog API answers, and here the API is the simulated backend running in the browser: its chunk (60 KB gzipped) has to download, run and register the service worker before the first request, and the default scenario adds 150–400 ms of simulated latency. In production, with a real API, that chunk and the service worker wouldn't exist.
- First paint (2.0 s on home, 1.2 s on detail) needs only the HTML and CSS of the static header, but the app still loads about 200 KB gzipped of JS at startup (React DOM, Zod 4, Axios, TanStack Router/Query, Radix), which competes with the catalog images for the simulated 1.6 Mbps link.
- The simulated backend stays in the audited build on purpose: the brief forbids audit-only simplifications (ADR 0005).

What was done, measured before and after:
- **Simulated backend chunk from 173 KB to 60 KB gzipped:** MSW uses `tldts` (the public-suffix list) only to validate cookie domains; this app uses no cookies (token in a header), so it's swapped for a 10-line stub (`src/mocks/tldts-stub.ts`).
- **The app renders before the simulated backend is ready:** the HTTP client and the realtime client wait for `backendReady`, so ADR 0001's ordering still holds (no request and no socket.io-client before the worker), but the shell, routes and skeletons show while the mock starts.
- **One `vendor` chunk** for the libraries every page needs before its first paint (React, TanStack Router and Query, Axios, zod, zustand, tailwind-merge, clsx, cva): 28 startup files became 20. Locally over HTTP/2 + Brotli, mobile home went from 88–93 to 92–95; on the deployment it is within run-to-run noise (89 → 88, detail 90 → 92).
- **Header menus, the EN dictionary and an unused provider off the startup bundle:** the language and account buttons render at once and the Radix menu code loads on hover, focus or touch (the click opens it; a keyboard open focuses the first item, as Radix does). Only PT-BR ships at startup, and EN loads before it is applied. `TooltipProvider` was mounted but no tooltip existed. Startup JS from 252.6 to 197.7 KB gzipped, 20 to 9 files. On the deployment: mobile home 90 → 93.
- **Static header in `index.html`:** the header box and the logo (the same for every visitor and locale) paint with the CSS alone, and React replaces them on its first render. On the deployment: mobile home 88 → 90, detail 92 → 95, CLS still 0.
- **The first row of cards** loads eagerly with high priority (the LCP image).
- **CLS on the detail page from 0.081 to 0.004:** `<main>` reserves the viewport's height, so the footer doesn't jump when content arrives.
- **SEO from 92 to 100:** a `robots.txt` (the SPA rewrite was serving `index.html` in its place).
- Already in place: AVIF/WebP images with `srcset` at 320/640/960 and a fixed aspect ratio, code-split routes, a local font, and the Mock Lab loading only once the page is idle.

Tried and dropped: deferring the promo and journal images until they are a screen away (Chrome's native lazy loading starts ~1250 px out, so on a phone they load with the catalog): it cut the home page's image bytes at load from 201 KB to 25 KB but did not move the score, and it would hide them from the full-page visual baseline. Also `modulepreload` for the mock chunk (it competes with the app's JS for bandwidth and made LCP worse) and deferring the mock until after the first frame (no effect).

Next steps, if more margin were needed: load sonner (toasts) on demand, which takes wrapping every `toast()` call. Not `zod/mini` in the route schemas alone: every API response is parsed with the full zod contracts, so zod stays on the critical path unless all contracts, forms and the mock move to `zod/mini`.

## 13. UX decisions and deviations from the Figma

The Figma defines the visual identity; the brief defines the behavior. Where the two don't fit together, or the Figma didn't draw something:

**Login and sign-up**
- They are their own routes (`/entrar`, `/cadastro`), styled as the Figma's panel, so `redirect` and `reason` live in the URL and survive a reload. On desktop the panel sits over the dimmed home page, as in the Figma; the home behind it is a decorative, inert copy (hero and promos).
- Sign-up has no display-name field, because the Figma has none. The username serves as the display name until edited on the profile.

**Wallets and profile** follow the Figma field for field. A wallet carries the buyer details the Figma draws on it. The only addition is a per-network hint for the address format.

**Catalog**
- A search field at the top of the sidebar; the desktop Figma has none.
- The sidebar appears from 1024 px; below that there's a filter drawer.
- On mobile, sorting sits under the tabs.
- Selected filters show an icon, so the state doesn't depend on color alone.
- Prices use a dot decimal, like the rest of the Figma.
- 9 items per page.

**NFT detail**
- The default edition is the first available one.
- The thumbnails are crops of the same artwork, since each NFT has one image.
- The breadcrumb includes the NFT's name.
- The Contract/Royalties labels, which look swapped in the Figma, are paired with the right text.

**Cart.** Each line also shows the edition, because the brief requires respecting availability per edition. On desktop the cart and checkout headings are for screen readers only, since the Figma shows just the breadcrumb there.

**Checkout**
- The wallet address comes from the chosen wallet and isn't editable, so the order is always paid from the selected wallet.
- The secondary-wallet field appears when "Usar outra carteira?" is checked.
- "Confirmar compra" opens a review before sending, as the brief asks.
- On mobile the frame shows only the wallets and the total, so the required form is stacked between the wallets and the summary.

**Confirmation.** It's a card inside the page, not an overlay. The explorer link reads "Ver no explorador" with a "Simulado" tag, because it points to a fictional explorer.

**Out of scope:** Criadores, Aprenda, blog, newsletter, social networks, the mobile scan button, footer links, social login and "esqueceu a senha". They render as drawn, but lead to a "Not available in this demo" page or show a notice. None of them pretends to have worked.

**Mobile.** The Figma's mobile frames have no top bar. The app keeps a compact one with the logo, language switch, cart and account, because the frames offer no other place to switch language, log in or log out. As in the Figma, the detail, cart and checkout pages swap the tab bar for a fixed action panel at the bottom (buying, the cart summary, the confirmation with the total), in `src/ui/mobile-action-bar.tsx`; the top bar and the back button keep navigation. The panel publishes its height as `--bottom-bar`, which keeps the page's end and the Mock Lab button clear of it, so nothing hides behind it. On mobile the Mock Lab button is an icon only, so it covers less of the content.

**Checkout breadcrumb.** "Início / Carrinho / Pagamento" (the Figma has "Mercado" in the middle), because it's the actual way back.

**Social icons** are text monograms (f, ig, x, in, yt), with no brand logos.

## 14. Known limitations

- The backend is simulated in the browser: data and events are local to each browser.
- Visual regression baselines exist for macOS/Chromium only; CI (Linux) runs the functional tests only.
- Transaction references and explorer links are simulated and point to a fictional domain.
- Mobile full-page visual baselines show the fixed tab bar in the middle of the capture: that's how Playwright stitches fixed elements, not a layout defect.
- Social login, "esqueceu a senha" and the out-of-scope sections are visual only (section 13).
- Refactors identified but not done: the cart quantity's "last click wins" could use the same pure, tested module as favorites (`favorites/sync.ts`); `useLiveRegion` could move from `features/cart` to `src/ui`; cart, checkout and the detail page could share one page header (breadcrumb and mobile back button).
