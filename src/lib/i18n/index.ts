// Typed dictionaries without an i18n library (docs/decisions.md §UI). PT-BR is the source of
// keys; EN must provide every one of them or the typecheck fails.
import { useCallback } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Locale } from '@/contracts/common'
import { account as accountPt } from './messages/account.pt-BR'
import { catalog as catalogPt } from './messages/catalog.pt-BR'
import { common as commonPt } from './messages/common.pt-BR'
import { purchase as purchasePt } from './messages/purchase.pt-BR'

const ptBR = { ...commonPt, ...catalogPt, ...purchasePt, ...accountPt }
export type MessageKey = keyof typeof ptBR

/** PT-BR is always here; other locales are fetched by `loadLocale` before they are applied. */
const dictionaries: Partial<Record<Locale, Record<MessageKey, string>>> = { 'pt-BR': ptBR }

async function loadLocale(locale: Locale) {
  if (dictionaries[locale]) return
  if (locale === 'en') dictionaries.en = (await import('./messages/en')).en
}

export type Params = Record<string, string | number>

export const useLocale = create<{ locale: Locale }>()(
  persist(() => ({ locale: 'pt-BR' as Locale }), {
    name: 'kurio.locale',
    storage: createJSONStorage(() => localStorage),
  }),
)

/** Keeps <html lang> in step with the chosen locale (screen readers, hyphenation, Lighthouse). */
const syncDocumentLang = (locale: Locale) => {
  if (typeof document !== 'undefined') document.documentElement.lang = locale
}
syncDocumentLang(useLocale.getState().locale)
useLocale.subscribe(({ locale }) => syncDocumentLang(locale))

/** Resolves once the saved locale's dictionary is loaded; the app renders after it (src/main.tsx). */
export const localeReady: Promise<void> = loadLocale(useLocale.getState().locale).catch(() => {
  // The dictionary could not load (offline): fall back to PT-BR rather than show raw keys.
  useLocale.setState({ locale: 'pt-BR' })
})

/** Switches only once the dictionary is loaded, so the UI never shows raw keys in between. */
export async function setLocale(locale: Locale) {
  await loadLocale(locale)
  useLocale.setState({ locale })
}

/** Unknown keys (e.g. a message key from the API) fall back to themselves, never crash. */
export function translate(locale: Locale, key: MessageKey | (string & {}), params?: Params): string {
  const template = ((dictionaries[locale] ?? ptBR) as Record<string, string>)[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

export const isMessageKey = (key: string): key is MessageKey => key in ptBR

/** `t()` bound to the current locale; components re-render when the locale changes. */
export function useT() {
  const locale = useLocale((s) => s.locale)
  return useCallback(
    (key: MessageKey | (string & {}), params?: Params) => translate(locale, key, params),
    [locale],
  )
}

/** For code outside React (toasts from effects, document title). */
export const t = (key: MessageKey | (string & {}), params?: Params) =>
  translate(useLocale.getState().locale, key, params)
