import { Navigate, useNavigate } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useSession } from '@/features/auth/hooks/useSession'

export function TenantSelectionPage() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const { setActiveTenantId } = useActiveTenant()
  const membershipsQuery = useMemberships(session?.user.id)

  const memberships = (membershipsQuery.data ?? []).filter((m) => m.tenant?.status === 'active')

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  const select = (tenantId: string) => {
    setActiveTenantId(tenantId)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Selecciona tu consultorio</CardTitle>
          <CardDescription>
            Tienes acceso a más de un consultorio (RF-SaaS06). Elige con cuál trabajarás.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {membershipsQuery.isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {memberships.map((m) => (
            <Button
              key={m.id}
              variant="outline"
              className="flex h-auto w-full items-center justify-start gap-3 p-4"
              onClick={() => select(m.tenant_id)}
            >
              <Building2 className="size-5 shrink-0 text-muted-foreground" />
              <span className="text-left">
                <span className="block font-medium">{m.tenant?.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {m.role?.name}
                </span>
              </span>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
