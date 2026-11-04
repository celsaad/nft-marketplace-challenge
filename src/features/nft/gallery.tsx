// Detail gallery: thumbnails of four views of the artwork (the full piece and three close-ups,
// as the Figma shows four thumbnails), the main image and a zoom Dialog.
import { SearchIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import type { NftDetail } from '@/contracts/catalog'
import { type MessageKey, useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { NftImage } from '@/ui/nft-image'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/ui/primitives/dialog'

/** Close-ups are CSS crops of the same file: no extra downloads. */
const VIEWS = [
  { scale: 1, origin: '50% 50%' },
  { scale: 1.9, origin: '50% 32%' },
  { scale: 1.6, origin: '50% 60%' },
  { scale: 1.8, origin: '50% 92%' },
] as const

function View({
  nft,
  view,
  sizes,
  priority,
}: {
  nft: NftDetail
  view: number
  sizes: string
  priority?: boolean
}) {
  const { scale, origin } = VIEWS[view] ?? VIEWS[0]
  return (
    <div className="overflow-hidden rounded-[inherit]">
      <div style={{ transform: `scale(${scale})`, transformOrigin: origin }}>
        <NftImage
          image={nft.image}
          alt={nft.imageAlt}
          sizes={sizes}
          priority={priority}
          className="rounded-none"
        />
      </div>
    </div>
  )
}

export function Gallery({ nft, className }: { nft: NftDetail; className?: string }) {
  const t = useT()
  const [view, setView] = useState(0)
  const viewName = (i: number) => t(`catalog.nft.view.${i}` as MessageKey)

  return (
    <section aria-label={t('catalog.nft.gallery')} className={cn('flex gap-6', className)}>
      <ul className="hidden w-[88px] shrink-0 flex-col gap-3 md:flex">
        {VIEWS.map((_, i) => (
          <li key={viewName(i)}>
            <button
              type="button"
              aria-pressed={view === i}
              aria-label={t('catalog.nft.showView', { view: viewName(i) })}
              onClick={() => setView(i)}
              className={cn(
                'block overflow-hidden rounded-md ring-2 ring-transparent transition-shadow hover:ring-primary/60',
                view === i && 'ring-primary',
              )}
            >
              <span aria-hidden>
                <View nft={nft} view={i} sizes="88px" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="relative min-w-0 flex-1 md:rounded-md md:bg-card md:p-4">
        <div className="rounded-3xl md:rounded-xl">
          <View nft={nft} view={view} sizes="(min-width: 768px) 360px, 100vw" priority />
        </div>
        <Dialog>
          <DialogTrigger
            aria-label={t('catalog.nft.zoom')}
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:text-highlight md:top-6 md:right-6 md:size-8"
          >
            <SearchIcon aria-hidden className="size-5" />
          </DialogTrigger>
          <DialogContent
            showCloseButton={false}
            aria-describedby={undefined}
            className="max-h-[calc(100dvh-2rem)] w-[min(100%-2rem,48rem)] max-w-none gap-3 overflow-auto bg-card p-3 sm:max-w-none md:p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-sm">{t('catalog.nft.zoomTitle', { name: nft.name })}</DialogTitle>
              <DialogClose
                aria-label={t('catalog.nft.close')}
                className="grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              >
                <XIcon aria-hidden className="size-5" />
              </DialogClose>
            </div>
            <NftImage
              image={nft.image}
              alt={nft.imageAlt}
              sizes="(min-width: 800px) 768px, 100vw"
              className="rounded-lg"
            />
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
