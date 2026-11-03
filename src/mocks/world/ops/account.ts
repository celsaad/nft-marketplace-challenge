// Sessions, sign-up and the Collector's own profile.
import {
  ChangePasswordInputSchema,
  SignupInputSchema,
  UpdateAvatarInputSchema,
  UpdateProfileInputSchema,
} from '@/contracts/account'
import { authenticate, type Core, openSession, sessionFor, toCollector } from '../core'
import { hashPassword, verifyPassword } from '../password'
import { fail, type Result, succeed } from '../result'
import type { Handlers, OpName } from '../types'
import { validate } from '../validate'
import { mergeGuestCart } from './cart'

/** The conflict error when another Collector already uses this email or username. */
function identityTaken(
  core: Core,
  { email, username }: { email: string; username: string },
  exceptId?: string,
): Result<never> | null {
  const others = Object.values(core.state.collectors).filter((c) => c.id !== exceptId)
  if (others.some((c) => c.email === email.toLowerCase())) {
    return fail('EMAIL_TAKEN', 'Email already registered', { email: 'validation.emailTaken' })
  }
  if (others.some((c) => c.username === username)) {
    return fail('USERNAME_TAKEN', 'Username already taken', { username: 'validation.usernameTaken' })
  }
  return null
}

export const accountHandlers = {
  async 'auth.login'(core, { email, password }, ctx) {
    const collector = Object.values(core.state.collectors).find((c) => c.email === email.toLowerCase())
    if (!collector || !(await verifyPassword(password, collector.passwordSalt, collector.passwordHash))) {
      return fail('INVALID_CREDENTIALS', 'Invalid email or password')
    }
    const token = openSession(core, collector.id)
    mergeGuestCart(core, ctx.cartId, collector.id)
    return succeed(sessionFor(core, token, collector.id))
  },

  async 'auth.session'(core, _input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    return succeed(sessionFor(core, ctx.token as string, auth.value.id))
  },

  async 'auth.logout'(core, _input, ctx) {
    if (ctx.token) delete core.state.sessions[ctx.token]
    return succeed(null)
  },

  async 'auth.signup'(core, input, ctx) {
    const valid = validate(SignupInputSchema, input)
    if (!valid.ok) return valid
    const { password, ...fields } = valid.value
    const taken = identityTaken(core, { email: fields.email, username: fields.username })
    if (taken) return taken
    const id = core.ids.next('col')
    const passwordSalt = core.ids.next('salt')
    core.state.collectors[id] = {
      ...fields,
      id,
      email: fields.email.toLowerCase(),
      avatarUrl: null,
      ensName: null,
      bio: '',
      passwordSalt,
      passwordHash: await hashPassword(password, passwordSalt),
    }
    const token = openSession(core, id)
    mergeGuestCart(core, ctx.cartId, id)
    return succeed(sessionFor(core, token, id))
  },

  async 'profile.get'(core, _input, ctx) {
    const auth = authenticate(core, ctx)
    return auth.ok ? succeed(toCollector(auth.value)) : auth
  },

  async 'profile.update'(core, input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    const valid = validate(UpdateProfileInputSchema, input)
    if (!valid.ok) return valid
    const taken = identityTaken(core, valid.value, auth.value.id)
    if (taken) return taken
    Object.assign(auth.value, valid.value, { email: valid.value.email.toLowerCase() })
    return succeed(toCollector(auth.value))
  },

  async 'profile.avatar'(core, input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    const valid = validate(UpdateAvatarInputSchema, input)
    if (!valid.ok) return valid
    auth.value.avatarUrl = valid.value.dataUrl
    return succeed(toCollector(auth.value))
  },

  async 'profile.password'(core, input, ctx) {
    const auth = authenticate(core, ctx)
    if (!auth.ok) return auth
    const valid = validate(ChangePasswordInputSchema, input)
    if (!valid.ok) return valid
    const collector = auth.value
    const current = valid.value.currentPassword
    if (!(await verifyPassword(current, collector.passwordSalt, collector.passwordHash))) {
      return fail('VALIDATION', 'Current password is wrong', {
        currentPassword: 'validation.currentPassword',
      })
    }
    collector.passwordSalt = core.ids.next('salt')
    collector.passwordHash = await hashPassword(valid.value.newPassword, collector.passwordSalt)
    return succeed(null)
  },
} satisfies Partial<Handlers<OpName>>
