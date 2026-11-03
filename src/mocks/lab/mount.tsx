// Mounts the Mock Lab in its own React root, so app code never imports the mock layer.
import { createRoot } from 'react-dom/client'
import { MockLab } from './mock-lab'

export function mountMockLab() {
  if (!window.__mock || document.getElementById('mock-lab')) return
  const host = document.createElement('div')
  host.id = 'mock-lab'
  document.body.append(host)
  createRoot(host).render(<MockLab api={window.__mock} />)
}
