import { useState } from 'react'
import { FileSignature, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useSession } from '@/features/auth/hooks/useSession'
import { EmptyState } from '@/components/EmptyState'
import {
  useAcceptConsent,
  useConsentTemplate,
  usePortalConsent,
  usePortalFicha,
} from '@/features/portal/hooks/usePortal'

export function PortalConsentPage() {
  const { activeTenantId } = useActiveTenant()
  const { session } = useSession()
  const fichaQuery = usePortalFicha(activeTenantId, session?.user.id)
  const consentQuery = usePortalConsent(activeTenantId, fichaQuery.data?.id ?? null)
  const templateQuery = useConsentTemplate(activeTenantId)
  const acceptMutation = useAcceptConsent(activeTenantId)

  const [confirmOpen, setConfirmOpen] = useState(false)

  const loading =
    fichaQuery.isLoading || consentQuery.isLoading || templateQuery.isLoading

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const signed = consentQuery.data?.signed === true
  const template = templateQuery.data

  const handleAccept = () => {
    acceptMutation.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false)
        toast.success('Consentimiento firmado')
      },
      onError: (error: Error) => toast.error(error.message),
    })
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="size-5 text-muted-foreground" />
          Consentimiento informado
        </CardTitle>
        <CardDescription>
          {signed ? (
            <Badge variant="secondary">Firmado el {consentQuery.data?.signedAt ? new Date(consentQuery.data.signedAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</Badge>
          ) : (
            'Necesitas firmar el consentimiento para autorizar tus sesiones.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {template ? (
          <>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm leading-relaxed">
              {template.content}
            </div>
            <p className="text-xs text-muted-foreground">
              Versión {template.version} · {template.title}
            </p>
          </>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Sin plantilla vigente"
            hint="Tu consultorio aún no ha publicado una plantilla de consentimiento."
          />
        )}

        <div className="flex justify-end">
          {signed ? (
            <Button variant="outline" disabled>
              <ShieldCheck className="mr-2 size-4" /> Ya firmado
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)} disabled={!template}>
              Aceptar y firmar
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar firma</DialogTitle>
            <DialogDescription>
              Al aceptar, confirmas que leíste y entendiste el consentimiento informado de tu
              consultorio. Esta firma queda registrada junto a tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAccept} disabled={acceptMutation.isPending}>
              {acceptMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Firmar consentimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}