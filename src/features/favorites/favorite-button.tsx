import { Link, useRouterState } from '@tanstack/react-router'
import { HeartIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/ui/lib/utils'
import { Button } from '@/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/primitives/dialog'
import { useFavorite, useSignInPrompt } from './use-favorite'

/**
 * The heart. A toggle button (aria-pressed) whose name stays "Favoritar <NFT>", so screen readers
 * announce the state change instead of a new label.
 */
export function FavoriteButton({
  nftId,
  nftName,
  variant = 'icon',
  className,
}: {
  nftId: string
  nftName: string
  variant?: 'icon' | 'labeled'
  className?: string
}) {
  const t = useT()
  const { isFavorite, toggle, pending } = useFavorite(nftId)
  const heart = (
    <HeartIcon aria-hidden className={cn('transition-colors', isFavorite && 'fill-primary text-primary')} />
  )

  if (variant === 'labeled') {
    return (
      <Button
        type="button"
        variant="outline"
        aria-pressed={isFavorite}
        aria-busy={pending || undefined}
        onClick={toggle}
        className={cn(
          'h-10 border-primary bg-transparent px-4 text-primary hover:bg-primary/10 hover:text-primary-hover dark:bg-transparent',
          className,
        )}
      >
        {heart}
        {isFavorite ? t('catalog.favorite.labelOn') : t('catalog.favorite.label')}
      </Button>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-busy={pending || undefined}
      aria-label={t('catalog.favorite.aria', { name: nftName })}
      onClick={toggle}
      className={cn(
        'grid size-9 place-items-center rounded-full bg-background/80 text-primary backdrop-blur-sm transition-colors hover:bg-background [&_svg]:size-[18px]',
        className,
      )}
    >
      {heart}
    </button>
  )
}

/** Guests who press a heart are invited to sign in and come back to this exact page. */
export function FavoriteSignInDialog() {
  const t = useT()
  const open = useSignInPrompt((s) => s.open)
  const redirect = useRouterState({ select: (s) => s.location.href })
  return (
    <Dialog open={open} onOpenChange={(next) => useSignInPrompt.setState({ open: next })}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('catalog.favorite.signInTitle')}</DialogTitle>
          <DialogDescription>{t('catalog.favorite.signInBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => useSignInPrompt.setState({ open: false })}>
            {t('catalog.favorite.signInCancel')}
          </Button>
          <Button asChild>
            <Link
              to="/entrar"
              search={{ redirect }}
              onClick={() => useSignInPrompt.setState({ open: false })}
            >
              {t('header.login')}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
