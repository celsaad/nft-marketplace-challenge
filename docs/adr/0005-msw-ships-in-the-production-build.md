# MSW ships in the production build and is included in the Lighthouse audit

The published demo has no backend, so the mock layer (MSW worker, mock database, Socket.IO binding) is turned on by configuration in the optimized build that is deployed and audited. The challenge forbids audit-only simplifications, so Lighthouse measures the real cost of booting the mocks. We limit that cost by lazy-loading the Mock Lab, keeping fixtures small and starting the worker in parallel with the first render's static work. The measured overhead is reported in the Lighthouse analysis instead of being hidden.
