import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <h1 className="p-8 text-2xl font-bold">Kurio</h1>,
})
