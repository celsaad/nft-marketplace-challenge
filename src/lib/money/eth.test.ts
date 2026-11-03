import { describe, expect, it } from 'vitest'
import { add, compare, eth, formatEth, isZero, percentOf, sub, times } from './eth'

describe('ETH amounts', () => {
  it('adds without floating-point error', () => {
    expect(add(eth('0.1'), eth('0.2'))).toBe('0.3')
    expect(add(eth('26.83'), eth('0.016'))).toBe('26.846')
  })

  it('normalizes equivalent spellings to one canonical form', () => {
    expect(eth('1.1900')).toBe('1.19')
    expect(eth('0.000')).toBe('0')
    expect(eth('007.5')).toBe('7.5')
  })

  it('multiplies a unit price by a whole quantity (Figma cart lines)', () => {
    expect(times(eth('1.19'), 2)).toBe('2.38')
    expect(times(eth('1.39'), 6)).toBe('8.34')
    expect(times(eth('1.79'), 9)).toBe('16.11')
    expect(times(eth('1.19'), 0)).toBe('0')
  })

  it('takes a percentage in basis points, rounding down to the wei', () => {
    expect(percentOf(eth('26.83'), 1000)).toBe('2.683')
    expect(percentOf(eth('0.000000000000000001'), 3333)).toBe('0')
    expect(percentOf(eth('0.000000000000000003'), 5000)).toBe('0.000000000000000001')
  })

  it('recognizes zero however it is spelled', () => {
    expect(isZero(eth('0.000'))).toBe(true)
    expect(isZero(eth('0.000000000000000001'))).toBe(false)
  })

  it('subtracts and compares', () => {
    expect(sub(eth('26.83'), eth('2.683'))).toBe('24.147')
    expect(sub(eth('1'), eth('1.5'))).toBe('-0.5')
    expect(compare(eth('1.19'), eth('1.190'))).toBe(0)
    expect(compare(eth('0.99'), eth('1.19'))).toBe(-1)
    expect(compare(eth('2.29'), eth('1.99'))).toBe(1)
  })

  it.each([
    ['1.19', '1.19 ETH'],
    ['26.846', '26.846 ETH'],
    ['0.016', '0.016 ETH'],
    ['2', '2.00 ETH'],
    ['0', '0.00 ETH'],
    ['1.5', '1.50 ETH'],
    ['0.000000000000000001', '0.000000000000000001 ETH'],
  ])('formats %s for display as %s, never dropping precision', (value, shown) => {
    expect(formatEth(eth(value))).toBe(shown)
  })

  it.each([1.5, -1, Number.NaN])('rejects quantity %s', (qty) => {
    expect(() => times(eth('1'), qty)).toThrow(/Invalid quantity/)
  })

  it.each(['', 'abc', '1e3', '1.', '.5', '1,19', '0.0000000000000000001'])(
    'rejects malformed input %j',
    (bad) => {
      expect(() => eth(bad)).toThrow(/Invalid ETH amount/)
    },
  )
})
