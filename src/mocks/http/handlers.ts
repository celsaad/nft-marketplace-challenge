// MSW REST adapter: HTTP ↔ World. Thin by design (module-design §1): it reads headers and input,
// applies network conditions, calls the World and serializes the Result. No business rules here.
import { delay, HttpResponse, http } from 'msw'
import { ERROR_STATUS, HEADERS } from '@/contracts/common'
import type { DomainError, Result } from '../world/result'
import { validate } from '../world/validate'
import type { Ctx, World } from '../world/world'
import type { Network } from './network'
import { ROUTES, type Route } from './routes'

const errorResponse = ({
  code,
  message,
  fieldErrors,
}: Pick<DomainError, 'code' | 'message' | 'fieldErrors'>) =>
  HttpResponse.json(
    { error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } },
    { status: ERROR_STATUS[code] },
  )

function toResponse(result: Result<unknown>) {
  if (!result.ok) return errorResponse(result.error)
  return result.value === null ? new HttpResponse(null, { status: 204 }) : HttpResponse.json(result.value)
}

function readCtx(request: Request): Ctx {
  const auth = request.headers.get(HEADERS.authorization)
  return {
    token: auth?.startsWith('Bearer ') ? auth.slice(7) : null,
    cartId: request.headers.get(HEADERS.cartId),
    idempotencyKey: request.headers.get(HEADERS.idempotencyKey),
  }
}

/** Reads a query string into the shape the schemas expect: repeated keys become arrays. */
function readQuery(url: URL): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key).flatMap((v) => v.split(','))
    out[key] = ['category', 'network'].includes(key) ? values : values[0]
  }
  return out
}

async function readInput(
  route: Route,
  request: Request,
  params: Record<string, unknown>,
): Promise<Result<unknown>> {
  let raw: unknown
  if (route.input === 'query') raw = readQuery(new URL(request.url))
  if (route.input === 'body') {
    try {
      raw = await request.json()
    } catch {
      return { ok: false, error: { code: 'VALIDATION', status: 422, message: 'Body must be JSON' } }
    }
  }
  const parsed = route.schema ? validate(route.schema, raw) : { ok: true as const, value: raw }
  if (!parsed.ok) return parsed
  const fromPath = Object.fromEntries((route.params ?? []).map((p) => [p, String(params[p])]))
  const value = route.params?.length ? { ...(parsed.value as object), ...fromPath } : parsed.value
  return { ok: true, value }
}

export function createHttpHandlers(world: World, network: Network, apiBase: string) {
  return ROUTES.map((route) =>
    http[route.method](`${apiBase}${route.path}`, async ({ request, params }) => {
      const ctx = readCtx(request)
      const failure = network.takeFailure(route.op)

      if (network.profile.offline || failure === 'offline') return HttpResponse.error()
      await delay(network.latency())
      // A timeout before the World runs: nothing happened server-side.
      if (failure === 'timeout') await delay('infinite')
      if (failure === 'http500') return errorResponse({ code: 'TRANSIENT', message: 'Internal error' })
      if (failure === 'http503' || network.shouldFail()) {
        return errorResponse({ code: 'TRANSIENT', message: 'Service temporarily unavailable' })
      }

      const input = await readInput(route, request, params)
      if (!input.ok) return toResponse(input)
      const result = await world.exec(route.op, input.value as never, ctx)

      // The World committed the change but the response is lost (ADR 0003 recovery path).
      const loseOrder =
        route.op === 'orders.create' &&
        network.profile.dropOrderResponse &&
        result.ok &&
        network.firstAttempt(ctx.idempotencyKey ?? '')
      if (failure === 'drop' || loseOrder) await delay('infinite')

      return toResponse(result)
    }),
  )
}
