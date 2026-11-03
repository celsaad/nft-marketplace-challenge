// Shared Lighthouse CI settings (versioned audit config, spec §Performance). Each profile file
// adds its form factor. The audit runs the optimized build with the default mock Scenario and
// loads the real images, fonts and features: no audit-only simplifications.
const PORT = 4174

module.exports = (profile, settings) => ({
  ci: {
    collect: {
      startServerCommand: `node ./node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort`,
      startServerReadyPattern: 'Local',
      url: [
        `http://localhost:${PORT}/?scenario=default&reset=1`,
        `http://localhost:${PORT}/nft/nft_emerald-ape-042`,
      ],
      numberOfRuns: 3,
      settings: { ...settings, skipAudits: ['uses-http2'] },
    },
    upload: { target: 'filesystem', outputDir: `docs/lighthouse/${profile}` },
  },
})
