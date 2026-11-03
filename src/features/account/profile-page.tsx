// Collector profile (/perfil). The Figma has one "Salvar" for the profile data and the password
// block, so one submit validates both and sends each change that was made: the profile when it
// was edited, the password when any password field was filled in. Each answer lands on its own
// fields, and only a confirmed change is shown as saved.
import { zodResolver } from '@hookform/resolvers/zod'
import { type ComponentProps, type FormEvent, useState } from 'react'
import { type FieldValues, type Path, type UseFormReturn, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSessionStore } from '@/app/session/store'
import {
  ChangePasswordInputSchema,
  type Collector,
  type UpdateProfileInput,
  UpdateProfileInputSchema,
} from '@/contracts/account'
import { applyFieldErrors, isSessionLoss } from '@/features/auth/form-errors'
import { PasswordInput } from '@/features/auth/password-input'
import { SubmitButton } from '@/features/auth/submit-button'
import { useT } from '@/lib/i18n'
import { ErrorState, errorMessageKey, LoadingRegion, Skeleton } from '@/ui/feedback'
import { FormField } from '@/ui/form-field'
import { Input } from '@/ui/primitives/input'
import { Textarea } from '@/ui/primitives/textarea'
import { AccountLayout } from './account-layout'
import { AvatarField } from './avatar-field'
import { useProfileMutations, useProfileQuery } from './queries'

/** The ENS field shows only the name; ".eth" is drawn beside it and added on save. */
const ProfileFormSchema = UpdateProfileInputSchema.extend({
  ensName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^([a-z0-9-]+(\.eth)?)?$/, 'validation.ens'),
})
type ProfileForm = z.input<typeof ProfileFormSchema>

const PasswordFormSchema = ChangePasswordInputSchema.extend({
  confirmPassword: z.string().min(1, 'validation.required'),
}).refine((v) => v.newPassword === v.confirmPassword, {
  path: ['confirmPassword'],
  message: 'validation.passwordMismatch',
})
type PasswordForm = z.input<typeof PasswordFormSchema>

const EMPTY_PASSWORD: PasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' }

const toForm = (me: Collector): ProfileForm => ({
  displayName: me.displayName,
  username: me.username,
  email: me.email,
  bio: me.bio,
  ensName: me.ensName?.replace(/\.eth$/, '') ?? '',
})

function toInput(form: ProfileForm): UpdateProfileInput {
  const { ensName, ...rest } = ProfileFormSchema.parse(form)
  const name = ensName.replace(/\.eth$/, '')
  return { ...rest, ensName: name ? `${name}.eth` : null }
}

const fieldInput = 'h-10 bg-transparent'

export function ProfilePage() {
  const t = useT()
  const collectorId = useSessionStore((s) => s.collectorId) ?? ''
  const query = useProfileQuery(collectorId)

  return (
    <AccountLayout>
      <h1 className="text-base font-bold">{t('account.profile.title')}</h1>
      {query.isPending ? (
        <LoadingRegion className="mt-8 grid gap-6 md:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </LoadingRegion>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} className="mt-8" />
      ) : (
        <ProfileForms key={query.data.id} me={query.data} />
      )}
    </AccountLayout>
  )
}

function ProfileForms({ me }: { me: Collector }) {
  const t = useT()
  const { update, password } = useProfileMutations(me.id)
  const [saving, setSaving] = useState(false)
  const profile = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: toForm(me),
  })
  const passwords = useForm<PasswordForm>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: EMPTY_PASSWORD,
  })
  const { isDirty } = profile.formState
  const pe = profile.formState.errors
  const we = passwords.formState.errors

  /** Field errors go on their fields; anything else is a toast. Session loss is the guard's job. */
  function reportFailure<T extends FieldValues>(error: unknown, form: UseFormReturn<T>, fields: Path<T>[]) {
    if (isSessionLoss(error)) return
    if (!applyFieldErrors(error, form.setError, fields)) toast.error(t(errorMessageKey(error)))
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const wantsPassword = Object.values(passwords.getValues()).some(Boolean)
    if (!wantsPassword) passwords.clearErrors()
    const profileValid = await profile.trigger(undefined, { shouldFocus: true })
    const passwordValid = wantsPassword
      ? await passwords.trigger(undefined, { shouldFocus: profileValid })
      : true
    if (!profileValid || !passwordValid) return
    if (!isDirty && !wantsPassword) {
      toast.info(t('account.profile.nothingToSave'))
      return
    }

    setSaving(true)
    try {
      if (isDirty) {
        try {
          const saved = await update.mutateAsync(toInput(profile.getValues()))
          profile.reset(toForm(saved))
          toast.success(t('account.profile.saved'))
        } catch (error) {
          reportFailure(error, profile, ['displayName', 'username', 'email', 'bio', 'ensName'])
          return
        }
      }
      if (wantsPassword) {
        const { currentPassword, newPassword } = passwords.getValues()
        try {
          await password.mutateAsync({ currentPassword, newPassword })
          passwords.reset(EMPTY_PASSWORD)
          toast.success(t('account.profile.passwordSaved'))
        } catch (error) {
          reportFailure(error, passwords, ['currentPassword', 'newPassword'])
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="mt-8 md:mt-10">
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2 md:gap-y-[35px]">
        <FormField label={t('account.profile.displayName')} error={pe.displayName?.message} required>
          <Input autoComplete="name" className={fieldInput} {...profile.register('displayName')} />
        </FormField>
        <FormField label={t('account.profile.username')} error={pe.username?.message} required>
          <Input
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            className={fieldInput}
            {...profile.register('username')}
          />
        </FormField>
        <FormField label={t('account.profile.email')} error={pe.email?.message} required>
          <Input type="email" autoComplete="email" className={fieldInput} {...profile.register('email')} />
        </FormField>
        <FormField label={t('account.profile.ens')} error={pe.ensName?.message}>
          <EnsInput {...profile.register('ensName')} />
        </FormField>
        <FormField label={t('account.profile.bio')} error={pe.bio?.message}>
          <Textarea
            rows={2}
            placeholder={t('account.profile.bioPlaceholder')}
            className="min-h-10 bg-transparent"
            {...profile.register('bio')}
          />
        </FormField>
        <AvatarField me={me} />
      </div>

      <fieldset className="mt-10 flex flex-col gap-6 md:max-w-[calc(50%-14px)] md:gap-[18px]">
        <legend className="mb-6 text-base font-bold md:mb-4">{t('account.profile.passwordTitle')}</legend>
        <FormField label={t('account.profile.currentPassword')} error={we.currentPassword?.message}>
          <PasswordInput
            autoComplete="current-password"
            className={fieldInput}
            {...passwords.register('currentPassword')}
          />
        </FormField>
        <FormField label={t('account.profile.newPassword')} error={we.newPassword?.message}>
          <PasswordInput
            autoComplete="new-password"
            className={fieldInput}
            {...passwords.register('newPassword')}
          />
        </FormField>
        <FormField label={t('account.profile.confirmPassword')} error={we.confirmPassword?.message}>
          <PasswordInput
            autoComplete="new-password"
            className={fieldInput}
            {...passwords.register('confirmPassword')}
          />
        </FormField>
      </fieldset>

      <SubmitButton
        pending={saving}
        className="mt-8 h-10 w-full px-10 font-bold hover:bg-primary-hover md:w-auto"
      >
        {t('account.profile.save')}
      </SubmitButton>
    </form>
  )
}

/** ".eth" sits beside the name as in the Figma; FormField's id and aria wiring reach the input. */
function EnsInput(props: ComponentProps<'input'>) {
  const t = useT()
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden
        className="grid h-10 w-[78px] shrink-0 place-items-center rounded-md border border-input text-sm"
      >
        {t('account.profile.ensSuffix')}
      </span>
      <Input
        autoCapitalize="none"
        spellCheck={false}
        placeholder="anasouza"
        className={fieldInput}
        {...props}
      />
    </div>
  )
}
