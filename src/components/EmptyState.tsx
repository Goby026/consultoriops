import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-6 py-10 text-center">
      <div className="mb-1.5 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="size-4.5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}