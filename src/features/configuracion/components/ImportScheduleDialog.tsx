import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { supabase } from '@/lib/supabaseClient'
import { dayLabel } from './dayLabels'
import {
  downloadScheduleTemplate,
  parseScheduleWorkbook,
  type ScheduleImportRow,
} from './scheduleImport'
import type { TenantMember } from '@/features/configuracion/hooks/useMembers'

type ImportScheduleDialogProps = {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProfessionalId: string
  professionals: TenantMember[]
}

export function ImportScheduleDialog({
  tenantId,
  open,
  onOpenChange,
  defaultProfessionalId,
  professionals,
}: ImportScheduleDialogProps) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<ScheduleImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [replaceAll, setReplaceAll] = useState(false)

  const validRows = useMemo(() => rows.filter((r) => r.errors.length === 0), [rows])
  const invalidCount = rows.length - validRows.length

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const buffer = await file.arrayBuffer()
    const result = parseScheduleWorkbook(buffer, professionals, defaultProfessionalId)
    setRows(result.rows)
    setFileName(file.name)
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('import_professional_schedule', {
        body: {
          tenantId,
          replaceAll,
          rows: validRows.map((r, i) => ({
            professionalId: r.professionalId,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
            kind: r.kind,
            row: i + 1,
          })),
        },
      })
      if (error) throw error
      const result = data as { inserted?: number; failed?: { row: number; error: string }[]; error?: string }
      if (result.error) throw new Error(result.error)
      return result
    },
    onSuccess: (result) => {
      const failed = result.failed?.length ?? 0
      if (failed > 0) {
        toast.error(`Se importaron ${result.inserted} bloques. ${failed} fila(s) fallaron en el servidor.`)
      } else {
        toast.success(`Se importaron ${result.inserted} bloques de horario.`)
      }
      queryClient.invalidateQueries({ queryKey: ['professional_schedule', tenantId] })
      onOpenChange(false)
      setRows([])
      setFileName('')
      setReplaceAll(false)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const reset = () => {
    setRows([])
    setFileName('')
    setReplaceAll(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar horarios desde Excel</DialogTitle>
          <DialogDescription>
            Columnas: <b>Profesional</b> (nombre o email, opcional si ya elegiste uno),{' '}
            <b>Día</b> (0–6 o nombre, ej. Lunes), <b>Inicio</b>, <b>Fin</b> y <b>Tipo</b>{' '}
            (Trabajo / Descanso). Los solapamientos y errores se muestran antes de guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={downloadScheduleTemplate}>
            <Download className="mr-2 size-4" />
            Plantilla
          </Button>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground">
            <FileSpreadsheet className="size-4 shrink-0" />
            {fileName || 'Selecciona un archivo .xlsx, .xls o .csv'}
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={replaceAll}
            onChange={(e) => setReplaceAll(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Reemplazar el horario actual de los profesionales importados{' '}
            <span className="text-muted-foreground">
              (elimina los bloques existentes de esos profesionales antes de insertar).
            </span>
          </span>
        </label>

        {rows.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      {r.professionalName || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.dayOfWeek >= 0 ? dayLabel(r.dayOfWeek) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.startTime && r.endTime ? `${r.startTime} – ${r.endTime}` : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{r.kind === 'WORK' ? 'Trabajo' : r.kind === 'BREAK' ? 'Descanso' : '—'}</TableCell>
                    <TableCell>
                      {r.errors.length === 0 ? (
                        <Badge variant="secondary">OK</Badge>
                      ) : (
                        <Badge variant="destructive">{r.errors[0]}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {invalidCount > 0 && (
              <p className="border-t p-2 text-sm text-destructive">
                {invalidCount} fila(s) con errores. Corrige el archivo o la selección antes de importar.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={rows.length === 0 || invalidCount > 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            Importar {validRows.length > 0 ? `${validRows.length} bloque(s)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
