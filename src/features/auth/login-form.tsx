// Login (/entrar): validates with the shared contract, says nothing about which credential was
// wrong, and returns the Collector to the flow they came from (`redirect`).
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { isApiError } from '@/app/api/errors'
import { queryClient } from '@/app/query/client'
import { keys } from '@/app/query/keys'
import { login } from '@/app/session/session'
import { getSession } from '@/app/session/store'
import { type Collector, type LoginInput, LoginInputSchema } from '@/contracts/account'
import { type MessageKey, useT } from '@/lib/i18n'
import { errorMessageKey } from '@/ui/failure'
import { FormField } from '@/ui/form/form-field'
import { PasswordInput } from '@/ui/form/password-input'
import { SubmitButton } from '@/ui/form/submit-button'
import { Input } from '@/ui/primitives/input'
import { notifyUnavailable } from '@/ui/unavailable'
import { AuthCard, authInput, authSubmit } from './auth-card'

/** The session lifecycle seeds the profile into the cache on login. */
function signedInName() {
  const { collectorId } = getSession()
  return collectorId ? queryClient.getQueryData<Collector>(keys.me(collectorId))?.displayName : undefined
}

const NOTICE: Record<'expired' | 'required', MessageKey> = {
  expired: 'session.expired',
  required: 'auth.required',
}

export function LoginForm({ redirect, reason }: { redirect?: string; reason?: 'expired' | 'required' }) {
  const t = useT()
  const router = useRouter()
  const [formError, setFormError] = useState<MessageKey | null>(null)
  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginInputSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (input) => {
    setFormError(null)
    try {
      await login(input)
    } catch (error) {
      // One message for both fields: never reveal whether the email exists.
      setFormError(
        isApiError(error) && error.kind === 'invalidCredentials'
          ? 'account.auth.invalidCredentials'
          : errorMessageKey(error),
      )
      form.setFocus('password')
      return
    }
    toast.success(t('account.auth.welcome', { name: signedInName() ?? input.email }))
    router.history.replace(redirect ?? '/')
  })

  return (
    <AuthCard
      mode="login"
      redirect={redirect}
      intro={t('account.auth.loginIntro')}
      mobileTitle={t('account.auth.login')}
      notice={
        reason && (
          <output className="block mb-4 rounded-md border border-primary/60 bg-band px-3 py-2 text-sm text-foreground">
            {t(NOTICE[reason])}
          </output>
        )
      }
      footer={
        <>
          {t('account.auth.noAccount')}{' '}
          <Link
            to="/cadastro"
            search={{ redirect }}
            className="underline-offset-4 hover:text-highlight hover:underline"
          >
            {t('account.auth.createAccount')}
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
        <FormField
          label={t('account.auth.email')}
          error={errors.email?.message}
          className="[&>label]:sr-only"
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder={t('account.auth.emailPlaceholder')}
            className={authInput}
            {...form.register('email')}
          />
        </FormField>
        <FormField
          label={t('account.auth.password')}
          error={errors.password?.message}
          className="mt-3 [&>label]:sr-only md:mt-0"
        >
          <PasswordInput
            autoComplete="current-password"
            placeholder={t('account.auth.password')}
            className={authInput}
            {...form.register('password')}
          />
        </FormField>
        <button
          type="button"
          onClick={() => notifyUnavailable()}
          className="self-end rounded-sm text-sm text-highlight hover:text-primary-hover"
        >
          {t('account.auth.forgotPassword')}
        </button>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {t(formError)}
          </p>
        )}

        <SubmitButton pending={isSubmitting} className={`mt-6 md:mt-3 ${authSubmit}`}>
          {t('account.auth.submitLogin')}
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
