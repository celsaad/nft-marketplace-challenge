// Sign-up (/cadastro). The Figma asks only for username, email and password (twice); the display
// name starts as the username and is editable on the profile. Conflicts land on their field.
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { signup } from '@/app/session/session'
import { SignupInputSchema } from '@/contracts/account'
import { type MessageKey, useT } from '@/lib/i18n'
import { FormField } from '@/ui/form/form-field'
import { PasswordInput } from '@/ui/form/password-input'
import { reportFailure } from '@/ui/form/report-failure'
import { SubmitButton } from '@/ui/form/submit-button'
import { Input } from '@/ui/primitives/input'
import { AuthCard, authInput, authSubmit } from './auth-card'

const SignupFormSchema = SignupInputSchema.omit({ displayName: true })
  .extend({ confirmPassword: z.string().min(1, 'validation.required') })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'validation.passwordMismatch',
  })
type SignupForm = z.infer<typeof SignupFormSchema>

export function SignupForm({ redirect }: { redirect?: string }) {
  const t = useT()
  const router = useRouter()
  const [formError, setFormError] = useState<MessageKey | null>(null)
  const form = useForm<SignupForm>({
    resolver: zodResolver(SignupFormSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ username, email, password }) => {
    setFormError(null)
    try {
      await signup({ username, email, password, displayName: username })
    } catch (error) {
      reportFailure(error, {
        setError: form.setError,
        fields: ['username', 'email', 'password'],
        onMessage: setFormError,
      })
      return
    }
    toast.success(t('account.auth.created'))
    router.history.replace(redirect ?? '/')
  })

  const fieldClass = '[&>label]:sr-only'
  return (
    <AuthCard
      mode="signup"
      redirect={redirect}
      intro={t('account.auth.signupIntro')}
      mobileTitle={t('account.auth.signupMobileTitle')}
      footer={
        <>
          {t('account.auth.hasAccount')}{' '}
          <Link
            to="/entrar"
            search={{ redirect }}
            className="underline-offset-4 hover:text-highlight hover:underline"
          >
            {t('account.auth.goLogin')}
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6 md:gap-3">
        <FormField label={t('account.auth.username')} error={errors.username?.message} className={fieldClass}>
          <Input
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t('account.auth.username')}
            className={authInput}
            {...form.register('username')}
          />
        </FormField>
        <FormField label={t('account.auth.email')} error={errors.email?.message} className={fieldClass}>
          <Input
            type="email"
            autoComplete="email"
            placeholder={t('account.auth.signupEmailPlaceholder')}
            className={authInput}
            {...form.register('email')}
          />
        </FormField>
        <FormField label={t('account.auth.password')} error={errors.password?.message} className={fieldClass}>
          <PasswordInput
            autoComplete="new-password"
            placeholder={t('account.auth.password')}
            className={authInput}
            {...form.register('password')}
          />
        </FormField>
        <FormField
          label={t('account.auth.confirmPassword')}
          error={errors.confirmPassword?.message}
          className={fieldClass}
        >
          <PasswordInput
            autoComplete="new-password"
            placeholder={t('account.auth.confirmPassword')}
            className={authInput}
            {...form.register('confirmPassword')}
          />
        </FormField>

        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {t(formError)}
          </p>
        )}

        <SubmitButton pending={isSubmitting} className={`mt-8 md:mt-3 ${authSubmit}`}>
          <span className="md:hidden">{t('account.auth.submitSignupMobile')}</span>
          <span className="hidden md:inline">{t('account.auth.submitSignup')}</span>
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
