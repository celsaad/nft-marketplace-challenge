// The Figma's mobile action panel (NFT detail, cart, checkout): fixed to the bottom of the screen
// below `md`, in the page flow from `md` up. While mounted it replaces the tab bar and publishes
// its height as `--bottom-bar`, which the shell uses to keep the page's end clear of it.
import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { cn } from '@/ui/lib/utils'

export function MobileActionBar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const desktop = window.matchMedia('(min-width: 48rem)')
    const sync = () =>
      root.style.setProperty('--bottom-bar', desktop.matches ? '0px' : `${el.offsetHeight}px`)
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    desktop.addEventListener('change', sync)
    root.dataset.actionBar = ''
    sync()
    return () => {
      observer.disconnect()
      desktop.removeEventListener('change', sync)
      root.style.removeProperty('--bottom-bar')
      delete root.dataset.actionBar
    }
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-[0_-8px_24px_rgb(0_0_0/0.35)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
