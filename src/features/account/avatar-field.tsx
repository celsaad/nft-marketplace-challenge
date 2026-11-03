// Avatar picker: the image is shrunk in the browser, previewed at once, then uploaded. A failed
// upload drops the preview, so what's shown is always what the server has (or is receiving).
import { ImageIcon, LoaderCircleIcon } from 'lucide-react'
import { type ChangeEvent, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/app/api/errors'
import type { Collector } from '@/contracts/account'
import { isSessionLoss } from '@/features/auth/form-errors'
import { useT } from '@/lib/i18n'
import { errorMessageKey } from '@/ui/feedback'
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/primitives/avatar'
import { Button } from '@/ui/primitives/button'
import { notifyUnavailable } from '@/ui/unavailable'
import { AVATAR_SOURCE_TYPES, prepareAvatar } from './avatar-image'
import { useProfileMutations } from './queries'

export function AvatarField({ me }: { me: Collector }) {
  const t = useT()
  const id = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const { avatar } = useProfileMutations(me.id)
  const [preview, setPreview] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = preparing || avatar.isPending

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // picking the same file again must fire change again
    if (!file) return
    setError(null)
    setPreparing(true)
    const result = await prepareAvatar(file)
    setPreparing(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPreview(result.dataUrl)
    avatar.mutate(
      { dataUrl: result.dataUrl },
      {
        onSuccess: () => {
          setPreview(null)
          toast.success(t('account.profile.avatarSaved'))
        },
        onError: (failure) => {
          setPreview(null)
          if (isSessionLoss(failure)) return
          setError((isApiError(failure) && failure.fieldErrors.dataUrl) || errorMessageKey(failure))
        },
      },
    )
  }

  const src = preview ?? me.avatarUrl
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{t('account.profile.avatar')}</legend>
      <div className="flex flex-wrap items-center gap-6">
        <Avatar className="size-[50px] border border-border bg-surface-raised">
          {src && <AvatarImage src={src} alt={t('account.profile.avatarAlt', { name: me.displayName })} />}
          <AvatarFallback className="bg-surface-raised text-primary">
            <ImageIcon aria-hidden className="size-5" />
          </AvatarFallback>
        </Avatar>
        <input
          ref={fileInput}
          type="file"
          accept={AVATAR_SOURCE_TYPES.join(',')}
          onChange={(event) => void onFile(event)}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          data-testid="avatar-file"
        />
        <Button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          aria-busy={busy || undefined}
          aria-label={t('account.profile.avatarChangeLabel')}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-10 px-6 font-bold hover:bg-primary-hover"
        >
          {busy && <LoaderCircleIcon aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {t('account.profile.avatarChange')}
        </Button>
        <button
          type="button"
          onClick={() => notifyUnavailable()}
          aria-label={t('account.profile.avatarRemoveLabel')}
          className="rounded-sm text-sm hover:text-primary"
        >
          {t('account.profile.avatarRemove')}
        </button>
      </div>
      <output className="sr-only">{busy ? t('account.profile.avatarUploading') : ''}</output>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {t(error)}
        </p>
      )}
    </fieldset>
  )
}
