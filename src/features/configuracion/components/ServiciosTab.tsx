import { Fragment, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { useServices, useServicePrices } from '@/features/configuracion/hooks/useServices'
import type { Service } from '@/lib/database.types'

const MODALITY_LABELS: Record<string, string> = {
  PRESENCIAL: 'Presencial',
  ONLINE: 'En línea',
  HIBRIDO: 'Híbrido',
}

type ServiceForm = {
  name: string
  description: string
  duration_minutes: string
  modality: string
  price: string
  max_appointments_per_day: string
  active: boolean
}

function emptyForm(): ServiceForm {
  return {
    name: '',
    description: '',
    duration_minutes: '50',
    modality: 'PRESENCIAL',
    price: '0',
    max_appointments_per_day: '0',
    active: true,
  }
}

function toForm(service: Service): ServiceForm {
  return {
    name: service.name,
    description: service.description ?? '',
    duration_minutes: String(service.duration_minutes),
    modality: service.modality,
    price: String(service.price),
    max_appointments_per_day: String(service.max_appointments_per_day),
    active: service.active,
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function ServiceFormDialog({
  tenantId,
  service,
  open,
  onOpenChange,
}: {
  tenantId: string
  service: Service | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<ServiceForm>(emptyForm())

  const isEditing = service !== null

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        duration_minutes: Number(form.duration_minutes),
        modality: form.modality,
        price: Number(form.price),
        max_appointments_per_day: Number(form.max_appointments_per_day),
        active: form.active,
      }
      const query = isEditing
        ? supabase.from('service').update(payload).eq('id', service.id)
        : supabase.from('service').insert({ tenant_id: tenantId, ...payload })
      const { error } = await query
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Servicio actualizado' : 'Servicio creado')
      queryClient.invalidateQueries({ queryKey: ['services', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['service_prices', tenantId] })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setForm(service ? toForm(service) : emptyForm())
    }
    onOpenChange(next)
  }

  const set = <K extends keyof ServiceForm>(field: K, value: ServiceForm[K]) =>
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
            <DialogTitle>{isEditing ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'El historial de precios se actualiza automáticamente (RF-CON10).'
                : 'Define los servicios terapéuticos que ofrece el consultorio (RF-CON09).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="service-name">Nombre</Label>
            <Input
              id="service-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ej. Terapia individual"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-description">Descripción</Label>
            <Input
              id="service-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-duration">Duración (min)</Label>
              <Input
                id="service-duration"
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) => set('duration_minutes', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-price">Precio (S/)</Label>
              <Input
                id="service-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-modality">Modalidad</Label>
              <Select value={form.modality} onValueChange={(v) => set('modality', v)}>
                <SelectTrigger id="service-modality" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODALITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-max">Máx. citas por día</Label>
              <Input
                id="service-max"
                type="number"
                min={0}
                value={form.max_appointments_per_day}
                onChange={(e) => set('max_appointments_per_day', e.target.value)}
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
            Servicio activo
          </label>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Crear servicio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function formatCurrency(value: number | string) {
  return `S/ ${Number(value).toFixed(2)}`
}

export function ServiciosTab({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const servicesQuery = useServices(tenantId)
  const pricesQuery = useServicePrices(tenantId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  const remove = useMutation({
    mutationFn: async (serviceId: string) => {
      const { error } = await supabase.from('service').delete().eq('id', serviceId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Servicio eliminado')
      queryClient.invalidateQueries({ queryKey: ['services', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['service_prices', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const toggleActive = useMutation({
    mutationFn: async ({ serviceId, active }: { serviceId: string; active: boolean }) => {
      const { error } = await supabase
        .from('service')
        .update({ active: !active })
        .eq('id', serviceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const services = servicesQuery.data ?? []
  const prices = pricesQuery.data ?? []

  const openCreate = () => {
    setEditingService(null)
    setDialogOpen(true)
  }

  const openEdit = (service: Service) => {
    setEditingService(service)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Servicios</CardTitle>
            <CardDescription>
              Oferta terapéutica con precios y modalidad (RF-CON09, RF-CON10).
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Nuevo servicio
          </Button>
        </CardHeader>
        <CardContent>
          {servicesQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay servicios. Crea el primero con «Nuevo servicio».
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => {
                  const isExpanded = historyFor === s.id
                  return (
                    <Fragment key={s.id}>
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            className="flex items-center gap-1 font-medium"
                            onClick={() => setHistoryFor(isExpanded ? null : s.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 text-muted-foreground" />
                            )}
                            {s.name}
                          </button>
                          {s.description && (
                            <span className="block text-xs text-muted-foreground">
                              {s.description}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{s.duration_minutes} min</TableCell>
                        <TableCell>{MODALITY_LABELS[s.modality] ?? s.modality}</TableCell>
                        <TableCell>{formatCurrency(s.price)}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => toggleActive.mutate({ serviceId: s.id, active: s.active })}
                          >
                            <Badge variant={s.active ? 'secondary' : 'outline'}>
                              {s.active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${s.id}-history`}>
                          <TableCell colSpan={6} className="bg-muted/40">
                            <div className="text-sm">
                              <p className="mb-2 font-medium">Historial de precios</p>
                              {prices.filter((p) => p.service_id === s.id).length === 0 ? (
                                <p className="text-muted-foreground">Sin registros.</p>
                              ) : (
                                <ul className="space-y-1">
                                  {prices
                                    .filter((p) => p.service_id === s.id)
                                    .map((p) => (
                                      <li key={p.id} className="flex items-center justify-between">
                                        <span>{formatCurrency(p.price)}</span>
                                        <span className="text-xs text-muted-foreground">
                                          Desde {formatDate(p.valid_from)}
                                          {p.valid_to ? ` hasta ${formatDate(p.valid_to)}` : ' (vigente)'}
                                        </span>
                                      </li>
                                    ))}
                                </ul>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ServiceFormDialog
        tenantId={tenantId}
        service={editingService}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}
