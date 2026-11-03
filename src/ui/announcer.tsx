// Turns announcements (realtime changes, session expiry) into words: a polite aria-live region
// for screen readers plus a visible toast. Mounted once in the root layout.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { type Announcement, dismissAnnouncement, useAnnouncer } from '@/app/announcer'
import { type MessageKey, useT } from '@/lib/i18n'

function messageKeyFor(a: Announcement): { key: MessageKey; tone: 'info' | 'success' | 'warning' } {
  switch (a.kind) {
    case 'cart-item-changed':
      return { key: 'announce.cartItemChanged', tone: 'warning' }
    case 'order-status':
      if (a.status === 'confirmed') return { key: 'announce.orderConfirmed', tone: 'success' }
      if (a.status === 'rejected') return { key: 'announce.orderRejected', tone: 'warning' }
      return { key: 'announce.orderPending', tone: 'info' }
    case 'session-expired':
      return { key: 'session.expired', tone: 'warning' }
    case 'realtime-offline':
      return { key: 'realtime.offline', tone: 'warning' }
    case 'realtime-online':
      return { key: 'realtime.online', tone: 'info' }
  }
}

export function Announcer() {
  const t = useT()
  const queue = useAnnouncer((s) => s.queue)
  const [spoken, setSpoken] = useState('')
  const shown = useRef(new Set<number>())

  useEffect(() => {
    for (const item of queue) {
      if (shown.current.has(item.id)) continue
      shown.current.add(item.id)
      const { key, tone } = messageKeyFor(item)
      const text = t(key)
      setSpoken(text)
      if (tone === 'success') toast.success(text)
      else if (tone === 'warning') toast.warning(text)
      else toast.info(text)
      dismissAnnouncement(item.id)
    }
  }, [queue, t])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {spoken}
    </div>
  )
}
