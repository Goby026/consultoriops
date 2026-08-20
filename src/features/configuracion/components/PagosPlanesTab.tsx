import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { usePaymentMethods, usePaymentPlans } from '@/features/configuracion/hooks/usePayments'
import type { PaymentPlan } from '@/lib/database.types'

const METHOD_CATEGORIES: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
}

function formatCurrency(value: number | string) {
  return `S/ ${Number(value).toFixed(2)}`
}

function MethodForm({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('EFECTIVO')

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('payment_method').insert({
        tenant_id: tenantId,
        name: name.trim(),
        category,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Método de pago agregado')
      setName('')
      setCategory('EFECTIVO')
      queryClient.invalidateQueries({ queryKey: ['payment_methods', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor="method-name">Nombre</Label>
        <Input
          id="method-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Efectivo"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="method-category">Categoría</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="method-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(METHOD_CATEGORIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={mutation.isPending} className="md:w-fit">
        {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
        Agregar
      </Button>
    </form>
  )
}

function PaymentMethodsCard({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const methodsQuery = usePaymentMethods(tenantId)
  const methods = methodsQuery.data ?? []

  const toggleActive = useMutation({
    mutationFn: async ({ methodId, active }: { methodId: string; active: boolean }) => {
      const { error } = await supabase
        .from('payment_method')
        .update({ active: !active })
        .eq('id', methodId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_methods', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const remove = useMutation({
    mutationFn: async (methodId: string) => {
      const { error } = await supabase.from('payment_method').delete().eq('id', methodId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Método de pago eliminado')
      queryClient.invalidateQueries({ queryKey: ['payment_methods', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métodos de pago</CardTitle>
        <CardDescription>Medios de pago aceptados por el consultorio (RF-CON11).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MethodForm tenantId={tenantId} />
        {methodsQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : methods.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay métodos de pago registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{METHOD_CATEGORIES[m.category] ?? m.category}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleActive.mutate({ methodId: m.id, active: m.active })}
                    >
                      <Badge variant={m.active ? 'secondary' : 'outline'}>
                        {m.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}>
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
  )
}

type PlanForm = {
  name: string
  description: string
  sessions_included: string
  price: string
  valid_from: string
  valid_to: string
  active: boolean
}

function emptyPlanForm(): PlanForm {
  return {
    name: '',
    description: '',
    sessions_included: '4',
    price: '0',
    valid_from: '',
    valid_to: '',
    active: true,
  }
}

function toPlanForm(plan: PaymentPlan): PlanForm {
  return {
    name: plan.name,
    description: plan.description ?? '',
    sessions_included: String(plan.sessions_included),
    price: String(plan.price),
    valid_from: plan.valid_from ?? '',
    valid_to: plan.valid_to ?? '',
    active: plan.active,
  }
}

function PlanFormDialog({
  tenantId,
  plan,
  open,
  onOpenChange,
}: {
  tenantId: string
  plan: PaymentPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PlanForm>(emptyPlanForm())
  const isEditing = plan !== null

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        sessions_included: Number(form.sessions_included),
        price: Number(form.price),
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        active: form.active,
      }
      const query = isEditing
        ? supabase.from('payment_plan').update(payload).eq('id', plan.id)
        : supabase.from('payment_plan').insert({ tenant_id: tenantId, ...payload })
      const { error } = await query
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Plan de pago actualizado' : 'Plan de pago creado')
      queryClient.invalidateQueries({ queryKey: ['payment_plans', tenantId] })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm(plan ? toPlanForm(plan) : emptyPlanForm())
    }
    onOpenChange(next)
  }

  const set = <K extends keyof PlanForm>(field: K, value: PlanForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar plan de pago' : 'Nuevo plan de pago'}</DialogTitle>
            <DialogDescription>
              Paquete de sesiones con precio especial (RF-CON12, RF13).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="plan-name">Nombre</Label>
            <Input
              id="plan-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ej. Pack 8 sesiones"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan-description">Descripción</Label>
            <Input
              id="plan-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plan-sessions">Sesiones incluidas</Label>
              <Input
                id="plan-sessions"
                type="number"
                min={1}
                value={form.sessions_included}
                onChange={(e) => set('sessions_included', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-price">Precio del pack (S/)</Label>
              <Input
                id="plan-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-valid-from">Vigencia desde</Label>
              <Input
                id="plan-valid-from"
                type="date"
                value={form.valid_from}
                onChange={(e) => set('valid_from', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-valid-to">Vigencia hasta</Label>
              <Input
                id="plan-valid-to"
                type="date"
                value={form.valid_to}
                onChange={(e) => set('valid_to', e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
            />
            Plan activo
          </label>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Crear plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PaymentPlansCard({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const plansQuery = usePaymentPlans(tenantId)
  const plans = plansQuery.data ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null)

  const toggleActive = useMutation({
    mutationFn: async ({ planId, active }: { planId: string; active: boolean }) => {
      const { error } = await supabase.from('payment_plan').update({ active: !active }).eq('id', planId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment_plans', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const remove = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase.from('payment_plan').delete().eq('id', planId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Plan de pago eliminado')
      queryClient.invalidateQueries({ queryKey: ['payment_plans', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const openCreate = () => {
    setEditingPlan(null)
    setDialogOpen(true)
  }

  const openEdit = (plan: PaymentPlan) => {
    setEditingPlan(plan)
    setDialogOpen(true)
  }

  const formatVigencia = (plan: PaymentPlan) => {
    if (!plan.valid_from && !plan.valid_to) return 'Sin vigencia'
    if (plan.valid_from && plan.valid_to) return `${plan.valid_from} → ${plan.valid_to}`
    return plan.valid_from ? `Desde ${plan.valid_from}` : `Hasta ${plan.valid_to}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Planes de pago</CardTitle>
          <CardDescription>
            Paquetes de sesiones con precio especial (RF-CON12, RF13).
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Nuevo plan
        </Button>
      </CardHeader>
      <CardContent>
        {plansQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay planes de pago. Crea el primero con «Nuevo plan».
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Sesiones</TableHead>
                <TableHead>Precio pack</TableHead>
                <TableHead>Precio / sesión</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="font-medium">{p.name}</span>
                    {p.description && (
                      <span className="block text-xs text-muted-foreground">{p.description}</span>
                    )}
                  </TableCell>
                  <TableCell>{p.sessions_included}</TableCell>
                  <TableCell>{formatCurrency(p.price)}</TableCell>
                  <TableCell>
                    {formatCurrency(p.sessions_included > 0 ? p.price / p.sessions_included : 0)}
                  </TableCell>
                  <TableCell>{formatVigencia(p)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleActive.mutate({ planId: p.id, active: p.active })}
                    >
                      <Badge variant={p.active ? 'secondary' : 'outline'}>
                        {p.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
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

      <PlanFormDialog
        tenantId={tenantId}
        plan={editingPlan}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  )
}

export function PagosPlanesTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-6">
      <PaymentMethodsCard tenantId={tenantId} />
      <PaymentPlansCard tenantId={tenantId} />
    </div>
  )
}