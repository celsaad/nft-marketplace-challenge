// Account query options. The Account slice extends this module; the shell reads the profile.
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import { getSession, useSessionStore } from '@/app/session/store'
import type { Collector } from '@/contracts/account'

export const meQuery = (collectorId: string) =>
  queryOptions({
    queryKey: keys.me(collectorId),
    queryFn: ({ signal }) => api.profile.get({ signal }),
  })

/** The signed-in Collector's profile, or null for Guests. */
export function useMe() {
  const collectorId = useSessionStore((s) => s.collectorId)
  const query = useQuery({ ...meQuery(collectorId ?? ''), enabled: Boolean(collectorId) })
  return collectorId ? (query.data ?? null) : null
}

/** The profile query for a screen behind the /_auth guard (loading and error states included). */
export function useProfileQuery(collectorId: string) {
  return useQuery(meQuery(collectorId))
}

/**
 * Profile mutations. The server's answer is the new profile, so it replaces the cache entry (the
 * header updates at once) — but only while the same Collector is still signed in.
 */
export function useProfileMutations(collectorId: string) {
  const queryClient = useQueryClient()
  const store = (collector: Collector) => {
    if (getSession().collectorId === collectorId) queryClient.setQueryData(keys.me(collectorId), collector)
  }
  return {
    update: useMutation({ mutationFn: api.profile.update, onSuccess: store }),
    avatar: useMutation({ mutationFn: api.profile.avatar, onSuccess: store }),
    password: useMutation({ mutationFn: api.profile.password }),
  }
}
