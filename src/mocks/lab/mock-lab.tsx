// Mock Lab: the human adapter of the Mock API (module-design §2). Lets anyone reproduce the
// challenge's failure flows on the deployed demo. Every control changes the mock backend, which
// then answers through real REST responses and Socket.IO events; nothing here touches app state.
import { FlaskConicalIcon } from 'lucide-react'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/ui/primitives/button'
import { Input } from '@/ui/primitives/input'
import { Label } from '@/ui/primitives/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/ui/primitives/sheet'
import type { MockApi } from '../mock-api'
import type { ScenarioName } from '../world/scenarios'

type View = ReturnType<MockApi['inspect']>

const LATENCY_PRESETS = {
  normal: [150, 400],
  slow: [2000, 3500],
  variable: [50, 2500],
} as const satisfies Record<string, [number, number]>

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="text-sm font-bold text-primary">{title}</h3>
      {children}
    </section>
  )
}

function NativeSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-surface-raised px-2 text-sm"
      >
        {children}
      </select>
    </div>
  )
}

export function MockLab({ api }: { api: MockApi }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>(() => api.inspect())
  const [scenario, setScenario] = useState<ScenarioName>(api.scenario)
  const [nftId, setNftId] = useState(view.nfts[0]?.id ?? '')
  const [price, setPrice] = useState('0.99')
  const [editionId, setEditionId] = useState(view.nfts[0]?.editions[0]?.id ?? '')
  const [available, setAvailable] = useState('0')
  const priceId = useId()
  const availableId = useId()

  const refresh = () => setView(api.inspect())
  // While open, keep the pickers in sync with the world (e.g. Orders resolving on their own).
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => setView(api.inspect()), 1500)
    return () => clearInterval(timer)
  }, [open, api])

  const nft = view.nfts.find((n) => n.id === nftId)
  const done = (message: string) => {
    toast.info(`Mock Lab: ${message}`)
    refresh()
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) refresh()
      }}
    >
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="fixed bottom-24 left-4 z-50 border-primary bg-card text-primary shadow-lg md:bottom-4"
        >
          <FlaskConicalIcon aria-hidden />
          Mock Lab
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Mock Lab</SheetTitle>
          <SheetDescription>
            Drives the simulated backend. Changes reach the app through real REST responses and Socket.IO
            events.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-8">
          <Section title="Scenario">
            <NativeSelect label="Scenario" value={scenario} onChange={(v) => setScenario(v as ScenarioName)}>
              {api.scenarios.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              {api.scenarios.find((s) => s.name === scenario)?.description}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => api.selectScenario(scenario)}>
                Switch (keep data)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => api.selectScenario(scenario, { reset: true })}
              >
                Switch and reset
              </Button>
            </div>
            <p className="text-xs text-subtle-foreground">Current: {api.scenario}</p>
          </Section>

          <Section title="Network">
            <NativeSelect
              label="Latency"
              value={
                Object.entries(LATENCY_PRESETS).find(
                  ([, range]) =>
                    range[0] === api.network.latencyMs[0] && range[1] === api.network.latencyMs[1],
                )?.[0] ?? 'normal'
              }
              onChange={(v) => {
                api.setNetwork({ latencyMs: [...LATENCY_PRESETS[v as keyof typeof LATENCY_PRESETS]] })
                done(`latency ${v}`)
              }}
            >
              <option value="normal">Normal (150–400 ms)</option>
              <option value="slow">Slow (2–3.5 s)</option>
              <option value="variable">Variable (50 ms–2.5 s)</option>
            </NativeSelect>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  api.setNetwork({ offline: !api.network.offline })
                  done(api.network.offline ? 'offline' : 'online')
                }}
              >
                {api.network.offline ? 'Go online' : 'Go offline'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => (api.failNext('*', 'http503'), done('next request → 503'))}
              >
                Next request: 503
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => (api.failNext('orders.create', 'drop'), done('next order response lost'))}
              >
                Next order: lose response
              </Button>
            </div>
          </Section>

          <Section title="Catalog (emits nft.updated)">
            <NativeSelect
              label="NFT"
              value={nftId}
              onChange={(v) => {
                setNftId(v)
                setEditionId(view.nfts.find((n) => n.id === v)?.editions[0]?.id ?? '')
              }}
            >
              {view.nfts.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} — {n.price} ETH
                </option>
              ))}
            </NativeSelect>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={priceId} className="text-xs">
                  New price (ETH)
                </Label>
                <Input
                  id={priceId}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  try {
                    api.changePrice(nftId, price)
                    done(`price of ${nft?.name} → ${price} ETH`)
                  } catch {
                    toast.error('Mock Lab: invalid ETH amount')
                  }
                }}
              >
                Change price
              </Button>
            </div>
            <NativeSelect label="Edition" value={editionId} onChange={setEditionId}>
              {nft?.editions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.size === null ? 'Open' : `1/${e.size}`} — {e.available} available
                </option>
              ))}
            </NativeSelect>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <Label htmlFor={availableId} className="text-xs">
                  Available
                </Label>
                <Input
                  id={availableId}
                  value={available}
                  onChange={(e) => setAvailable(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const n = Number.parseInt(available, 10)
                  if (!Number.isInteger(n) || n < 0) return toast.error('Mock Lab: availability must be ≥ 0')
                  api.setAvailability(editionId, n)
                  done(`availability → ${n}`)
                }}
              >
                Set
              </Button>
            </div>
          </Section>

          <Section title="Realtime">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => (api.dropRealtime(), done('connections dropped'))}
              >
                Drop connection
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => (api.emitDuplicate(), done('last event re-sent'))}
              >
                Re-send last event
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => (api.emitStale(nftId), done(`stale event for ${nft?.name}`))}
              >
                Send stale event
              </Button>
            </div>
            <p className="text-xs text-subtle-foreground">Open connections: {api.realtimeConnections()}</p>
          </Section>

          <Section title="Session, wallet and payments">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => (api.expireSession(), done('all Sessions expired'))}
              >
                Expire Sessions
              </Button>
            </div>
            <NativeSelect
              label="Wallet connection requests"
              value="approve"
              onChange={(v) => (api.setWalletResponse(v as 'approve' | 'reject'), done(`wallet will ${v}`))}
            >
              <option value="approve">Approve</option>
              <option value="reject">Reject</option>
            </NativeSelect>
            <NativeSelect
              label="Payments of new Orders"
              value="confirm"
              onChange={(v) => (
                api.setPaymentOutcome(v as 'confirm' | 'reject' | 'manual'), done(`payments → ${v}`)
              )}
            >
              <option value="confirm">Confirm after 2.5 s</option>
              <option value="reject">Reject after 2.5 s</option>
              <option value="manual">Wait for me</option>
            </NativeSelect>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold">Pending Orders</p>
              {view.pendingOrders.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
              {view.pendingOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{order.id}</span>
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => (api.resolveOrder(order.id, 'confirmed'), done('Order confirmed'))}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => (api.resolveOrder(order.id, 'rejected'), done('Order rejected'))}
                    >
                      Reject
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
