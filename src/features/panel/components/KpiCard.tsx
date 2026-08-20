import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  loading?: boolean
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
            {label}
          </p>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
            <Icon className="size-4" />
          </div>
        </div>
        <p className="mt-2 font-heading text-3xl leading-tight font-semibold tracking-tight tabular-nums">
          {loading ? '…' : value}
        </p>
        {sub && <p className="mt-1.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}