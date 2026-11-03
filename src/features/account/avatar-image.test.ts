import { describe, expect, it } from 'vitest'
import { fitWithin } from './avatar-image'

describe('fitWithin', () => {
  it('shrinks the longer side to the limit, keeping the aspect ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 256, height: 192 })
    expect(fitWithin(1000, 2000)).toEqual({ width: 128, height: 256 })
  })

  it('never upscales a small image', () => {
    expect(fitWithin(64, 48)).toEqual({ width: 64, height: 48 })
  })

  it('keeps at least one pixel on extreme ratios', () => {
    expect(fitWithin(10_000, 1)).toEqual({ width: 256, height: 1 })
  })
})
