// The home hero from the Figma: a three-slide carousel (manual only, no autoplay) with the
// Figma artwork. Slides off screen are inert, so keyboard focus never lands on hidden links.
import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useState } from 'react'
import { type MessageKey, useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { NftImage } from '@/ui/nft-image'
import { Button } from '@/ui/primitives/button'
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from '@/ui/primitives/carousel'
import { CarouselDots, useCarouselState } from './carousel-dots'

const SLIDES = [
  { art: 'figma/emerald-ape', inset: 'figma/sage-gorilla' },
  { art: 'figma/golden-monkey', inset: 'figma/ivory-ape' },
  { art: 'figma/ivory-ape', inset: 'figma/golden-monkey' },
] as const

const key = (i: number, name: string) => `catalog.hero.${i}.${name}` as MessageKey

export function Hero() {
  const t = useT()
  const [api, setApi] = useState<CarouselApi>()
  const { selected } = useCarouselState(api)

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: false }}
      aria-label={t('catalog.hero.label')}
      className="mx-auto w-full max-w-[1200px] px-4 md:px-6"
    >
      <CarouselContent>
        {SLIDES.map((slide, i) => {
          const Title = i === 0 ? 'h1' : 'p'
          return (
            <CarouselItem
              key={slide.art}
              aria-label={t('catalog.hero.slide', { n: i + 1, total: SLIDES.length })}
              inert={i !== selected}
            >
              <div className="relative grid min-h-48 pb-9 grid-cols-[minmax(0,1fr)_40%] items-center gap-3 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#5a3a24] via-[#3a2416] to-[#2a1a12] p-4 pr-3 md:grid-cols-[minmax(0,1fr)_minmax(0,40%)] md:gap-10 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-12 md:rounded-none md:bg-none md:p-0 md:py-6 md:pb-6">
                {/* Soft circles from the mobile Figma; decorative. */}
                <span
                  aria-hidden
                  className="absolute top-1/2 left-1/3 size-72 -translate-y-1/3 rounded-full bg-white/5 md:hidden"
                />
                <div className="relative flex flex-col gap-2 md:gap-4 md:pl-10">
                  <p className="text-[0.8125rem] text-foreground md:text-xs">{t('catalog.hero.welcome')}</p>
                  <Title className="text-lg leading-snug font-bold tracking-wide uppercase md:text-3xl md:leading-[1.4] lg:text-[2.5rem] lg:leading-[1.5]">
                    <span className="md:hidden">{t(key(i, 'titleMobile'))}</span>
                    <span className="hidden md:inline">{t(key(i, 'title'))}</span>
                  </Title>
                  <p className="text-xs leading-relaxed text-muted-foreground md:max-w-[34rem] md:text-sm md:leading-relaxed">
                    <span className="md:hidden">{t(key(i, 'bodyMobile'))}</span>
                    <span className="hidden md:inline">{t(key(i, 'body'))}</span>
                  </p>
                  <Link
                    to="/"
                    hash="mercado"
                    search={(prev) => prev}
                    className="inline-flex items-center gap-2 text-sm font-bold text-primary uppercase md:hidden"
                  >
                    {t('catalog.hero.explore')}
                    <ArrowRightIcon aria-hidden className="size-4" />
                  </Link>
                  <Button
                    asChild
                    className="mt-4 hidden h-9 w-fit rounded-sm px-7 text-xs font-bold uppercase md:inline-flex"
                  >
                    <Link to="/" hash="mercado" search={(prev) => prev}>
                      {t('catalog.hero.explore')}
                    </Link>
                  </Button>
                </div>
                <div className="relative">
                  <NftImage
                    image={slide.art}
                    alt=""
                    priority={i === 0}
                    sizes="(min-width: 768px) 450px, 40vw"
                    className="rounded-3xl md:rounded-2xl"
                  />
                  <div className="absolute -bottom-2 left-[10%] w-[42%] overflow-hidden rounded-2xl border-2 border-background/40 md:hidden">
                    <NftImage image={slide.inset} alt="" sizes="20vw" className="rounded-2xl" />
                  </div>
                </div>
              </div>
            </CarouselItem>
          )
        })}
      </CarouselContent>
      <CarouselDots
        api={api}
        label={(n) => t('catalog.hero.goTo', { n })}
        className={cn(
          'absolute bottom-3 left-1/2 -translate-x-1/2',
          'md:bottom-8 md:left-[calc(50%-140px)] md:translate-x-0',
        )}
      />
    </Carousel>
  )
}
