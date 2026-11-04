// Shared Lighthouse CI settings (versioned audit config, spec §Performance). Each profile file
// adds its form factor. The audit runs the optimized build with the default mock Scenario and
// loads the real images, fonts and features: no audit-only simplifications.
//
// Target: the public deployment by default (HTTPS, HTTP/2, Brotli, as users get it). Set
// LH_BASE_URL to audit another deployment, or LH_TARGET=local to audit `vite preview` on
// localhost (HTTP/1.1, no compression: slower under simulated throttling, see
// docs/lighthouse/improvement-research.md).
const DEPLOYED = 'https://nft-marketplace-challenge-one.vercel.app'
const PORT = 4174
const local = process.env.LH_TARGET === 'local'
const base = local ? `http://localhost:${PORT}` : (process.env.LH_BASE_URL ?? DEPLOYED).replace(/\/$/, '')

module.exports = (profile, settings) => ({
  ci: {
    collect: {
      ...(local && {
        startServerCommand: `node ./node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
        startServerReadyPattern: 'Local',
      }),
      url: [`${base}/?scenario=default&reset=1`, `${base}/nft/nft_emerald-ape-042`],
      numberOfRuns: 3,
      // vite preview has no HTTP/2; the deployment does, so the audit counts there.
      settings: local ? { ...settings, skipAudits: ['uses-http2'] } : settings,
    },
    upload: { target: 'filesystem', outputDir: `docs/lighthouse/${profile}` },
  },
})
