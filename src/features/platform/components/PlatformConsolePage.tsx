import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, KeyRound, Loader2, RefreshCw, Shuffle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { useSession } from '@/features/auth/hooks/useSession'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import type { Tenant } from '@/lib/database.types'

type PlatformUser = {
  id: string
  email: string | null
  full_name: string | null
  is_platform_admin: boolean
  must_change_password: boolean
}

function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant').select('*').order('created_at')
      if (error) throw error
      return (data ?? []) as Tenant[]
    },
  })
}

function useUsers() {
  return useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profile')
        .select('id, email, full_name, is_platform_admin, must_change_password')
        .order('email')
      if (error) throw error
      return (data ?? []) as unknown as PlatformUser[]
    },
  })
}

function CreateTenantForm() {
  const queryClient = useQueryClient()
  const { session } = useSession()
  const { setActiveTenantId } = useActiveTenant()
  const usersQuery = useUsers()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [adminUserId, setAdminUserId] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('onboard_tenant', {
        body: { name, slug, adminUserId },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error)
      }
      return data as { tenant: { id: string } }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
      if (adminUserId === session?.user.id && data?.tenant?.id) {
        setActiveTenantId(data.tenant.id)
      }
      setName('')
      setSlug('')
      setAdminUserId('')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (name && slug && adminUserId) {
      mutation.mutate()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo consultorio</CardTitle>
        <CardDescription>Alta de un tenant con su administrador inicial (Flujo 0 del SRS).</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Nombre del consultorio</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Consultorio San Lucas"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">Slug (identificador único)</Label>
            <Input
              id="tenant-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="Ej. san-lucas"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-admin">Administrador del consultorio</Label>
            <Select value={adminUserId} onValueChange={setAdminUserId} required>
              <SelectTrigger id="tenant-admin" className="w-full">
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {usersQuery.data?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mutation.error && (
            <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
          )}
          {mutation.isSuccess && (
            <p className="text-sm text-emerald-600">Consultorio creado correctamente.</p>
          )}

          <Button type="submit" className="w-full" disabled={mutation.isPending || usersQuery.isLoading}>
            {mutation.isPending ? 'Creando…' : 'Crear consultorio'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function randomPassword() {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length]
  return out
}

function ResetPasswordDialog({ user, onOpenChange }: { user: PlatformUser; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { session } = useSession()
  const [password, setPassword] = useState('')
  const [forceChange, setForceChange] = useState(false)

  const isSelf = user.id === session?.user.id

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin_users', {
        body: { action: 'reset_password', userId: user.id, newPassword: password, forceChange },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error)
      }
      return data
    },
    onSuccess: () => {
      toast.success(forceChange ? 'Contraseña reestablecida. Se forzará el cambio en su próximo inicio.' : 'Contraseña reestablecida.')
      queryClient.invalidateQueries({ queryKey: ['all-users'] })
      onOpenChange(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onOpenChange(false) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reestablecer contraseña</DialogTitle>
          <DialogDescription>
            Usuario: <span className="font-medium text-foreground">{user.email}</span>. Entrega la
            nueva contraseña al usuario; la anterior dejará de funcionar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-password">Nueva contraseña</Label>
          <div className="flex gap-2">
            <Input
              id="new-password"
              type="text"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setPassword(randomPassword())} title="Generar contraseña">
              <Shuffle className="size-4" />
            </Button>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={forceChange}
            onChange={(e) => setForceChange(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Forzar cambio de contraseña en el próximo inicio{' '}
            <span className="text-muted-foreground">(el usuario deberá fijar una nueva al entrar).</span>
          </span>
        </label>

        {isSelf && (
          <p className="text-xs text-muted-foreground">
            Eres tú mismo: no podrás confirmar el reseteo de tu propia cuenta.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={password.length < 6 || mutation.isPending || isSelf}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <KeyRound className="mr-2 size-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UsersCard() {
  const usersQuery = useUsers()
  const { session } = useSession()
  const [resetFor, setResetFor] = useState<PlatformUser | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
        <CardDescription>Todos los usuarios de la plataforma y reestablecimiento de contraseñas.</CardDescription>
      </CardHeader>
      <CardContent>
        {usersQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (usersQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay usuarios.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.is_platform_admin && <Badge>Superusuario</Badge>}
                      {u.must_change_password && <Badge variant="secondary">Cambiar contraseña</Badge>}
                      {!u.is_platform_admin && !u.must_change_password && <span className="text-xs text-muted-foreground">Usuario</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={u.id === session?.user.id}
                      onClick={() => setResetFor(u)}
                    >
                      <KeyRound className="mr-2 size-3.5" />
                      Reestablecer contraseña
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {resetFor && <ResetPasswordDialog user={resetFor} onOpenChange={(open) => { if (!open) setResetFor(null) }} />}
    </Card>
  )
}

export function PlatformConsolePage() {
  const tenantsQuery = useTenants()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
          <p className="text-muted-foreground">
            Gestión de consultorios y usuarios (Administrador de Plataforma).
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => tenantsQuery.refetch()}
          disabled={tenantsQuery.isFetching}
        >
          <RefreshCw className={`size-4 ${tenantsQuery.isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateTenantForm />

        <Card>
          <CardHeader>
            <CardTitle>Consultorios</CardTitle>
            <CardDescription>Tenants registrados en la plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            {tenantsQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (tenantsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay consultorios.</p>
            ) : (
              <ul className="space-y-2">
                {tenantsQuery.data?.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      <span className="font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">/{t.slug}</span>
                    </span>
                    <Badge variant={t.status === 'active' ? 'secondary' : 'outline'}>{t.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <UsersCard />
    </div>
  )
}