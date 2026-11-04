# Mobile Lighthouse Performance: research on reaching 90

Research note, 2026-11-04. No app code was changed. Every experiment ran on throwaway copies of the build outside the repo. Measurements are in the [audit summary](./summary.md) and [ARCHITECTURE.md §12](../../ARCHITECTURE.md#12-performance).

## Question

Mobile Performance is 72 on the home page (`/`) and 76 on the NFT detail page (`/nft/:id`). Can it reach 90 or more without breaking the challenge rule? The rule says the audit must load "as imagens, fontes e funcionalidades da entrega, sem simplificações exclusivas para melhorar a pontuação" ([challenge §10](https://github.com/junglegaming/frontend-challenge)). If it can, what are the best moves?

## Short answer

**Yes, but the biggest lever is how the build is served, not the app code.** Lighthouse's default mobile run does not throttle the page. It simulates the throttling ("Lantern"), and the simulation charges a cost to every HTTP/1.1 request. The current audit serves the build with `vite preview` over plain HTTP/1.1 (`lighthouse/base.cjs:9`), and that HTTP/1.1 cost is what holds the score down. In production the app is served by Vercel over HTTPS, HTTP/2 and Brotli.

I served the **same, unchanged build** over HTTPS + HTTP/2 locally:
- With gzip, home scored 90 (4 of 4 runs) and detail scored 91 (3 of 3).
- With Brotli, home scored 92–93 and detail 94–97.

On HTTP/1.1, the best combination of app changes I tried reached 79–80 on home and 80–85 on detail. That is still below 90.

Top 3 moves:

1. **Audit the delivery as it is deployed: HTTPS + HTTP/2 + Brotli.** Point Lighthouse CI at the Vercel deployment, or at a local server with the same protocol and compression. Measured: +18 (home) and +15 (detail) with gzip, about +20 with Brotli. This is legitimate: the full delivery is loaded, mock backend included, and nothing is removed.
2. **Fewer eager JS chunks.** Merge the 27 files loaded before first paint into a few, using Rolldown `codeSplitting.groups`. Measured: +1–2 on HTTP/1.1 (FCP −0.2 s, LCP −0.2 to −0.3 s) and +1 on HTTP/2. This builds the margin above 90.
3. **Less JS before first paint.** Use `zod/mini` in the route search schemas. Load the account menu, tooltip and dialog code (Radix, Floating UI, react-remove-scroll) on demand. Split the i18n dictionaries by locale. Estimated at about 5 ms of simulated FCP and LCP per KB removed (inferred from the throttling model). Not measured.

The mobile target should be called met only after (1) has been measured against the real Vercel URL. My HTTP/2 numbers come from a local server, and at 90/91 with gzip the margin is thin.

## How Lighthouse computes the mobile metrics

These are facts about Lighthouse 12.6.1, the version that produced the reports. The Lantern code ships compiled in `@paulirish/trace_engine@0.0.53`. Below, `LANTERN/` means `node_modules/.pnpm/@paulirish+trace_engine@0.0.53/node_modules/@paulirish/trace_engine/models/trace/lantern/`. The upstream source is [devtools-frontend `front_end/models/trace/lantern`](https://github.com/ChromeDevTools/devtools-frontend/tree/main/front_end/models/trace/lantern).

- **Simulated, not throttled.** Lighthouse loads the page at full speed, then simulates a 150 ms RTT, 1.6 Mbps, 4× CPU load from what it observed ([throttling.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)). The constants are `rttMs: 150`, `throughputKbps: 1.6 * 1024` and `cpuSlowdownMultiplier: 4` (`LANTERN/simulation/Constants.js:11-18`). 1,638.4 kbps is 204.8 KB/s.
- **Score weights:** FCP 10, LCP 25, TBT 30, CLS 25, SI 10 (`node_modules/.pnpm/lighthouse@12.6.1_supports-color@5.5.0/node_modules/lighthouse/core/config/default-config.js:408-412`).
- **Mobile score curves (p10 / median):**
  - FCP: 1800 / 3000 ms ([first-contentful-paint.js:44-45](https://github.com/GoogleChrome/lighthouse/blob/v12.6.1/core/audits/metrics/first-contentful-paint.js#L44-L45))
  - LCP: 2500 / 4000 ms ([largest-contentful-paint.js:46-47](https://github.com/GoogleChrome/lighthouse/blob/v12.6.1/core/audits/metrics/largest-contentful-paint.js#L46-L47))
  - SI: 3387 / 5800 ms ([speed-index.js:44-45](https://github.com/GoogleChrome/lighthouse/blob/v12.6.1/core/audits/metrics/speed-index.js#L44-L45))
- **Each metric averages two simulations.** It is 0.5 × an "optimistic" graph plus 0.5 × a "pessimistic" graph (`LANTERN/metrics/FirstContentfulPaint.js:7-13`, `LargestContentfulPaint.js:7-14`, `Metric.js:54-58`).
- **The graphs keep only requests that ended before the observed paint.** A network request enters the graph only if it ended before the *observed* (unthrottled) FCP or LCP timestamp. Scripts whose evaluation started after that paint are dropped (`FirstContentfulPaint.js:100-118`). Beyond that:
  - The FCP graphs keep requests with "render-blocking priority": `VeryHigh`, or `High` scripts. Every module script here is `High` (`LANTERN/graph/NetworkNode.js:68-75`).
  - The pessimistic LCP graph keeps *everything* that ended before the observed LCP (`LargestContentfulPaint.js:37-48`).
  - LCP is the latest end time of any node that is not a low-priority image. It is never less than FCP (`LargestContentfulPaint.js:49-57, 64`).
  - Speed Index is never less than FCP (`LANTERN/metrics/SpeedIndex.js:12`).
- **HTTP/1.1 vs HTTP/2.** Lantern gives an HTTP/1.1 origin 6 connections. Each connection runs one request at a time and has its own TCP slow start. An HTTP/2 origin is modelled with a single warmed connection whose congestion window carries over (`LANTERN/simulation/ConnectionPool.js:10, 45-58`, `TCPConnection.js:75`). *Inferred:* with 27 eager files, each HTTP/1.1 connection queues about 5 requests one after another, and each costs at least one 150 ms round trip. The HTTP/2 experiment below is consistent with this.
- **Service-worker-served requests.** Requests made *by* a worker (`fromWorker`) are left out of the graph (`LANTERN/graph/PageDependencyGraph.js:56-57, 442`). The page-side copy of a request that MSW's service worker answers or passes through shows `transferSize: 0` in the reports, so it is simulated as a 0-byte request. Disk-cache hits get a flat local cost (`LANTERN/simulation/Simulator.js:249-255`). MSW passes unhandled requests through with `fetch()` inside the worker (`public/mockServiceWorker.js:228-250`), and it claims the page right away (`public/mockServiceWorker.js:20`). *Inferred consequence:* once the worker is active, the images and API calls that go through it cost almost nothing in the simulation. The worker's own registration and start-up time is not in the graph either. That explains the earlier finding that moving the mock start earlier or later made no difference (ARCHITECTURE.md §12).
- **Every run starts cold.** The default settings clear service workers and Cache Storage before each run (`.../lighthouse/core/config/constants.js:68`). Caching headers therefore cannot change the score.

### What a score of 90 needs

With CLS and TBT already at 1.0, 55 of the points are already earned. I scored metric pairs with Lighthouse's own `Audit.computeLogNormalScore`, and the formula reproduces the published 72.0 and 75.5:

| FCP (= SI) | Largest LCP that still reaches 89.5 |
|---|---|
| 1.5 s | 3.64 s |
| 2.0 s | 3.47 s |
| 2.5 s | 3.23 s |
| ≥ 2.75 s | not reachable (LCP ≥ FCP, and FCP's own score falls too fast) |

FCP has to drop from 3.7 s to about 2.5 s, **and** LCP from 4.5–5.2 s to about 3.2–3.5 s.

## Where the time goes (published mobile reports)

From `docs/lighthouse/mobile/home.json` and `nft-detail.json`, audits `metrics`, `lcp-breakdown-insight` and `network-requests`.

| | Home | Detail |
|---|---|---|
| Simulated FCP / LCP | 3,776 / 5,218 ms | 3,696 / 4,546 ms |
| Metric scores FCP / LCP / SI | 0.28 / 0.23 / 0.84 | 0.30 / 0.36 / 0.85 |
| Observed (unthrottled) FCP / LCP | 106 / 298 ms | 81 / 283 ms |
| Bytes requested before the observed LCP | 624 KB (scripts 359, images 208, fonts 39, CSS 16) | 403 KB (scripts 346, fonts 39, CSS 16) |
| LCP breakdown: TTFB / load delay / load time / render delay | 452 / 1,051 / 39 / 3,676 ms | 452 / 3,777 / 94 / 223 ms |
| Main-thread work (simulated, 4×) | ~0.6 s | similar |

How to read this:

- **The local machine finishes everything before the first paint.** All 27 eager scripts finish downloading 9–22 ms after navigation, and CSS finishes at 13 ms. FCP is observed only at 81–106 ms. So the whole eager JS set (about 258 KB gzip, measured on the current `dist/`) is inside the FCP graph, and so are the mock chunk (60 KB, 38–48 ms) and the fonts (39 KB, ending 77–86 ms). Simulated FCP is the cost of downloading all of that at 204.8 KB/s over six HTTP/1.1 connections with 150 ms round trips, plus about 0.3 s of CPU.
- **The home "render delay" of 3.7 s is not rendering.** Lighthouse matched the LCP image URL (`emerald-ape-640.avif`) to an *early, Low-priority* request made at 85 ms. That request came from a below-the-fold editorial image, which the page loads while the catalog is still a skeleton. The card's own request for the same file, at 282 ms, went through the service worker with 0 bytes. LCP is then just the latest end time in the graph, and that is set by the 624 KB in front of it. The "render delay" is LCP minus that early image's end time (inferred from `LargestContentfulPaint.js:49-57` and the request list).
- **Detail's 3.8 s load delay is the request chain:** document → app JS → mock chunk → XHR → image. *Inferred* from how Lantern links XHRs to the CPU task that issues them (`PageDependencyGraph.js:165-186`).
- **Below-the-fold images on home:** 10 images, 208 KB, requested at 82–90 ms, mostly `Low` priority. They come from the promo cards and "Diário da Cunhagem" (`src/features/catalog/editorial.tsx:25, 64`) and the hero's off-screen slides. Chrome's lazy-load threshold is 1,250 px from the viewport on fast connections and 2,500 px on 3G or slower ([web.dev](https://web.dev/articles/browser-level-image-lazy-loading)). Lighthouse's simulation does not slow the real connection, and these sections sit near the top while the catalog is still a skeleton, so they load. Low-priority images are only in the pessimistic LCP graph, but there they compete for the simulated bandwidth.
- **The other insights are not the bottleneck:**
  - `render-blocking-insight` names only the CSS (16 KB) and reports `overallSavingsMs: 0`, because FCP is held by the JS anyway.
  - `network-dependency-tree-insight`: longest chain 77–86 ms (document → CSS → fonts).
  - `unused-javascript`: 75 KiB; `uses-responsive-images`: 137 KiB.

### What makes up the eager JS

From `pnpm build`, current `dist/index.html`, with source maps built to a scratch folder:

| Chunk | gzip | Main contents |
|---|---|---|
| `index` (entry) | 93.6 KB | react-dom; Radix menu / dropdown / tooltip / popper; Floating UI; router |
| `purchase` | 28.6 KB | **zod** (the full library; ~362 KB of source); contracts |
| `keys` | 25.8 KB | axios, query-core, API client |
| `middleware` | 20.6 KB | router-core, zustand, history |
| `i18n` | 17.2 KB | **pt-BR and en dictionaries, both eager** |
| `button` | 10.9 KB | tailwind-merge, cva, Radix Slot |
| `es2015` | 10.1 KB | react-remove-scroll, focus-scope, dismissable-layer (dialog and sheet code) |
| 20 others | < 10 KB each | small shared chunks, each a separate request |
| CSS | 16 KB | Tailwind |

- **Why zod is eager:** the home route's `validateSearch` uses zod (`src/routes/index.tsx:11-21`). TanStack Router keeps search-param validation, loaders and other route config in the main bundle; only components are split out ([TanStack Router code splitting](https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting)).
- **The mock chunk** (`start`, 59.4 KB gzip) is mostly msw, tough-cookie (~71 KB of source), @mswjs/interceptors and path-to-regexp.

## Experiments

Setup:
- Same Lighthouse (12.6.1 CLI from `node_modules`), mobile defaults, `uses-http2` skipped as in `lighthouse/base.cjs`.
- Browser: Brave headless (reports as HeadlessChrome/156, the same engine as the published runs; benchmarkIndex 5319 vs 5078).
- 1–4 runs per cell, run on this machine. These are evidence for direction and rough size, not a replacement for the 3-run median.
- The baseline reproduced the published numbers: home 72–74, detail 75.
- **h1** = `vite preview` (HTTP/1.1, gzip), as the audit runs today.
- **h2** = a 25-line Node `http2.createSecureServer` serving `dist/` with SPA fallback and gzip or Brotli, self-signed certificate, Chrome flag `--ignore-certificate-errors`. The MSW worker registered and served the API in every h2 run.

| Variant | Server | Home: score (FCP / LCP s) | Detail: score (FCP / LCP s) |
|---|---|---|---|
| Baseline | h1 | 72–74 (3.78 / 4.71–5.22) | 75 (3.70 / 4.70) |
| **Baseline, no code change** | **h2 + gzip** | **90 ×4 (2.70 / 3.04)** | **91 ×3 (2.63 / 3.00)** |
| **Baseline, no code change** | **h2 + Brotli** | **92, 93, 93 (2.33–2.54 / 2.71–2.79)** | **94, 97 (2.10–2.33 / 2.25–2.55)** |
| Merged eager chunks (20 files instead of 28) | h1 | 73–74 (3.55–3.63 / 5.00) | 77 (3.55 / 4.40) |
| Merged eager chunks | h2 + gzip | 91, 91 (2.57 / 2.89) | — |
| No editorial images (upper bound for deferring them) | h1 | 74 ×3 (3.70 / 4.78) | n/a |
| No editorial images | h2 + gzip | 90, 90 (2.70 / 3.04) | n/a |
| Static shell (skip link + header) in `index.html`, `createRoot` | h1 | 74, 74, 77 (3.15 / 4.70–5.22) | 77 ×3 (3.15 / 4.70) |
| Static shell | h2 + gzip | 91 (2.40 / 3.03), 1 valid run | — |
| Full DOM snapshot in `index.html`, `createRoot` | h1 | 72–74 (3.15–3.47 / 5.43–5.51) | 76 (3.15 / 4.91) |
| Merged chunks + no editorial images + static shell | h1 | 79, 80 (2.71–3.01 / 4.51) | 85, 80 (1.81–2.86 / 4.26–4.41) |
| Same combination | h2 + Brotli | 92, 95 (2.10–2.53 / 2.58–2.78) | 96, 96 (1.95 / 2.40) |

## Ranked candidates

"Legitimate" means the change also applies to the real Vercel delivery and loads the same images, fonts and features, mock backend included.

| # | Candidate | Metric(s) | Expected effect | Effort | Risk | Verdict |
|---|---|---|---|---|---|---|
| 1 | Audit over HTTPS + HTTP/2 + Brotli (Vercel URL, or a local server with the same protocol) | FCP, LCP, SI | **Measured +18 / +15 (gzip), about +20 (Brotli)** | Low (audit config only) | Real Vercel adds TLS and edge latency; must be re-measured there | **Legitimate**: this is the production delivery |
| 2 | Merge eager chunks (`codeSplitting.groups`) | FCP, LCP | Measured +1–2 (h1), +1 (h2) | Low | Groups that are too broad pull lazy code into the eager set; check `dist/index.html` | Legitimate |
| 3 | Less pre-paint JS: `zod/mini` in route schemas; lazy account menu, tooltip and dialogs; one dictionary per locale | FCP, LCP | ~5 ms per KB; maybe 50–70 KB → −0.25 to −0.35 s → about +3–5 (estimate) | Medium | Behaviour changes in forms and menus; zod/mini has a different API | Legitimate |
| 4 | Static shell placeholder in `index.html` | FCP, SI | Measured FCP −0.6 s on h1 (+2), +1 on h2; results vary from run to run | Low–medium | Markup drift; pt-BR text flashes before an `en` locale applies | Legitimate (static content only) |
| 5 | Defer below-the-fold editorial and hero-slide images until near the viewport | LCP (pessimistic) | Measured +2 on h1 home; 0 on h2 | Low | Must not shift layout (sizes are already fixed) | Legitimate; also helps real slow-4G users |
| 6 | Drop tough-cookie from the mock chunk with a stub, like the existing `tldts` stub | FCP, LCP | Maybe −10 to −15 KB (estimate, not measured) | Medium | MSW calls its `CookieJar` on every request | Legitimate, same reasoning as the `tldts` stub |
| 7 | Drop one Roboto Mono weight (3 × 13 KB `VeryHigh` fonts are in the FCP graph) | FCP | About −13 KB → −0.06 s (estimate) | Low | Design fidelity | Legitimate if the design allows it |
| 8 | Right-size card and detail images (`sizes` closer to the real 174 / 380 CSS px) | Real-user LCP; not the score | Lantern counts SW-served images as 0 bytes | Low | None | Legitimate; no score effect expected |
| 9 | Build-time prerender with `hydrateRoot` (static shell and hero; API data excluded) | FCP; LCP only if the LCP element were static | Inferred: LCP ≈ FCP when the LCP element is in the HTML; here it is API data | High | Hydration mismatches; a whole new build step | Legitimate for static parts; **gray** for API data (see Rejected) |

### 1. Audit the delivery over HTTPS + HTTP/2 + Brotli

- **What it changes:** in Lantern, an HTTP/1.1 origin has 6 connections, each with its own slow start and one request at a time. An HTTP/2 origin is one warmed connection (`ConnectionPool.js:45-58`). With 27 eager files, that difference alone moved home from 72 to 90 and detail from 75 to 91, with the same bytes and the same mock backend. Brotli saves about 14% more on JS and 17% on CSS than gzip ([Vercel compression](https://vercel.com/docs/how-vercel-cdn-works/compression)), and that brought the scores to 92–97.
- **Why it is legitimate:**
  - Vercel serves every deployment over HTTPS ([Vercel CDN security](https://vercel.com/docs/cdn-security)).
  - It negotiates HTTP/1.1 and HTTP/2 through ALPN (same page).
  - It compresses JS, CSS, HTML and JSON with Brotli when the client accepts it ([Vercel compression](https://vercel.com/docs/how-vercel-cdn-works/compression)).
  - The challenge asks for "build otimizado e o cenário padrão dos mocks" and does not name the server ([challenge §10](https://github.com/junglegaming/frontend-challenge)).
  - The bytes, images, fonts and features are identical. `vite preview` over HTTP/1.1 is in fact the setup least like the delivery: the current config already skips `uses-http2` because of it (`lighthouse/base.cjs:16`).
- **How:**
  - **(a)** In `lighthouse/base.cjs`, point `collect.url` at the Vercel deployment and drop `startServerCommand`. LHCI supports remote URLs ([LHCI configuration](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)).
  - **(b)** For a local run, serve over TLS + HTTP/2. Vite's `preview.https` enables "TLS + HTTP/2" ([Vite preview options](https://vite.dev/config/preview-options)). This needs a trusted local certificate, or `--ignore-certificate-errors` in `chromeFlags`.
  - *Not verified:* whether `vite preview` serves Brotli. Its docs do not mention compression. The h1 transfer sizes match gzip.
  - Record the environment in `summary.md` either way.
- **Risks:**
  - Against the real edge, Lantern adds the observed per-origin server response time to every request (`ConnectionPool.js:40`). TLS adds a round trip (TTFB went from 452 to 608 ms locally).
  - The local result does not prove the Vercel result.
  - At 90/91 with gzip, the margin is thin. Pair this with 2 and 3.

### 2. Fewer eager chunks

- **Today:** `dist/index.html` loads 1 entry plus 26 `modulepreload` files plus 1 CSS. Many are under 1 KB (`store` 0.6 KB, `useNavigate` 0.75 KB, `queries` 0.5 KB).
- **Test:** one Rolldown group for the libraries that are always eager (react, react-dom, scheduler, router, query, axios, zod, zustand, tailwind-merge, clsx, cva) cut the eager files from 28 to 20 with no change in total bytes (251 KB vs 258 KB gzip).
- **Effect:** FCP −0.2 s on h1. More grouping, for example of the small app-shell chunks, should help further on h1 (inferred).
- **Vite 8 / Rolldown option:** `build.rolldownOptions.output.codeSplitting.groups`. `manualChunks` is deprecated in its favour (`node_modules/.pnpm/rolldown@1.2.16/node_modules/rolldown/dist/shared/define-config-u93KkixF.d.mts:791-830`).
- **Risk:** a group that matches route-only libraries (Radix slider, select, tabs) makes them eager. Check the eager list after each change.

### 3. Less JS before first paint

Every eager KB is in both FCP graphs and both LCP graphs. At 204.8 KB/s that is about 4.9 ms of simulated time per KB (inferred from the throttling constants; slow start and CPU add to it).

Candidates:
- **`zod/mini` for the route `validateSearch` schemas.** Zod's docs show 2.12 KB vs 5.91 KB gzip for a trivial schema, and 4.0 KB vs 13.1 KB for a small object ([Zod Mini](https://zod.dev/packages/mini)). They also say regular Zod is usually the better choice unless bundle size is a strict constraint. The full library is 28.6 KB gzip here.
  - *Not verified:* how much survives, because the mock backend and forms also import the contracts. Keeping full zod for forms and the mock (both loaded later) and mini only in the route files is the variant that would move the score.
- **Radix menu, tooltip, popper and Floating UI in the entry chunk** (about 160 KB of source). These are the account dropdown and the tooltips; the root layout pulls in `TooltipProvider` and `Toaster` (`src/routes/__root.tsx:9-10`). Load them on first interaction or after idle.
- **Dialog and sheet code** (`es2015`, 10 KB) on demand.
- **One i18n dictionary per locale.** Both pt-BR and en are eager today (17 KB together).

ARCHITECTURE.md §12 already lists these as next steps. The new evidence is the per-KB cost and the h1/h2 split: on h2 they are what turns a bare 90 into a robust margin.

### 4. Static shell in `index.html`

- **How it works:** put the skip link and header markup (static text, no API data) inside `<div id="root">`. React's `createRoot` clears existing HTML on the first `render` ([React createRoot](https://react.dev/reference/react-dom/client/createRoot)), so this is a placeholder, not hydration.
- **Effect:** observed FCP moves from about 106 ms to 35–50 ms. That is before the fonts and the mock chunk finish, so they leave the FCP graph. Simulated FCP fell from 3.78 to 3.15 s on h1.
- **Why it varies:** FCP only gets small when the paint beats the module downloads, and on localhost those finish in about 20 ms. One combined run scored FCP 1.81 s and another 2.86 s. Expect noise.
- **Legitimacy:** legitimate. The same HTML is what users get first, on any network.

### 5. Defer below-the-fold images

- **The problem:** the promo, journal and hero off-screen images load while the catalog is a skeleton, because they fall inside Chrome's lazy-load distance (see above).
- **Fix:** render them only near the viewport (an `IntersectionObserver` with a small `rootMargin`), or render the editorial sections after the first catalog page.
- **Measured upper bound:** home LCP −0.44 s on h1 (5.22 → 4.78). No change on h2, where LCP was no longer limited by bandwidth.
- **Side effect:** the home LCP image would then be fetched only after the API answers, like on the detail page. *Inferred:* this is why the gain is smaller than the 195 KB removed would suggest.
- **Real-user benefit:** these images compete with the critical JS on a real slow connection too.

### 6–8. Smaller items

- **tough-cookie stub.** MSW's `CookieStore` builds a tough-cookie `CookieJar` and reads it on every request (`node_modules/msw/src/core/utils/cookieStore.ts:1-35`). A stub must return the same shapes. This is riskier than the existing `tldts` stub (`src/mocks/tldts-stub.ts`), which only replaces a lookup.
- **Fonts.** Three `VeryHigh` WOFF2 files are already `font-display: swap` (built CSS). Preloading them would pull them into the FCP graph *earlier*. That is the wrong direction for the score, though neutral for users.
- **Image `sizes`.** Cards render 174 CSS px but `sizes="50vw"` asks for 206 px, so the 640w file is used (`src/ui/nft-image.tsx:13`). Correct `sizes` would save about 11 KB per card for users. Lantern sees these images as 0 bytes because they go through the worker, so the score will not move.

### 9. Prerender with hydration

- **Snapshot without hydration does not help LCP.** Dumping the fully rendered DOM into `index.html` and keeping `createRoot` made LCP *worse* (5.43–5.51 s). React discards the snapshot, and the real card image paints again at about 300 ms.
- **What would work:** real static generation needs `hydrateRoot` ([React createRoot](https://react.dev/reference/react-dom/client/createRoot), Pitfall: "Apps using server rendering or static generation must call `hydrateRoot`"), plus a server render of the TanStack Router tree.
- **Why it is mostly gray here:** it only pulls LCP down if the LCP element is in the HTML. On both pages the LCP element is API data, and the API is the in-browser mock. A removed element stays the LCP candidate unless a larger one paints ([web.dev LCP](https://web.dev/articles/lcp)).
- **Verdict:** high effort; prerendering only the static parts gives about what #4 gives.

## Rejected ideas and why

- **Routing eager JS through the service worker so Lantern counts it as 0 bytes.** Lantern drops worker-initiated fetches (`PageDependencyGraph.js:56-57`). Delaying the app bundle until MSW is active would hide its bytes from the simulation without making anything faster. **Audit-only gaming. Do not do it.**
- **Prerendering the catalog or NFT detail from mock fixtures at build time.**
  - The mock world is per browser and persisted per scenario (ARCHITECTURE.md §10). Baked HTML would show data this browser's "backend" never served, such as a sold item or a changed price, until React replaces it.
  - With a real API it would be SSR or ISR, so the technique itself is sound. Here it would mean faking the backend's answer in HTML. Gray at best; not recommended.
- **Changing which element is LCP** (for example, enlarging hero text over the card image). It deviates from the Figma purely for the metric.
- **A different mock scenario or lower simulated latency for the audit.** The challenge requires the default scenario. *Inferred:* the mock's `delay()` runs in page JS and is neither a CPU task nor network time, so Lantern barely sees it anyway.
- **Preloading the LCP image.** Its URL comes from the API response (`lcp-discovery-insight`: "Request is discoverable in initial document: false"). `fetchpriority=high` is already on it (detail checklist: `priorityHinted: true`).
- **`modulepreload` of the mock chunk.** Already tried and rejected (ARCHITECTURE.md §12). It is consistent with the model: it does not reduce bytes, and the chunk already starts at 38 ms.
- **Starting MSW earlier or in parallel.** Worker registration time is not in the graph, and moving it does not remove bytes. Already measured as "sem efeito" (ARCHITECTURE.md §12).
- **Preconnect / early hints.** Everything is same-origin, so there is no third-party connection to warm (inferred). Early hints would only reorder requests that already start at 6–9 ms.
- **Cache-Control tuning on Vercel.** Lighthouse clears caches and service workers before each run (`.../lighthouse/core/config/constants.js:68`), so only repeat visits benefit. The current `vercel.json` headers are already right for that.
- **Disabling the mock, or detecting Lighthouse.** Explicitly against the challenge rule and ADR 0005.

## What I could not verify

- **Scores against the real Vercel deployment.** All h2 numbers come from a local Node HTTP/2 server with a self-signed certificate. The real edge adds latency and TLS that Lantern will count.
- **Whether `vite preview` with `preview.https` serves Brotli,** and whether its HTTP/2 mode behaves like my server. Its docs say "TLS + HTTP/2" and say nothing about compression.
- **The exact HTTP/2 queueing mechanism inside Lantern.** I read the connection-pool code, but the explanation of *why* h2 wins by this much is inferred. The measured effect is not inferred.
- **Savings from zod/mini, lazy Radix, the tough-cookie stub and per-locale dictionaries.** These are estimates from the per-KB model and were not built or measured.
- **The browser.** Experiments used Brave's Chromium 156 rather than Chrome 156. The baseline matched the published reports, but small differences are possible.

## Sources

- Lighthouse throttling docs: https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
- Lighthouse 12.6.1 metric scoring: https://github.com/GoogleChrome/lighthouse/blob/v12.6.1/core/audits/metrics/ (`first-contentful-paint.js`, `largest-contentful-paint.js`, `speed-index.js`); weights and settings in the local `lighthouse@12.6.1` package (`core/config/default-config.js:408-412`, `core/config/constants.js:61-68`)
- Lantern source (as compiled in `@paulirish/trace_engine@0.0.53`, upstream https://github.com/ChromeDevTools/devtools-frontend/tree/main/front_end/models/trace/lantern): `metrics/FirstContentfulPaint.js`, `metrics/LargestContentfulPaint.js`, `metrics/Metric.js`, `metrics/SpeedIndex.js`, `graph/NetworkNode.js`, `graph/PageDependencyGraph.js`, `simulation/ConnectionPool.js`, `simulation/TCPConnection.js`, `simulation/Simulator.js`, `simulation/Constants.js`
- web.dev, browser-level lazy loading: https://web.dev/articles/browser-level-image-lazy-loading
- web.dev, LCP: https://web.dev/articles/lcp
- React `createRoot` / `hydrateRoot`: https://react.dev/reference/react-dom/client/createRoot
- TanStack Router code splitting: https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting
- Zod Mini: https://zod.dev/packages/mini
- Vite preview options: https://vite.dev/config/preview-options
- Vercel CDN security (HTTPS, ALPN HTTP/1.1 and HTTP/2): https://vercel.com/docs/cdn-security
- Vercel compression (gzip and Brotli): https://vercel.com/docs/how-vercel-cdn-works/compression
- Lighthouse CI configuration: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
- Challenge §10: https://github.com/junglegaming/frontend-challenge
- Repo: `docs/lighthouse/mobile/*.json`, `lighthouse/base.cjs`, `src/main.tsx`, `src/routes/index.tsx`, `src/routes/__root.tsx`, `src/features/catalog/editorial.tsx`, `src/features/catalog/hero.tsx`, `src/ui/nft-image.tsx`, `public/mockServiceWorker.js`, `node_modules/msw/src/core/utils/cookieStore.ts`

## Follow-up (2026-11-04): results on the deployment

- **Auditing the deployment** (HTTPS, HTTP/2, Brotli on Vercel; same asset hashes as `pnpm build`), 3-run median, Chrome 156: mobile home 89, detail 90; desktop 100 and 100.
- **Candidate 2 (one `vendor` chunk, 28 → 20 startup files)**, Chrome 157: locally over HTTP/2 + Brotli home went from 88/93/93 to 92/95/95 and detail stayed flat (97/94 → 96/95/95). On the deployment: home 88, detail 92. The home gain did not carry over; the change is within run-to-run noise there.
- **Candidate 3, `zod/mini` in the route schemas only: no effect expected.** Every REST response is parsed with the full zod contracts (`src/app/api/endpoints.ts:34`), including the catalog page the home LCP depends on, so the full library stays on the critical path regardless of the route schemas.
- **Candidate 5, deferring the promo and journal images** with an IntersectionObserver (one screen of margin) instead of native lazy loading: home image bytes at load fell from 201 KB to 25 KB locally, and the score did not change (90/94/94 vs 89/94/94). Reverted: no score effect, and a full-page visual baseline would no longer show those images.
- **Candidate 4, static header in `index.html`** (header box and logo only, no controls or session-dependent content): locally over HTTP/2 + Brotli, FCP 2.25 → 2.10 s, home median 94 → 95, detail 95 → 96, CLS 0. On the deployment: **mobile home 90, detail 95** (from 88 and 92), desktop 100 and 100. Every target is met; the home page has no margin.
