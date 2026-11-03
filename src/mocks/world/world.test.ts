import { describe, expect, it } from 'vitest'
import { ANA, BRUNO, ok, testWorld } from './testing'

describe('Sessions', () => {
  it('logs a fixture Collector in and recognizes the Session token', async () => {
    const { world } = await testWorld()
    const session = ok(await world.exec('auth.login', ANA, {}))
    expect(session.collector.email).toBe('ana@jungle.test')

    const current = ok(await world.exec('auth.session', undefined, { token: session.token }))
    expect(current.collector.id).toBe(session.collector.id)
  })

  it('expires a Session after its lifetime, distinctly from never having one', async () => {
    const { world, clock } = await testWorld()
    const { token } = ok(await world.exec('auth.login', ANA, {}))
    clock.advance(31 * 60 * 1000)
    expect(await world.exec('auth.session', undefined, { token })).toMatchObject({
      ok: false,
      error: { code: 'SESSION_EXPIRED', status: 401 },
    })
    expect(await world.exec('auth.session', undefined, { token: 'tok_unknown' })).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    })
  })

  it('lets Mock Control expire one Collector’s Session on demand, leaving others alone', async () => {
    const { world } = await testWorld()
    const ana = ok(await world.exec('auth.login', ANA, {}))
    const bruno = ok(await world.exec('auth.login', BRUNO, {}))
    world.control.expireSession(ana.collector.id)
    expect(await world.exec('auth.session', undefined, { token: ana.token })).toMatchObject({
      error: { code: 'SESSION_EXPIRED' },
    })
    expect((await world.exec('auth.session', undefined, { token: bruno.token })).ok).toBe(true)
  })

  it('invalidates the token on logout', async () => {
    const { world } = await testWorld()
    const { token } = ok(await world.exec('auth.login', ANA, {}))
    ok(await world.exec('auth.logout', undefined, { token }))
    expect(await world.exec('auth.session', undefined, { token })).toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    })
  })

  it('rejects a wrong password without saying which field was wrong', async () => {
    const { world } = await testWorld()
    const result = await world.exec('auth.login', { ...BRUNO, password: 'nope' }, {})
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS' } })
  })
})
