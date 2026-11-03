// Socket.IO side of the mock backend (module-design §3). Bridges World events to real
// socket.io-client connections through @mswjs/socket.io-binding.
// Spike constraints (ADR 0001): websocket transport only, the token travels in the URL query,
// and the mock must send Engine.IO pings itself or clients time out after ~30 s.
import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { RealtimeEvent } from '@/contracts/events'
import type { World, WorldMessage } from '../world/world'

const PING_INTERVAL_MS = 20_000
const HISTORY_SIZE = 50

interface Connection {
  io: ReturnType<typeof toSocketIo>
  close(): void
  /** null for Guests, who only receive public events. */
  collectorId: string | null
}

export interface RealtimeHub {
  handler: ReturnType<ReturnType<typeof ws.link>['addEventListener']>
  /** Closes every connection; clients reconnect on their own (simulated outage). */
  dropAll(): void
  /** Re-sends the latest event (or the given one) to its audience: the client must ignore it. */
  emitDuplicate(eventId?: string): void
  /** Re-sends an older event for a resource: the client must not regress to it. */
  emitStale(resourceId: string): void
  connectionCount(): number
}

export function createRealtimeHub(world: World, url: string): RealtimeHub {
  const link = ws.link(`${url}/*`)
  const connections = new Set<Connection>()
  const history: WorldMessage[] = []

  const deliver = ({ event, audience }: WorldMessage) => {
    for (const conn of connections) {
      if (audience === 'all' || audience === conn.collectorId) conn.io.client.emit(event.type, event)
    }
  }

  world.subscribe((message) => {
    history.push(message)
    if (history.length > HISTORY_SIZE) history.shift()
    deliver(message)
  })

  const handler = link.addEventListener('connection', async (connection) => {
    const io = toSocketIo(connection)
    const token = new URL(connection.client.url).searchParams.get('token')
    let collectorId: string | null = null
    if (token) {
      // The binding acknowledges the handshake itself, so an invalid Session is refused by closing.
      const session = await world.exec('auth.session', undefined, { token })
      if (!session.ok) {
        connection.client.close(4401, session.error.code)
        return
      }
      collectorId = session.value.collector.id
    }

    const conn: Connection = { io, close: () => connection.client.close(), collectorId }
    connections.add(conn)
    const ping = setInterval(() => connection.client.send('2'), PING_INTERVAL_MS)
    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      connections.delete(conn)
    })
  })

  return {
    handler,
    dropAll() {
      for (const conn of connections) conn.close()
    },
    emitDuplicate(eventId) {
      const message = eventId ? history.find((m) => m.event.eventId === eventId) : history.at(-1)
      if (message) deliver(message)
    },
    emitStale(resourceId) {
      const forResource = history.filter((m) => m.event.resourceId === resourceId)
      const older = forResource.at(-2) ?? forResource.at(0)
      if (older) deliver(older)
    },
    connectionCount: () => connections.size,
  }
}

export type { RealtimeEvent }
