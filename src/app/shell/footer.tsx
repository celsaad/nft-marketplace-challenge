// Footer from the Figma: feature band with newsletter, contact band, link columns.
// Every action here is out of scope, so each says so instead of pretending to work.
import { useT } from '@/lib/i18n'
import { Input } from '@/ui/primitives/input'
import { notifyUnavailable, UnavailableLink } from '@/ui/unavailable'

const FEATURES = [
  { letter: 'W', title: 'footer.walletSecurity.title', body: 'footer.walletSecurity.body' },
  { letter: 'C', title: 'footer.creators.title', body: 'footer.creators.body' },
  { letter: 'D', title: 'footer.alerts.title', body: 'footer.alerts.body' },
] as const

const COLUMNS = [
  { title: 'footer.profile', links: [0, 1, 2, 3, 4] },
  { title: 'footer.help', links: [5, 6, 7, 8, 9] },
  { title: 'footer.collections', links: [10, 11, 12, 13, 14] },
] as const

const SOCIALS = [
  { label: 'Facebook', mark: 'f' },
  { label: 'Instagram', mark: 'ig' },
  { label: 'X (Twitter)', mark: 'x' },
  { label: 'LinkedIn', mark: 'in' },
  { label: 'YouTube', mark: 'yt' },
]

export function Footer() {
  const t = useT()

  return (
    <footer className="mx-auto mt-24 mb-[calc(var(--bottom-bar,6rem)+1rem)] max-w-[1248px] px-4 md:mb-0 md:px-6">
      <div className="grid gap-8 rounded-t-lg bg-card p-6 md:grid-cols-4 md:p-10">
        {FEATURES.map((feature) => (
          <section
            key={feature.letter}
            className="flex flex-col gap-3 md:border-r md:border-primary/70 md:pr-6"
          >
            <span
              aria-hidden
              className="grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground"
            >
              {feature.letter}
            </span>
            <h2 className="font-bold md:text-[17px]">{t(feature.title)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(feature.body)}</p>
          </section>
        ))}
        <section className="flex flex-col gap-3">
          <h2 className="font-bold leading-tight md:text-lg">{t('footer.newsletter.title')}</h2>
          <form onSubmit={notifyUnavailable} className="flex">
            <label htmlFor="newsletter-email" className="sr-only">
              {t('footer.newsletter.placeholder')}
            </label>
            <Input
              id="newsletter-email"
              type="email"
              placeholder={t('footer.newsletter.placeholder')}
              className="min-w-0 flex-1 rounded-r-none border-0 bg-surface-raised px-2 text-xs md:text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded-r-md bg-primary px-3 font-bold text-primary-foreground md:text-lg hover:bg-primary-hover"
            >
              {t('footer.newsletter.submit')}
            </button>
          </form>
          <p className="text-xs leading-relaxed text-muted-foreground md:text-[13px]">
            {t('footer.newsletter.body')}
          </p>
        </section>
      </div>

      <div className="grid gap-4 bg-band px-6 py-6 text-sm md:grid-cols-4 md:items-center md:px-10">
        <span className="font-bold tracking-[0.2em]">{t('brand.name')}</span>
        <span>{t('footer.madeFor')}</span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>

      <div className="grid gap-8 rounded-b-lg bg-card px-6 py-8 md:grid-cols-4 md:px-10">
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={t(column.title)}>
            <h2 className="mb-3 font-bold md:text-lg">{t(column.title)}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {column.links.map((index) => (
                <li key={index}>
                  <UnavailableLink className="hover:text-primary-hover">
                    {t(`footer.link.${index}`)}
                  </UnavailableLink>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 font-bold md:text-lg">{t('footer.social')}</h2>
            <ul className="flex gap-2">
              {SOCIALS.map((social) => (
                <li key={social.label}>
                  <button
                    type="button"
                    onClick={() => notifyUnavailable()}
                    aria-label={social.label}
                    className="grid size-8 place-items-center rounded-md border border-primary text-xs font-bold text-highlight hover:bg-primary hover:text-primary-foreground"
                  >
                    {social.mark}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-3 font-bold md:text-lg">{t('footer.compatibleWallets')}</h2>
            <p className="inline-block rounded-md border border-primary/60 bg-band px-3 py-1 text-[10px] font-bold tracking-wider text-highlight">
              METAMASK · WALLETCONNECT · COINBASE
            </p>
          </section>
        </div>
      </div>

      <p className="py-6 text-center text-xs md:text-sm">{t('footer.copyright')}</p>
    </footer>
  )
}
