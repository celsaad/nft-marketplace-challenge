import { describe, expect, it } from 'vitest'
import { shortAddress } from './format'

describe('shortAddress', () => {
  it('keeps the start and the last four characters of a long address', () => {
    expect(shortAddress('0x8ba1f109551bD432803012645Ac136ddd64DBA72')).toBe('0x8ba1…BA72')
  })

  it('leaves a short value untouched', () => {
    expect(shortAddress('0x1234')).toBe('0x1234')
  })
})
