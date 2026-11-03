import { describe, expect, it, vi } from 'vitest'
import { createFavoriteSync } from './sync'

/** A controllable `send`: each call waits until the test resolves or rejects it. */
function deferredSend() {
  const calls: { nftId: string; favorite: boolean; resolve(): void; reject(e: unknown): void }[] = []
  const send = vi.fn(
    (nftId: string, favorite: boolean) =>
      new Promise<void>((resolve, reject) => calls.push({ nftId, favorite, resolve, reject })),
  )
  return { send, calls }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('Favorite sync', () => {
  it('sends a single toggle once and reports it settled', async () => {
    const { send, calls } = deferredSend()
    const onSettled = vi.fn()
    const sync = createFavoriteSync({ send, onFailure: vi.fn(), onSettled })
    sync.set('nft_a', true, false)
    expect(sync.isPending('nft_a')).toBe(true)
    calls[0]?.resolve()
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(onSettled).toHaveBeenCalledWith('nft_a', true)
    expect(sync.isPending('nft_a')).toBe(false)
  })

  it('serializes rapid toggles per NFT and lets the last intent win', async () => {
    const { send, calls } = deferredSend()
    const sync = createFavoriteSync({ send, onFailure: vi.fn() })
    sync.set('nft_a', true, false)
    sync.set('nft_a', false, true)
    sync.set('nft_a', true, false)
    sync.set('nft_a', false, true)
    expect(send).toHaveBeenCalledTimes(1)
    calls[0]?.resolve()
    await flush()
    // The server says "favorite", the Collector last said "not favorite": one more request.
    expect(send).toHaveBeenCalledTimes(2)
    expect(calls[1]?.favorite).toBe(false)
    calls[1]?.resolve()
    await flush()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('sends nothing more when the intents cancel out while a request is in flight', async () => {
    const { send, calls } = deferredSend()
    const sync = createFavoriteSync({ send, onFailure: vi.fn() })
    sync.set('nft_a', true, false)
    sync.set('nft_a', false, true)
    sync.set('nft_a', true, false)
    calls[0]?.resolve()
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('rolls back to the last confirmed state on failure', async () => {
    const { send, calls } = deferredSend()
    const onFailure = vi.fn()
    const sync = createFavoriteSync({ send, onFailure })
    sync.set('nft_a', true, false)
    const error = new Error('503')
    calls[0]?.reject(error)
    await flush()
    expect(onFailure).toHaveBeenCalledWith('nft_a', error, false)
    expect(sync.isPending('nft_a')).toBe(false)
  })

  it('keeps different NFTs independent', async () => {
    const { send, calls } = deferredSend()
    const sync = createFavoriteSync({ send, onFailure: vi.fn() })
    sync.set('nft_a', true, false)
    sync.set('nft_b', true, false)
    expect(send).toHaveBeenCalledTimes(2)
    calls.forEach((c) => c.resolve())
    await flush()
  })

  it('ignores an intent equal to the confirmed state', () => {
    const { send } = deferredSend()
    const sync = createFavoriteSync({ send, onFailure: vi.fn() })
    sync.set('nft_a', true, true)
    expect(send).not.toHaveBeenCalled()
  })
})
