import { createFileRoute } from '@tanstack/react-router'
import { NftDetailPage } from '@/features/nft/detail-page'
import { nftQuery } from '@/features/nft/queries'

export const Route = createFileRoute('/nft/$nftId')({
  // Starts the request early (also on link hover, via preload) without blocking the page: the
  // page shows its own skeleton, not-found and error states.
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftQuery(params.nftId))
  },
  component: DetailRoute,
})

function DetailRoute() {
  const { nftId } = Route.useParams()
  return <NftDetailPage nftId={nftId} />
}
