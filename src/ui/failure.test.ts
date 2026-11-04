import { describe, expect, it } from 'vitest'
import { ApiError } from '@/app/api/errors'
import { describeFailure } from './failure'

describe('describeFailure', () => {
  it('stays silent when the Session is gone: the session lifecycle redirects and announces it', () => {
    expect(describeFailure(new ApiError('sessionExpired', 'expired'), ['email'])).toEqual({ kind: 'silent' })
    expect(describeFailure(new ApiError('unauthenticated', 'no session'))).toEqual({ kind: 'silent' })
  })

  it("puts the API's field errors on the form's own fields, in the form's field order", () => {
    const error = new ApiError('conflict', 'taken', {
      fieldErrors: { email: 'account.errors.emailTaken', username: 'account.errors.usernameTaken' },
    })
    expect(describeFailure(error, ['username', 'email', 'password'])).toEqual({
      kind: 'fields',
      errors: [
        ['username', 'account.errors.usernameTaken'],
        ['email', 'account.errors.emailTaken'],
      ],
    })
  })

  it('falls back to one message when no field error belongs to this form', () => {
    const error = new ApiError('validation', 'bad', { fieldErrors: { iban: 'x' } })
    expect(describeFailure(error, ['email'])).toEqual({ kind: 'message', key: 'error.unknown' })
  })

  it('words transport failures the same way on every screen', () => {
    expect(describeFailure(new ApiError('network', 'down'))).toEqual({
      kind: 'message',
      key: 'error.network',
    })
    expect(describeFailure(new ApiError('timeout', 'slow'))).toEqual({
      kind: 'message',
      key: 'error.timeout',
    })
    expect(describeFailure(new ApiError('transient', '503'))).toEqual({
      kind: 'message',
      key: 'error.transient',
    })
    expect(describeFailure(new Error('boom'))).toEqual({ kind: 'message', key: 'error.unknown' })
  })
})
