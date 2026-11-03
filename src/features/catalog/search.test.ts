import { describe, expect, it } from 'vitest'
import { eth } from '@/lib/money/eth'
import { pageWindow } from './catalog-pagination'
import { fromSteps, toSteps } from './price-range'
import { applyFilters, clearFilters, goToPage, hasFilters, toApiQuery, toggle } from './search'

describe('catalog URL state', () => {
  it('sends only what narrows the results: defaults and empty values are left out', () => {
    expect(toApiQuery({ q: '  ', tab: 'all', sort: 'recent', page: 1, category: [] })).toEqual({})
    expect(toApiQuery({ q: ' ape ', tab: 'new', page: 2 })).toEqual({ q: 'ape', tab: 'new', page: 2 })
  })

  it('gives the same query for the same filters in any order (one cache entry per view)', () => {
    expect(toApiQuery({ category: ['music', 'digital-art'] })).toEqual(
      toApiQuery({ category: ['digital-art', 'music'] }),
    )
  })

  it('resets the page on any filter change and keeps the other filters', () => {
    const next = applyFilters({ q: 'ape', page: 3, network: ['polygon'] }, { sort: 'price-asc' })
    expect(next).toEqual({ q: 'ape', network: ['polygon'], sort: 'price-asc' })
  })

  it('changes only the page when paginating', () => {
    expect(goToPage({ q: 'ape', tab: 'trending' }, 2)).toEqual({ q: 'ape', tab: 'trending', page: 2 })
    expect(goToPage({ q: 'ape', page: 2 }, 1)).toEqual({ q: 'ape' })
  })

  it('clears search and filters but keeps tab, sort and the Favorites view', () => {
    const search = { q: 'x', category: ['music' as const], tab: 'new' as const, sort: 'name' as const }
    expect(hasFilters(search)).toBe(true)
    expect(clearFilters(search)).toEqual({ tab: 'new', sort: 'name' })
    expect(hasFilters({ tab: 'new', sort: 'name', page: 2 })).toBe(false)
  })

  it('toggles a value in a multi-select', () => {
    expect(toggle(undefined, 'a')).toEqual(['a'])
    expect(toggle(['a', 'b'], 'a')).toEqual(['b'])
  })
})

describe('price slider steps', () => {
  it('maps ETH to hundredths and back without floating point', () => {
    expect(toSteps(eth('12.3'))).toBe(1230)
    expect(toSteps(eth('0.02'))).toBe(2)
    expect(fromSteps(1230)).toBe(eth('12.3'))
    expect(fromSteps(7)).toBe(eth('0.07'))
  })

  it('rounds the upper bound up so the most expensive NFT stays in range', () => {
    expect(toSteps(eth('1.234'))).toBe(123)
    expect(toSteps(eth('1.234'), { up: true })).toBe(124)
    expect(toSteps(eth('1.23'), { up: true })).toBe(123)
  })
})

describe('pagination window', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(1, 6)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('collapses distant pages into gaps', () => {
    expect(pageWindow(6, 12)).toEqual([1, null, 5, 6, 7, null, 12])
    expect(pageWindow(1, 12)).toEqual([1, 2, null, 12])
    expect(pageWindow(12, 12)).toEqual([1, null, 11, 12])
  })
})
