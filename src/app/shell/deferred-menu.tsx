// A header menu whose code loads on demand. The trigger button renders at once; the menu module
// starts loading on the first sign of intent (hover, focus, touch), and the click that asks for the
// menu swaps in the real Radix menu, opened. From then on it is the plain Radix menu.
import { type ComponentType, cloneElement, lazy, type ReactElement, Suspense, useState } from 'react'

const loadMenus = () => import('./header-menus')

export const LocaleMenu = lazy(() => loadMenus().then((m) => ({ default: m.LocaleMenu })))
export const AccountMenu = lazy(() => loadMenus().then((m) => ({ default: m.AccountMenu })))

export interface DeferredMenuProps {
  /** The button that was already on screen; it becomes the Radix trigger. */
  trigger: ReactElement
  /** How the first open was asked for: from the keyboard, focus goes to the first item. */
  openedWith: 'keyboard' | 'pointer'
}

const preload = () => void loadMenus()

export function DeferredMenu({
  menu: Menu,
  trigger,
}: {
  menu: ComponentType<DeferredMenuProps>
  trigger: ReactElement
}) {
  const [openedWith, setOpenedWith] = useState<DeferredMenuProps['openedWith'] | null>(null)
  if (!openedWith) {
    return cloneElement(trigger as ReactElement<Record<string, unknown>>, {
      // What the Radix trigger announces, so screen readers hear a menu button from the start.
      'aria-haspopup': 'menu',
      'aria-expanded': false,
      onPointerEnter: preload,
      onFocus: preload,
      onTouchStart: preload,
      // Enter or Space on a button fires a click with `detail` 0.
      onClick: (event: MouseEvent) => setOpenedWith(event.detail === 0 ? 'keyboard' : 'pointer'),
    })
  }
  return (
    <Suspense fallback={trigger}>
      <Menu trigger={trigger} openedWith={openedWith} />
    </Suspense>
  )
}
