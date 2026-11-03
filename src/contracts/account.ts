import { z } from 'zod'
import { IdSchema, IsoDateSchema, NetworkSchema } from './common'

// Validation messages are i18n keys (resolved by the UI), never display text.

export const EmailSchema = z.email('validation.email').max(120)
export const PasswordSchema = z
  .string()
  .min(8, 'validation.passwordLength')
  .regex(/[A-Za-z]/, 'validation.passwordLetter')
  .regex(/\d/, 'validation.passwordDigit')
export const UsernameSchema = z
  .string()
  .min(3, 'validation.usernameLength')
  .max(24, 'validation.usernameLength')
  .regex(/^[a-z0-9_]+$/, 'validation.usernameChars')
export const DisplayNameSchema = z.string().trim().min(2, 'validation.required').max(60)

export const CollectorSchema = z.object({
  id: IdSchema,
  email: EmailSchema,
  displayName: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  ensName: z.string().nullable(),
  bio: z.string(),
})
export type Collector = z.infer<typeof CollectorSchema>

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'validation.required'),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const SignupInputSchema = z.object({
  displayName: DisplayNameSchema,
  username: UsernameSchema,
  email: EmailSchema,
  password: PasswordSchema,
})
export type SignupInput = z.infer<typeof SignupInputSchema>

export const SessionSchema = z.object({
  token: z.string(),
  expiresAt: IsoDateSchema,
  collector: CollectorSchema,
})
export type Session = z.infer<typeof SessionSchema>

export const UpdateProfileInputSchema = z.object({
  displayName: DisplayNameSchema,
  username: UsernameSchema,
  email: EmailSchema,
  bio: z.string().max(280, 'validation.tooLong'),
  ensName: z
    .string()
    .regex(/^[a-z0-9-]+\.eth$/, 'validation.ens')
    .nullable(),
})
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>

/** Avatar travels as a small data URL; the UI downsizes it before upload. */
export const UpdateAvatarInputSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'validation.avatarType')
    .max(400_000, 'validation.avatarSize'),
})
export type UpdateAvatarInput = z.infer<typeof UpdateAvatarInputSchema>

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'validation.required'),
  newPassword: PasswordSchema,
})
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>

export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase'] as const
export const WalletProviderSchema = z.enum(WALLET_PROVIDERS)
export type WalletProvider = z.infer<typeof WalletProviderSchema>

/** EVM addresses are 0x + 40 hex; Solana addresses are base58, 32–44 chars. */
export const WalletAddressSchema = z
  .string()
  .regex(/^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/, 'validation.walletAddress')

export const WalletInputSchema = z
  .object({
    label: z.string().trim().min(1, 'validation.required').max(40),
    address: WalletAddressSchema,
    network: NetworkSchema,
    provider: WalletProviderSchema,
    isPrimary: z.boolean(),
  })
  .refine((w) => (w.network === 'solana') === !w.address.startsWith('0x'), {
    path: ['address'],
    message: 'validation.walletAddressNetwork',
  })
export type WalletInput = z.infer<typeof WalletInputSchema>

export const WalletSchema = z.object({
  id: IdSchema,
  label: z.string(),
  address: z.string(),
  network: NetworkSchema,
  provider: WalletProviderSchema,
  isPrimary: z.boolean(),
  createdAt: IsoDateSchema,
})
export type Wallet = z.infer<typeof WalletSchema>

export const WalletConnectionSchema = z.object({
  walletId: IdSchema,
  status: z.enum(['approved', 'disconnected']),
})
export type WalletConnection = z.infer<typeof WalletConnectionSchema>
