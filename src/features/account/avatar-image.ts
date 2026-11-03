// Avatars travel as small data URLs (UpdateAvatarInputSchema: ≤ 400 KB). Phone photos are many MB,
// so the browser shrinks them to fit 256×256 before upload instead of the server rejecting them.
import { UpdateAvatarInputSchema } from '@/contracts/account'

export const AVATAR_MAX_SIDE = 256
export const AVATAR_SOURCE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** The size that fits within `max`×`max`, keeping the aspect ratio and never upscaling. */
export function fitWithin(width: number, height: number, max = AVATAR_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export type AvatarResult = { ok: true; dataUrl: string } | { ok: false; error: string }

/** Validates, downsizes and encodes an avatar. Errors are i18n message keys. */
export async function prepareAvatar(file: File): Promise<AvatarResult> {
  if (!(AVATAR_SOURCE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'validation.avatarType' }
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: 'account.profile.avatarUnreadable' }
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return { ok: false, error: 'account.profile.avatarUnreadable' }
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let dataUrl = ''
  for (const quality of [0.86, 0.7, 0.5]) {
    dataUrl = canvas.toDataURL('image/webp', quality)
    // Browsers without a WebP encoder silently fall back to PNG; JPEG stays small everywhere.
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (UpdateAvatarInputSchema.safeParse({ dataUrl }).success) return { ok: true, dataUrl }
  }
  const parsed = UpdateAvatarInputSchema.safeParse({ dataUrl })
  return { ok: false, error: parsed.error?.issues[0]?.message ?? 'validation.avatarSize' }
}
