import { Loader2, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useSession } from '@/features/auth/hooks/useSession'
import { usePortalFicha } from '@/features/portal/hooks/usePortal'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  )
}

export function PortalProfilePage() {
  const { activeTenantId } = useActiveTenant()
  const { session } = useSession()
  const fichaQuery = usePortalFicha(activeTenantId, session?.user.id)

  if (fichaQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const ficha = fichaQuery.data

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-5 text-muted-foreground" />
          Mi perfil
        </CardTitle>
        <CardDescription>Datos de tu ficha en {ficha?.tenant?.name ?? 'tu consultorio'}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ficha ? (
          <p className="text-sm text-muted-foreground">No se encontró tu ficha de paciente.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombres" value={`${ficha.first_name} ${ficha.last_name}`} />
            <Field label="N.° de historia clínica" value={ficha.medical_record_number ?? '—'} />
            <Field label="Documento" value={`${ficha.identity_doc_type ?? ''} ${ficha.identity_doc_number ?? ''}`.trim()} />
            <Field label="Fecha de nacimiento" value={ficha.birth_date} />
            <Field label="Teléfono" value={ficha.phone ?? '—'} />
            <Field label="Correo" value={ficha.email ?? session?.user.email ?? '—'} />
          </div>
        )}
        <Separator />
        <p className="text-xs text-muted-foreground">
          Para actualizar tus datos, contacta a tu consultorio.
        </p>
      </CardContent>
    </Card>
  )
}