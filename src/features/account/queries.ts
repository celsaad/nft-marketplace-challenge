// Account query options. The Account slice extends this module; the shell reads the profile.
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/app/api/endpoints'
import { keys } from '@/app/query/keys'
import { useSessionStore } from '@/app/session/store'

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
