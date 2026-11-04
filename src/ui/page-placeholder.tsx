// Temporary body for routes whose slice hasn't landed yet. Each slice replaces its own.
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-[1248px] px-4 py-16 md:px-6">
      <h1 className="text-2xl font-bold">{title}</h1>
    </section>
  )
}
