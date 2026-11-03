// A polite live region for mutation results (removed, quantity saved, coupon applied), so every
// change made by a click is also heard by screen-reader users.
import { useCallback, useState } from 'react'

export function useLiveRegion() {
  const [message, setMessage] = useState({ text: '', n: 0 })
  // The counter re-keys the node, so the same sentence twice in a row is announced twice.
  const say = useCallback((text: string) => setMessage((m) => ({ text, n: m.n + 1 })), [])
  const region = (
    <output aria-live="polite" className="sr-only" data-testid="live-region">
      <span key={message.n}>{message.text}</span>
    </output>
  )
  return { say, region }
}
