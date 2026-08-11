import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabaseClient'
import { useTenantSettings } from '@/features/tenants/hooks/useTenantSettings'
import type { TenantSettings } from '@/lib/database.types'

type SettingsForm = {
  legal_name: string
  tax_id: string
  address: string
  phone: string
  email: string
  timezone: string
  logo_url: string
}

function toForm(settings: TenantSettings | null | undefined): SettingsForm {
  return {
    legal_name: settings?.legal_name ?? '',
    tax_id: settings?.tax_id ?? '',
    address: settings?.address ?? '',
    phone: settings?.phone ?? '',
    email: settings?.email ?? '',
    timezone: settings?.timezone ?? 'America/Lima',
    logo_url: settings?.logo_url ?? '',
  }
}

export function InstitucionalTab({ tenantId }: { tenantId: string }) {
  const settingsQuery = useTenantSettings(tenantId)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SettingsForm>(() => toForm(settingsQuery.data))

  useEffect(() => {
    setForm(toForm(settingsQuery.data))
  }, [settingsQuery.data])

  const mutation = useMutation({
    mutationFn: async (values: SettingsForm) => {
      const { error } = await supabase
        .from('tenant_settings')
        .update(values)
        .eq('tenant_id', tenantId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Datos institucionales guardados')
      queryClient.invalidateQueries({ queryKey: ['tenant_settings', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const set = (field: keyof SettingsForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos institucionales</CardTitle>
        <CardDescription>
          Razón social, identificación tributaria y datos de contacto del consultorio (RF-CON01).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settingsQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-legal-name">Razón social</Label>
              <Input
                id="settings-legal-name"
                value={form.legal_name}
                onChange={(e) => set('legal_name')(e.target.value)}
                placeholder="Ej. Centro de Psicología San Lucas S.A.C."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-tax-id">RUC</Label>
              <Input
                id="settings-tax-id"
                value={form.tax_id}
                onChange={(e) => set('tax_id')(e.target.value)}
                placeholder="Ej. 20123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-address">Dirección</Label>
              <Input
                id="settings-address"
                value={form.address}
                onChange={(e) => set('address')(e.target.value)}
                placeholder="Ej. Av. Larco 1234, Miraflores"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-phone">Teléfono</Label>
              <Input
                id="settings-phone"
                value={form.phone}
                onChange={(e) => set('phone')(e.target.value)}
                placeholder="Ej. +51 987 654 321"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Correo de contacto</Label>
              <Input
                id="settings-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email')(e.target.value)}
                placeholder="Ej. contacto@sanlucas.pe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-timezone">Zona horaria</Label>
              <Input
                id="settings-timezone"
                value={form.timezone}
                onChange={(e) => set('timezone')(e.target.value)}
                placeholder="Ej. America/Lima"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="settings-logo-url">URL del logo</Label>
              <Input
                id="settings-logo-url"
                value={form.logo_url}
                onChange={(e) => set('logo_url')(e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
