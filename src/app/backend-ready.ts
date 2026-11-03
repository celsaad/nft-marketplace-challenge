// The network layer waits for this before its first request or socket (ADR 0001): main.tsx
// resolves it once the mock backend is running (at once when mocks are off). The UI renders meanwhile.
let resolve: () => void = () => {}

export const backendReady = new Promise<void>((done) => {
  resolve = done
})

export const markBackendReady = () => resolve()
