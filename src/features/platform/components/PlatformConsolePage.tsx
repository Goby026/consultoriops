import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { supabase } from '@/lib/supabaseClient'
import type { Tenant } from '@/lib/database.types'

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
        .select('id, email, full_name')
        .order('email')
      if (error) throw error
      return (data ?? []) as { id: string; email: string | null; full_name: string }[]
    },
  })
}

function CreateTenantForm() {
  const queryClient = useQueryClient()
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
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] })
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

export function PlatformConsolePage() {
  const tenantsQuery = useTenants()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plataforma</h1>
          <p className="text-muted-foreground">
            Gestión de consultorios (Administrador de Plataforma).
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
    </div>
  )
}
