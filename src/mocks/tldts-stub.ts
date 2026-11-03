// Stand-in for `tldts` (the public-suffix list, ~40 KB gzipped), which MSW pulls in only through
// tough-cookie's cookie-domain checks. This app sends no cookies (bearer token in a header), so the
// registrable domain is approximated as the last two labels. Aliased in vite.config.ts.
export function getDomain(host: string): string | null {
  const labels = host.split('.').filter(Boolean)
  if (labels.length === 0) return null
  return labels.slice(-2).join('.')
}
