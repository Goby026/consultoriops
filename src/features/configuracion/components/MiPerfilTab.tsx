import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabaseClient'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'

export function MiPerfilTab({ userId, tenantId }: { userId: string; tenantId: string }) {
  const profileQuery = useProfile(userId)
  const membershipsQuery = useMemberships(userId)
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setFullName(profileQuery.data?.full_name ?? '')
  }, [profileQuery.data])

  const membership = membershipsQuery.data?.find((m) => m.tenant_id === tenantId)
  const roleName = membership?.role?.name
  const tenantName = membership?.tenant?.name

  const mutation = useMutation({
    mutationFn: async (name: string) => {
      const { error: profileErr } = await supabase
        .from('user_profile')
        .update({ full_name: name })
        .eq('id', userId)
      if (profileErr) throw profileErr
      const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: name } })
      if (authErr) throw authErr
    },
    onSuccess: () => {
      toast.success('Perfil actualizado')
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
      setTouched(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return
    mutation.mutate(fullName.trim())
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Mi perfil</CardTitle>
          <CardDescription>Datos personales visibles para el consultorio.</CardDescription>
        </CardHeader>
        <CardContent>
          {profileQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nombre completo</Label>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    setTouched(true)
                  }}
                  placeholder="Tu nombre y apellidos"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Correo electrónico</Label>
                <Input
                  id="profile-email"
                  value={profileQuery.data?.email ?? ''}
                  readOnly
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  El correo se gestiona desde la autenticación y no puede cambiarse aquí.
                </p>
              </div>
              <Button type="submit" disabled={!touched || !fullName.trim() || mutation.isPending}>
                {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                Guardar cambios
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mi rol en el consultorio</CardTitle>
          <CardDescription>Tu membresía en el consultorio activo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">{tenantName || 'Consultorio'}</p>
              <p className="text-xs text-muted-foreground">
                {membership?.status === 'active' ? 'Membresía activa' : 'Membresía'}
              </p>
            </div>
            <Badge variant="secondary">{roleName || 'Miembro'}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
