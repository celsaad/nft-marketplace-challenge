import { describe, expect, it } from 'vitest'
import { clampQuantity, defaultEdition, editionLabel, limitReason, maxQuantity } from './editions'

const ed = (size: number | null, available: number) => ({ id: `ed_${size ?? 'open'}`, size, available })

describe('Editions', () => {
  it('labels Editions like the Figma chips', () => {
    expect(editionLabel(ed(50, 3), 'Aberta')).toBe('1/50')
    expect(editionLabel(ed(null, 999), 'Aberta')).toBe('ABERTA')
  })

  it('starts on the first Edition that is still available', () => {
    expect(defaultEdition([ed(1, 0), ed(10, 4)])?.id).toBe('ed_10')
    expect(defaultEdition([ed(1, 0)])?.id).toBe('ed_1')
  })

  it('caps the quantity by Availability and by the per-order limit', () => {
    expect(maxQuantity(ed(50, 3), 10)).toBe(3)
    expect(maxQuantity(ed(null, 999), 10)).toBe(10)
    expect(maxQuantity(ed(1, 0), 10)).toBe(0)
  })

  it('shrinks a chosen quantity when Availability drops, never below 1', () => {
    expect(clampQuantity(7, 3)).toBe(3)
    expect(clampQuantity(0, 3)).toBe(1)
    expect(clampQuantity(2, 0)).toBe(1)
  })

  it('explains which limit stops the stepper', () => {
    expect(limitReason(3, ed(50, 3), 10)).toBe('available')
    expect(limitReason(10, ed(null, 999), 10)).toBe('order')
    expect(limitReason(2, ed(50, 3), 10)).toBeNull()
    expect(limitReason(1, ed(1, 0), 10)).toBeNull()
  })
})
