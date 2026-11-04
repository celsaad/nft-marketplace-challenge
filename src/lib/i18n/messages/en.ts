// The EN dictionary, loaded on demand (only PT-BR, the default, ships in the startup bundle).
// Typed against the PT-BR keys: a missing or extra key fails the typecheck.
import type { MessageKey } from '..'
import { account } from './account.en'
import { catalog } from './catalog.en'
import { common } from './common.en'
import { purchase } from './purchase.en'

export const en: Record<MessageKey, string> = { ...common, ...catalog, ...purchase, ...account }
