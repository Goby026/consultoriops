import * as XLSX from 'xlsx'
import type { TenantMember } from '@/features/configuracion/hooks/useMembers'

export type ScheduleImportRow = {
  professionalId: string
  professionalName: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: 'WORK' | 'BREAK'
  errors: string[]
}

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function deaccent(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeKey(key: string): string {
  return deaccent(key.trim().toLowerCase())
}

function findHeader(row: Record<string, unknown>, names: string[]): string | null {
  for (const key of Object.keys(row)) {
    const k = normalizeKey(key)
    if (names.some((n) => k === n || k.startsWith(n))) return key
  }
  return null
}

function parseDay(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    const n = Math.round(value)
    return n >= 0 && n <= 6 ? n : null
  }
  const s = normalizeKey(String(value))
  if (/^[0-6]$/.test(s)) return Number(s)
  if (s.length >= 2) {
    for (let i = 0; i < DAY_NAMES.length; i++) {
      if (DAY_NAMES[i].startsWith(s)) return i
    }
  }
  return null
}

function parseTime(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    let total = Math.round(value * 24 * 60)
    total = ((total % 1440) + 1440) % 1440
    const h = Math.floor(total / 60)
    const m = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseKind(value: unknown): 'WORK' | 'BREAK' | null {
  if (value === null || value === undefined || value === '') return null
  const s = normalizeKey(String(value))
  if (s === 'work' || s === 'trabajo' || s === 'w') return 'WORK'
  if (s === 'break' || s === 'descanso' || s === 'b') return 'BREAK'
  return null
}

function resolveProfessional(
  value: unknown,
  members: TenantMember[],
): TenantMember | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const s = deaccent(raw.toLowerCase())
  return (
    members.find((m) => {
      const email = deaccent((m.user_profile?.email ?? '').toLowerCase())
      const name = deaccent((m.user_profile?.full_name ?? '').toLowerCase())
      return email === s || name === s
    }) ?? null
  )
}

export type ParseResult = {
  rows: ScheduleImportRow[]
  total: number
}

export function parseScheduleWorkbook(
  buffer: ArrayBuffer,
  members: TenantMember[],
  defaultProfessionalId: string,
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return { rows: [], total: 0 }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const rows: ScheduleImportRow[] = []

  for (const raw of rawRows) {
    const professionalHeader = findHeader(raw, ['profesional', 'professional'])
    const dayHeader = findHeader(raw, ['dia', 'day'])
    const startHeader = findHeader(raw, ['inicio', 'start', 'desde'])
    const endHeader = findHeader(raw, ['fin', 'end', 'hasta'])
    const kindHeader = findHeader(raw, ['tipo', 'kind', 'type'])

    const errors: string[] = []

    let professional: TenantMember | null = null
    if (professionalHeader) {
      professional = resolveProfessional(raw[professionalHeader], members)
      if (!professional) {
        errors.push(
          `Profesional no encontrado: "${String(raw[professionalHeader])}". Usa el nombre o el email de un profesional del consultorio.`,
        )
      }
    } else if (defaultProfessionalId) {
      professional = members.find((m) => m.user_id === defaultProfessionalId) ?? null
    } else {
      errors.push('Indica el profesional (columna "Profesional") o selecciónalo antes de importar')
    }

    const dayOfWeek = dayHeader ? parseDay(raw[dayHeader]) : null
    if (dayOfWeek === null) errors.push('Día inválido. Usa 0–6 o el nombre del día (ej. Lunes).')

    const startTime = startHeader ? parseTime(raw[startHeader]) : null
    const endTime = endHeader ? parseTime(raw[endHeader]) : null
    if (!startTime) errors.push('Hora de inicio inválida (ej. 08:00 o 08:30).')
    if (!endTime) errors.push('Hora de fin inválida (ej. 12:00).')
    if (startTime && endTime && endTime <= startTime) {
      errors.push('La hora de fin debe ser posterior a la de inicio.')
    }

    const kind = kindHeader ? parseKind(raw[kindHeader]) : null
    if (!kind) errors.push('Tipo inválido. Usa "Trabajo" o "Descanso".')

    rows.push({
      professionalId: professional?.user_id ?? '',
      professionalName: professional?.user_profile?.full_name || professional?.user_profile?.email || '',
      dayOfWeek: dayOfWeek ?? -1,
      startTime: startTime ?? '',
      endTime: endTime ?? '',
      kind: kind ?? 'WORK',
      errors,
    })
  }

  // Solapamientos dentro del archivo (mismo profesional, día y tipo).
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]
      const b = rows[j]
      if (
        a.errors.length === 0 &&
        b.errors.length === 0 &&
        a.professionalId &&
        a.professionalId === b.professionalId &&
        a.dayOfWeek === b.dayOfWeek &&
        a.kind === b.kind &&
        a.startTime < b.endTime &&
        b.startTime < a.endTime
      ) {
        a.errors.push(`Se solapa con la fila ${j + 1} (${a.startTime}–${a.endTime}).`)
        b.errors.push(`Se solapa con la fila ${i + 1} (${a.startTime}–${a.endTime}).`)
      }
    }
  }

  return { rows, total: rows.length }
}

export function downloadScheduleTemplate() {
  const headers = ['Profesional', 'Dia', 'Inicio', 'Fin', 'Tipo']
  const sheet = XLSX.utils.json_to_sheet([
    { Profesional: 'Nombre o email del profesional', Dia: 'Lunes', Inicio: '08:00', Fin: '12:00', Tipo: 'Trabajo' },
    { Profesional: '', Dia: 1, Inicio: '12:00', Fin: '13:00', Tipo: 'Descanso' },
    { Profesional: '', Dia: 'Martes', Inicio: '08:00', Fin: '12:00', Tipo: 'Trabajo' },
  ])
  sheet['!cols'] = headers.map(() => ({ wch: 28 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, 'Horarios')
  XLSX.writeFile(wb, 'plantilla_horarios_profesional.xlsx')
}
