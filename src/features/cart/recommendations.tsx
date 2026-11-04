// "Colecionadores também viram": a strip of other listings under the Cart (desktop Figma frame).
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import type { CatalogQuery } from '@/contracts/catalog'
import { useT } from '@/lib/i18n'
import { EthAmount } from '@/ui/eth'
import { Skeleton } from '@/ui/feedback'
import { NftImage } from '@/ui/nft-image'

const QUERY: CatalogQuery = { sort: 'recent' }
const COUNT = 5

export function Recommendations({ exclude }: { exclude: ReadonlySet<string> }) {
  const t = useT()
  const { data } = useQuery({
    queryKey: keys.catalog(QUERY),
    queryFn: ({ signal }) => api.catalog.list(QUERY, { signal }),
  })
  const items = data?.items.filter((nft) => !exclude.has(nft.id)).slice(0, COUNT)

  return (
    <section aria-labelledby="recommendations-title" className="flex flex-col gap-8">
      <h2
        id="recommendations-title"
        className="border-b border-border pb-3 text-[17px] font-bold text-highlight"
      >
        {t('purchase.cart.recommendations')}
      </h2>
      <ul className="-mx-4 flex snap-x gap-6 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
        {items
          ? items.map((nft) => (
              <li key={nft.id} className="w-44 shrink-0 snap-start md:w-auto">
                <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="group flex flex-col gap-3">
                  <div className="bg-card p-3">
                    <NftImage image={nft.image} alt={nft.imageAlt} sizes="(min-width: 768px) 220px, 176px" />
                  </div>
                  <span className="text-[15px] group-hover:text-primary-hover">{nft.name}</span>
                  <span className="-mt-2 font-bold text-highlight">
                    <EthAmount value={nft.price} />
                  </span>
                </Link>
              </li>
            ))
          : Array.from({ length: COUNT }, (_, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- static placeholders
              <li key={i} className="w-44 shrink-0 md:w-auto">
                <Skeleton className="aspect-square w-full" />
              </li>
            ))}
      </ul>
    </section>
  )
}
