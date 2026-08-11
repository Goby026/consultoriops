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
    <Card>
      <CardContent className="flex items-start gap-4">
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-semibold leading-tight">
            {loading ? '…' : value}
          </p>
          {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
