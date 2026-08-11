import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabaseClient'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import { useRoles } from '@/features/configuracion/hooks/useMembers'
import type { Role } from '@/lib/database.types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
}

function AddMemberForm({ tenantId, roles }: { tenantId: string; roles: Role[] }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: users, error: rpcError } = await supabase.rpc('lookup_user_by_email', {
        p_email: email.trim(),
      })
      if (rpcError) throw rpcError
      const user = (users ?? [])[0] as { user_id: string } | undefined
      if (!user) {
        throw new Error('No existe un usuario registrado con ese correo')
      }

      const { error } = await supabase.from('tenant_membership').insert({
        tenant_id: tenantId,
        user_id: user.user_id,
        role_id: Number(roleId),
        status: 'active',
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Profesional agregado al consultorio')
      queryClient.invalidateQueries({ queryKey: ['tenant_members', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
      setEmail('')
      setRoleId('')
    },
    onError: (error: Error) => {
      const message = error.message.includes('tenant_membership_tenant_id_user_id_key')
        ? 'Ese usuario ya es miembro de este consultorio'
        : error.message
      toast.error(message)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (email.trim() && roleId) {
      mutation.mutate()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="member-email">Correo del usuario</Label>
        <Input
          id="member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ej. psicologa@correo.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="member-role">Rol</Label>
        <Select value={roleId} onValueChange={setRoleId} required>
          <SelectTrigger id="member-role" className="w-full">
            <SelectValue placeholder="Selecciona un rol" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={mutation.isPending} className="md:w-fit">
        {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
        Agregar
      </Button>
    </form>
  )
}

function RegisterMemberForm({ tenantId, roles }: { tenantId: string; roles: Role[] }) {
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create_professional', {
        body: {
          tenantId,
          name: fullName.trim(),
          email: email.trim(),
          roleId: Number(roleId),
          password,
        },
      })
      if (error) throw error
      const result = data as { error?: string }
      if (result.error) {
        throw new Error(result.error)
      }
    },
    onSuccess: () => {
      toast.success('Cuenta creada y profesional agregado al consultorio')
      queryClient.invalidateQueries({ queryKey: ['tenant_members', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
      setFullName('')
      setEmail('')
      setRoleId('')
      setPassword('')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (fullName.trim() && email.trim() && roleId && password) {
      mutation.mutate()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="register-name">Nombre completo</Label>
        <Input
          id="register-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ej. Ana Torres"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-email">Correo</Label>
        <Input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ej. ana@correo.com"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-role">Rol</Label>
        <Select value={roleId} onValueChange={setRoleId} required>
          <SelectTrigger id="register-role" className="w-full">
            <SelectValue placeholder="Selecciona un rol" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Contraseña temporal</Label>
        <Input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          required
        />
        <p className="text-xs text-muted-foreground">
          Cuenta habilitada de inmediato; el profesional puede cambiarla luego.
        </p>
      </div>
      <div className="md:col-span-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
          Crear cuenta y agregar
        </Button>
      </div>
    </form>
  )
}

export function ProfesionalesTab({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const membersQuery = useTenantMembers(tenantId)
  const rolesQuery = useRoles()

  const assignableRoles = (rolesQuery.data ?? []).filter((r) => !r.platform_scope)

  const changeRole = useMutation({
    mutationFn: async ({ membershipId, roleId }: { membershipId: string; roleId: number }) => {
      const { error } = await supabase
        .from('tenant_membership')
        .update({ role_id: roleId })
        .eq('id', membershipId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant_members', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const toggleStatus = useMutation({
    mutationFn: async ({
      membershipId,
      status,
    }: {
      membershipId: string
      status: string
    }) => {
      const next = status === 'active' ? 'inactive' : 'active'
      const { error } = await supabase
        .from('tenant_membership')
        .update({ status: next })
        .eq('id', membershipId)
      if (error) throw error
      return next
    },
    onSuccess: (next) => {
      toast.success(next === 'active' ? 'Membresía activada' : 'Profesional dado de baja')
      queryClient.invalidateQueries({ queryKey: ['tenant_members', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const remove = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.from('tenant_membership').delete().eq('id', membershipId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Membresía eliminada')
      queryClient.invalidateQueries({ queryKey: ['tenant_members', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const members = membersQuery.data ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vincular usuario existente</CardTitle>
          <CardDescription>
            Vincula un usuario registrado a este consultorio con un rol (RF-CON02).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rolesQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AddMemberForm tenantId={tenantId} roles={assignableRoles} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar profesional nuevo</CardTitle>
          <CardDescription>
            Crea una cuenta con contraseña temporal y la vincula al consultorio con un rol (RF-CON02).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rolesQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RegisterMemberForm tenantId={tenantId} roles={assignableRoles} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipo del consultorio</CardTitle>
          <CardDescription>Miembros, roles y estado de sus membresías.</CardDescription>
        </CardHeader>
        <CardContent>
          {membersQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay miembros en este consultorio.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.user_profile?.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{m.user_profile?.email || '—'}</TableCell>
                    <TableCell>
                      <Select
                        value={String(m.role_id)}
                        onValueChange={(v) =>
                          changeRole.mutate({ membershipId: m.id, roleId: Number(v) })
                        }
                      >
                        <SelectTrigger className="h-8 w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((r) => (
                            <SelectItem key={r.id} value={String(r.id)}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === 'active' ? 'secondary' : 'outline'}>
                        {STATUS_LABELS[m.status] ?? m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStatus.mutate({ membershipId: m.id, status: m.status })}
                        >
                          {m.status === 'active' ? 'Dar de baja' : 'Reactivar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove.mutate(m.id)}
                          title="Eliminar membresía"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
