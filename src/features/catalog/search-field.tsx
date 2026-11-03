// Search box: types freely, writes `q` to the URL 300 ms after the last keystroke with `replace`
// (docs/decisions.md §Interaction safety). The query layer cancels the superseded request.
import { SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { useCatalogSearch } from './use-catalog-search'

export const SEARCH_DEBOUNCE_MS = 300

export function SearchField({ className, inputClassName }: { className?: string; inputClassName?: string }) {
  const t = useT()
  const id = useId()
  const { search, setFilters } = useCatalogSearch()
  const urlValue = search.q ?? ''
  const [text, setText] = useState(urlValue)
  const [seen, setSeen] = useState(urlValue)
  // The last value this box wrote, so its own write coming back never clobbers newer typing.
  const [written, setWritten] = useState<string | null>(null)

  // `q` changed: back/forward or "clear filters" show what the URL says now.
  if (urlValue !== seen) {
    setSeen(urlValue)
    if (urlValue !== written) setText(urlValue)
    setWritten(null)
  }

  useEffect(() => {
    const next = text.trim()
    if (next === urlValue) return
    const timer = setTimeout(() => {
      setWritten(next)
      void setFilters({ q: next || undefined }, { replace: true })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, urlValue, setFilters])

  return (
    <search className={cn('relative flex items-center', className)}>
      <label htmlFor={id} className="sr-only">
        {t('catalog.search.label')}
      </label>
      <SearchIcon aria-hidden className="pointer-events-none absolute left-4 size-5 text-muted-foreground" />
      <input
        id={id}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            e.preventDefault()
            setText('')
          }
        }}
        placeholder={t('catalog.search.placeholder')}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={80}
        className={cn(
          'h-12 w-full rounded-xl bg-card pr-10 pl-12 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-search-cancel-button]:hidden',
          inputClassName,
        )}
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          aria-label={t('catalog.search.clear')}
          className="absolute right-2 grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      )}
    </search>
  )
}
