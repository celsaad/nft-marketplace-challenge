// Named, reproducible states of the mock world. A Scenario changes the seed data and/or how the
// simulated network behaves; everything else is the same deterministic fixture set.
import type { WorldState } from './state'

/** Applied by the MSW adapters, not the World: the World never knows about latency or HTTP. */
export interface NetworkProfile {
  /** Each response waits a random time in this range (ms). */
  latencyMs: [min: number, max: number]
  /** Share of requests answered with 503 TRANSIENT. */
  failureRate: number
  /** Every request fails as a network error. */
  offline: boolean
  /** Order creation succeeds in the World but its HTTP response never arrives (timeout). */
  dropOrderResponse: boolean
}

export interface ScenarioDefinition {
  label: string
  description: string
  network: NetworkProfile
  prepare?: (state: WorldState) => void
}

const NORMAL: NetworkProfile = {
  latencyMs: [150, 400],
  failureRate: 0,
  offline: false,
  dropOrderResponse: false,
}

export const SCENARIOS = {
  default: {
    label: 'Default',
    description: 'Full catalog, two Collectors, payments confirm after 2.5 s.',
    network: NORMAL,
  },
  'empty-catalog': {
    label: 'Empty catalog',
    description: 'No NFTs listed, to see empty states.',
    network: NORMAL,
    prepare: (state) => {
      state.nfts = {}
    },
  },
  'slow-network': {
    label: 'Slow network',
    description: 'Every response takes 2–3.5 s, to see skeletons and pending states.',
    network: { ...NORMAL, latencyMs: [2000, 3500] },
  },
  'variable-latency': {
    label: 'Variable latency',
    description: 'Responses take 50 ms–2.5 s, so they can arrive out of order.',
    network: { ...NORMAL, latencyMs: [50, 2500] },
  },
  flaky: {
    label: 'Flaky server',
    description: '30% of requests fail with 503, to see retries and recovery.',
    network: { ...NORMAL, failureRate: 0.3 },
  },
  offline: {
    label: 'Offline',
    description: 'Every request fails as a network error.',
    network: { ...NORMAL, offline: true },
  },
  'short-session': {
    label: 'Short session',
    description: 'Sessions expire 60 s after login, to see expiry mid-flow.',
    network: NORMAL,
    prepare: (state) => {
      state.behavior.sessionTtlMs = 60_000
    },
  },
  'payment-rejected': {
    label: 'Payment rejected',
    description: 'Every payment is declined after 2.5 s.',
    network: NORMAL,
    prepare: (state) => {
      state.behavior.paymentOutcome = 'reject'
    },
  },
  'slow-confirm': {
    label: 'Manual confirmation',
    description: 'Orders stay pending until confirmed or rejected from the Mock Lab.',
    network: NORMAL,
    prepare: (state) => {
      state.behavior.paymentOutcome = 'manual'
    },
  },
  'order-timeout': {
    label: 'Order timeout',
    description: 'The Order is created but its response is lost; retrying recovers the same Order.',
    network: { ...NORMAL, dropOrderResponse: true },
  },
  'wallet-rejected': {
    label: 'Wallet rejects',
    description: 'The simulated wallet rejects every connection request.',
    network: NORMAL,
    prepare: (state) => {
      state.behavior.walletResponse = 'reject'
    },
  },
} satisfies Record<string, ScenarioDefinition>

export type ScenarioName = keyof typeof SCENARIOS
export const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[]
export const isScenarioName = (value: unknown): value is ScenarioName =>
  typeof value === 'string' && value in SCENARIOS
