# REST is the source of truth; socket events are versioned hints

Every event carries `{eventId, type, resourceId, version, userId?}`. The client applies an event only if its `version` is newer than the last one applied for that resource and its `userId` (when present) matches the current Session. Otherwise it drops the event. After a reconnect, the client refetches its active resources over REST instead of trying to replay missed events. The socket is bound to the Session: it disconnects and reconnects on every login, logout and change of Collector.

## Consequences

- Duplicate, stale and out-of-order events are harmless, so the reconciler is a pure function that can be unit-tested.
- A missed event only costs a refetch, and correctness never depends on delivery.
- Events from a previous Session cannot reach another Collector's cache.
