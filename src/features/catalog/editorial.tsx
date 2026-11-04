// Out-of-scope home sections drawn in the Figma: the two promo cards and the "Diário da Cunhagem"
// blog. They render as designed, and their links go to the honest "not in this demo" page.
import { ArrowRightIcon } from 'lucide-react'
import { type MessageKey, useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { NftImage } from '@/ui/nft-image'
import { buttonVariants } from '@/ui/primitives/button'
import { UnavailableLink } from '@/ui/unavailable'

const PROMOS = ['figma/emerald-ape', 'figma/ivory-ape'] as const
const POSTS = ['figma/ivory-ape', 'figma/emerald-ape', 'figma/sage-gorilla', 'figma/golden-monkey'] as const

export function PromoCards() {
  const t = useT()
  return (
    <section className="mx-auto grid w-full max-w-[1248px] gap-6 px-4 md:grid-cols-2 md:gap-8 md:px-6">
      {PROMOS.map((image, i) => {
        const title = `promo-${i}-title`
        return (
          <article
            key={image}
            aria-labelledby={title}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center overflow-hidden rounded-md bg-card"
          >
            <NftImage image={image} alt="" sizes="(min-width: 768px) 290px, 45vw" className="rounded-none" />
            <div className="flex flex-col items-end gap-2 p-3 text-right md:gap-3 md:p-4">
              <h2 id={title} className="text-sm font-bold md:text-lg">
                {t(`catalog.promo.${i}.title` as MessageKey)}
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground md:text-sm">
                {t(`catalog.promo.${i}.body` as MessageKey)}
              </p>
              <UnavailableLink
                aria-describedby={title}
                className={cn(buttonVariants({ size: 'sm' }), 'h-8 rounded-sm px-5 text-xs font-bold')}
              >
                {t('catalog.promo.cta')}
                <ArrowRightIcon aria-hidden />
              </UnavailableLink>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export function MintJournal() {
  const t = useT()
  return (
    <section aria-labelledby="journal-title" className="mx-auto w-full max-w-[1248px] px-4 md:px-6">
      <header className="mb-8 flex flex-col items-center gap-3 text-center">
        <h2 id="journal-title" className="text-xl font-bold md:text-[28px]">
          {t('catalog.journal.title')}
        </h2>
        <p className="text-xs text-muted-foreground md:text-sm">{t('catalog.journal.body')}</p>
      </header>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((image, i) => {
          const k = (name: string) => t(`catalog.journal.${i}.${name}` as MessageKey)
          return (
            <li key={image} className="relative flex flex-col overflow-hidden rounded-md bg-card">
              <div className="aspect-[16/11] overflow-hidden">
                <NftImage
                  image={image}
                  alt=""
                  sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw"
                  className="h-full rounded-none object-cover object-top"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-[0.6875rem] text-muted-foreground">
                  {k('date')} <span aria-hidden>|</span> {k('read')}
                </p>
                <h3 className="text-sm font-bold md:text-base">{k('title')}</h3>
                <p className="text-xs font-medium text-muted-foreground">{k('body')}</p>
                <UnavailableLink className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-highlight after:absolute after:inset-0">
                  {t('catalog.journal.readMore')}
                  <span className="sr-only">: {k('title')}</span>
                  <ArrowRightIcon aria-hidden className="size-3" />
                </UnavailableLink>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
