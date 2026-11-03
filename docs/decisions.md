# Decisions log

Every decision made while planning, in compact form. Read this before you start on any slice. Terms follow [GLOSSARY.md](../GLOSSARY.md). Decisions that are hard to reverse have a full ADR in [adr/](./adr/).

## Constraints and process

- **Budget:** 1.5 days, aiming for the full spec.
- **Order of work:** the foundation first (contracts, mock DB, Scenario engine, Axios client, socket client, router shell, design tokens). Then three parallel worktree slices:
  - catalog/detail
  - cart/checkout/orders
  - auth/profile/wallets
- **Cut order if we run late:** disqualifiers, then the purchase flow, account flows, visual fidelity, all 12 E2E scenarios, visual baselines, Lighthouse polish, and docs depth last.
- **Git:** a fresh public repo at `celsaad/nft-marketplace-challenge`, committed in small, meaningful steps. Confirm before the first push.

## Stack and tooling

- Vite single-page app. TanStack Router with file-based, code-split routes. pnpm through Corepack. Vitest for pure logic.
- Linting is done by **oxlint** (plugins: react, react-hooks, jsx-a11y, typescript, import, unicorn). It also enforces the rule that app code never imports `src/mocks`. **Biome** only formats and organizes imports; its linter is off so the two tools never report the same problem twice.
- Vercel hosting with a rewrite to the single-page app. Deploys from `main`.
- GitHub Actions runs typecheck, lint, Vitest and the functional Playwright tests (visual tests skipped on Linux).
- Fonts: Roboto Mono (400/500/700) bundled with the app through `@fontsource`.
- UI components come from the **shadcn CLI** (4.22.1) and live in `src/ui/primitives/`. That folder is treated as vendored: a few lint rules are off there only. `prefer-tag-over-role` would flag the WAI-ARIA carousel and breadcrumb patterns, `anchor-has-content` is a false positive because content arrives through props, and the rest are upstream style nits. The CLI's extra dependencies (`cn`, published 2026-11-02, too recent to pin; `next-themes`) were not installed: `cn()` is written locally with `clsx` and `tailwind-merge`, and the toast theme is fixed to dark.
- Mocking: `msw@2.15.0` pinned, with `@mswjs/socket.io-binding@0.2.0` and `socket.io-client@4.8.x`. MSW 3 also passed the spike, but it falls outside the binding's supported peer range. See [ADR 0001](./adr/0001-single-in-browser-mock-backend.md) for the four conditions the spike found.

## State management

| Kind of state | Where it lives |
|---|---|
| Server data (catalog, detail, Cart, Quote, Favorites, Orders, profile, Wallets, current Collector) | TanStack Query only. Never copied into another store. |
| Search, filters, sort, page, `redirect` | TanStack Router search params, validated with Zod |
| Session token, socket status, language, active Checkout Attempt | Zustand. Read outside React with `getState()`; token and language persisted |
| Forms | React Hook Form + Zod schemas shared with the contracts |
| Throwaway UI state | `useState` |
| Data that must survive a refresh | token and language (Zustand persist → `localStorage`), guest `cartId` (`localStorage`), Checkout Attempt and checkout draft (`sessionStorage`) |

## Contracts and data

- Zod schemas in `src/contracts/` are the single source of truth for REST, events and forms ([ADR 0001](./adr/0001-single-in-browser-mock-backend.md)).
- ETH amounts are decimal strings; math is done in `bigint` wei ([ADR 0006](./adr/0006-eth-as-decimal-strings-with-bigint-wei.md)).
- Session: bearer token. A `401 SESSION_EXPIRED` clears private cache and the socket, then redirects to `/login?redirect=…`. The checkout draft is restored only for the same Collector ([ADR 0004](./adr/0004-bearer-token-in-localstorage.md)).
- The Cart lives on the server, including for Guests (anonymous `cartId`). On login, the server merges the Guest Cart into the Collector's Cart, capped by Availability.
- The required optimistic update with rollback is the Favorite toggle.
- Errors the API must be able to return: validation, invalid Session, forbidden, not found, availability conflict, transient failure, `QUOTE_STALE`, `IDEMPOTENCY_CONFLICT`.

## Domain rules

- Category (the sidebar's "Coleções") is distinct from Collection (the creator's series).
- Price belongs to the NFT; Availability belongs to the Edition. An Open Edition is capped by the per-order limit.
- The Payment Network is chosen at checkout and must match the Wallet. Carts may mix Networks ([ADR 0008](./adr/0008-payment-network-separate-from-nft-network.md)).
- Networks are Ethereum, Polygon and Solana, and each has a different Network Fee.
- A Previous Price is shown struck through only while the current Price is lower.
- A Cart has at most one Coupon: a percentage or fixed discount on the subtotal, never on the Network Fee. If it becomes invalid, the next Quote drops it and the UI announces why.
- Favorites point at NFTs, not Editions.
- A Wallet carries **Buyer Details** (display name, profile name, email, referral code, ENS name, optional secondary address), matching the Figma "Carteiras" form field for field. Checkout prefills from the chosen Wallet. The secondary Wallet can copy the primary's Buyer Details ("Igual à carteira principal"). Both schemas share the same field validators, so a Wallet can never hold details that checkout would reject.
- A rejected Order is terminal. Buying again starts a new Checkout Attempt with a new key. Cart Lines are kept on failure. On confirmation, only the purchased quantities are removed.

## Integrity

- A Quote has an id, a hash and an expiry. Creating an Order requires `quoteId` + `Idempotency-Key`. The server returns `409 QUOTE_STALE` when anything behind the hash has changed ([ADR 0003](./adr/0003-server-enforced-quote-and-idempotent-checkout.md)).
- Recovery from a pending Order happens at `/orders/$orderId`, using the key stored in `sessionStorage`.
- Every event carries `{eventId, type, resourceId, version, userId?}`. The client drops stale events and events for another Collector, refetches over REST after a reconnect, and reconnects the socket whenever the Session changes ([ADR 0002](./adr/0002-rest-is-truth-events-are-versioned-hints.md)).

## Mock layer

- One mock DB is shared by MSW REST and the Socket.IO binding. It is persisted per Scenario and reset with `?scenario=<name>&reset=1`.
- Scenarios can be driven through the URL, the lazy-loaded Mock Lab, or `window.__mock` (used by Playwright). All three go through the mock DB, never into UI state.
- Fixtures include two Collectors, `ana@jungle.test` and `bruno@jungle.test`, both with password `Password123!`. Passwords are stored as salted SHA-256 hashes.
- Orders go from pending to confirmed after about 2.5 s by default. Scenarios cover `payment-rejected`, `order-timeout` (the response is dropped after the Order is created) and `slow-confirm` (the outcome waits for a manual trigger).
- Wallet Connections are simulated through the mock API. The Scenario decides whether they are approved, rejected or disconnected.
- MSW is part of the deployed build and the audited build ([ADR 0005](./adr/0005-msw-ships-in-the-production-build.md)).

## UI

- PT-BR is the default and EN is the second language. Translations live in a typed dictionary with no i18n library. A switch in the header sets `<html lang>`. Docs exist in both languages (`README.md` PT-BR, `README.en.md`; same for `ARCHITECTURE`).
- Numbered pagination on every screen size, 9 items per page on desktop. Filters live in the URL, and sidebar counts come from the API.
- Artwork: the 4 Figma pieces in the places the design shows them, CC0 Nouns for the rest, all with fictional names ([ADR 0007](./adr/0007-artwork-from-figma-and-cc0-only.md)). Images are served as AVIF/WebP at responsive sizes.
- The checkout form keeps every field and asterisk from the Figma and is prefilled from the profile and Primary Wallet. Formats are validated (`0x…` address, ENS name, email). Any well-formed referral code is accepted.
- Out-of-scope elements (Criadores, Aprenda, blog, newsletter, footer links, share buttons, mobile scan button) render as drawn but never appear to succeed:
  - navigation goes to a "not available in this demo" page;
  - actions show a "não disponível" toast;
  - the reviews tab shows read-only reviews from the fixtures.
- Mobile filters open in a shadcn `Sheet` with trapped focus and apply on "Aplicar".

## Interaction safety

- Search: debounced 300 ms, written to the URL with `replace`, and the previous request is cancelled.
- Price slider: only local state until "Aplicar" is pressed.
- Cart quantity stepper: updates the UI instantly. Changes are collapsed into one mutation after 400 ms carrying the final value; the latest value wins.
- Favorite toggle: requests are queued per NFT, the last intent wins, and it rolls back on failure.
- Submit buttons (coupon, profile, Wallet, auth): disabled with a spinner while pending, never debounced.
- "Confirmar compra": locked on the first click, plus the Idempotency Key.
- Resize and scroll listeners: throttled with `requestAnimationFrame`.

## Quality

- Visual baselines: macOS Chromium, committed with the `-darwin` suffix, with volatile regions masked and animations turned off.
- Lighthouse: `@lhci/cli` with a committed `lighthouserc.cjs`. Runs against `vite build && vite preview` with the default Scenario: 3 runs × {home, detail} × {mobile, desktop}. A script writes the medians, plus LCP/CLS/TBT and the environment, to `docs/lighthouse/summary.md`.
