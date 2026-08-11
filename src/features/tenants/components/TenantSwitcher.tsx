import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useSession } from '@/features/auth/hooks/useSession'
import type { MembershipWithTenant } from '@/features/tenants/hooks/useMemberships'

function TenantLogo({ m, className }: { m: MembershipWithTenant; className?: string }) {
  const logo = m.tenant?.tenant_settings?.logo_url
  if (logo) {
    return (
      <img
        src={logo}
        alt={m.tenant?.name ?? ''}
        className={`size-4 shrink-0 rounded-sm object-contain ${className ?? ''}`}
      />
    )
  }
  return <Building2 className={`size-4 shrink-0 text-muted-foreground ${className ?? ''}`} />
}

export function TenantSwitcher() {
  const { session } = useSession()
  const { activeTenantId, setActiveTenantId } = useActiveTenant()
  const membershipsQuery = useMemberships(session?.user.id)

  const memberships = (membershipsQuery.data ?? []).filter((m) => m.tenant?.status === 'active')
  const active = memberships.find((m) => m.tenant_id === activeTenantId)

  if (!active) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex w-full items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <TenantLogo m={active} />
            <span className="truncate">{active.tenant?.name}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Consultorios</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onSelect={() => setActiveTenantId(m.tenant_id)}
            className="flex items-center justify-between"
          >
            <span className="flex min-w-0 items-center gap-2">
              <TenantLogo m={m} />
              <span className="min-w-0">
                <span className="block truncate">{m.tenant?.name}</span>
                <span className="block text-xs text-muted-foreground">{m.role?.name}</span>
              </span>
            </span>
            {m.tenant_id === activeTenantId && <Check className="size-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
