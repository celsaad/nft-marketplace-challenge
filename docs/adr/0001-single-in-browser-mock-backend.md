# One in-browser mock backend feeds both REST and Socket.IO

There is no real backend, so the MSW REST handlers and the MSW Socket.IO binding share one mock database module, saved to `localStorage` under a Scenario-scoped key. Every change to mock data (a REST mutation, a Mock Lab action or a Playwright command) goes through that module, which then emits the matching Socket.IO event. This guarantees REST responses and events never disagree, which the challenge requires. It also keeps simulated events from being triggered by writing to UI state, which is a disqualifying item.

## Consequences

A spike on 2026-11-03 (`prototypes/socket-spike`, kept on a throwaway branch) showed four constraints the code must respect, which aren't obvious from reading it:

- `socket.io-client` is loaded with a dynamic `import()` only after the MSW worker starts. Otherwise it captures the unpatched `WebSocket`.
- The client uses `transports: ['websocket']` only, because the binding can't mock long-polling.
- The mock sends an Engine.IO ping about every 20 s. The binding advertises a heartbeat but never sends one, so the client would time out every 30 s.
- The token travels in the connection URL's query string. The binding acknowledges the handshake before `auth` arrives, so an invalid Session is refused by closing the connection right after it opens.

## Considered Options

- Separate REST and socket mocks with their own fixtures: rejected because they drift and the "same change shows in REST and events" rule becomes manual.
- A tiny real Node server (Express + socket.io): rejected because the challenge requires MSW, and a server makes the static demo deploy harder.
