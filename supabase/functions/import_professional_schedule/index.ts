import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type ImportRow = {
  professionalId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  kind: 'WORK' | 'BREAK'
  row?: number
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

function normalizeTime(value: unknown): string | null {
  const t = String(value ?? '').trim()
  if (!TIME_RE.test(t)) return null
  return t.slice(0, 5)
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd
}

function sameBlock(a: ImportRow, b: ImportRow): boolean {
  return a.professionalId === b.professionalId && a.dayOfWeek === b.dayOfWeek && a.kind === b.kind
}

// La validación de la BD (validate_professional_schedule) ya es la autoridad
// final (membresía clínica + solapamientos). Esta función valida todo el lote
// ANTES de tocar la base de datos para no dejar estados parciales cuando se
// usa reemplazo, y devuelve errores por fila legibles (SRS 6.6).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader ?? '' } },
    auth: { persistSession: false },
  })

  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'No autorizado' }, 401)
  }

  let payload: {
    tenantId?: string
    replaceAll?: boolean
    rows?: ImportRow[]
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }

  const { tenantId, rows, replaceAll } = payload
  if (!tenantId || !Array.isArray(rows) || rows.length === 0) {
    return json({ error: 'tenantId y rows son obligatorios' }, 400)
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: callerRole } = await serviceClient
    .from('tenant_membership')
    .select('role:role(code)')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!callerRole || callerRole.role?.code !== 'tenant_admin') {
    return json({ error: 'Solo el Administrador de Consultorio puede importar horarios' }, 403)
  }

  const cleaned: ImportRow[] = []
  const failed: { row: number; error: string }[] = []

  for (const [index, raw] of rows.entries()) {
    const rowNumber = typeof raw.row === 'number' ? raw.row : index + 1
    const professionalId = String(raw.professionalId ?? '').trim()
    const startTime = normalizeTime(raw.startTime)
    const endTime = normalizeTime(raw.endTime)
    const dayOfWeek = Number(raw.dayOfWeek)
    const kind = raw.kind === 'BREAK' ? 'BREAK' : raw.kind === 'WORK' ? 'WORK' : null

    if (!professionalId) {
      failed.push({ row: rowNumber, error: 'Falta el profesional' })
      continue
    }
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      failed.push({ row: rowNumber, error: `Día inválido: ${raw.dayOfWeek}` })
      continue
    }
    if (!kind) {
      failed.push({ row: rowNumber, error: `Tipo inválido: ${raw.kind}` })
      continue
    }
    if (!startTime || !endTime) {
      failed.push({ row: rowNumber, error: `Horario inválido: ${raw.startTime} a ${raw.endTime}` })
      continue
    }
    if (endTime <= startTime) {
      failed.push({ row: rowNumber, error: 'La hora de fin debe ser posterior al inicio' })
      continue
    }
    cleaned.push({ professionalId, dayOfWeek, startTime, endTime, kind, row: rowNumber })
  }

  // Solapamientos dentro del propio archivo.
  for (let i = 0; i < cleaned.length; i++) {
    for (let j = i + 1; j < cleaned.length; j++) {
      const a = cleaned[i]
      const b = cleaned[j]
      if (sameBlock(a, b) && overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) {
        const aRow = typeof a.row === 'number' ? a.row : rows.indexOf(a) + 1
        const bRow = typeof b.row === 'number' ? b.row : rows.indexOf(b) + 1
        failed.push({
          row: aRow,
          error: `Se solapa con la fila ${bRow} (${a.startTime}–${a.endTime})`,
        })
        failed.push({
          row: bRow,
          error: `Se solapa con la fila ${aRow} (${a.startTime}–${a.endTime})`,
        })
      }
    }
  }

  const professionalIds = [...new Set(cleaned.map((r) => r.professionalId))]
  let existing: { id: string; professional_id: string; day_of_week: number; start_time: string; end_time: string; kind: string }[] = []
  if (professionalIds.length > 0) {
    const { data: existingData, error: existingError } = await serviceClient
      .from('professional_schedule')
      .select('id, professional_id, day_of_week, start_time, end_time, kind')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .in('professional_id', professionalIds)
    if (existingError) {
      return json({ error: existingError.message }, 500)
    }
    existing = existingData ?? []
  }

  // Membresía clínica activa por profesional involucrado.
  const { data: memberships, error: membershipError } = await serviceClient
    .from('tenant_membership')
    .select('user_id, role:role(code)')
    .eq('tenant_id', tenantId)
    .in('user_id', professionalIds)
    .eq('status', 'active')
  if (membershipError) {
    return json({ error: membershipError.message }, 500)
  }
  const clinical = new Set(
    (memberships ?? [])
      .filter((m) => m.role?.code === 'professional' || m.role?.code === 'tenant_admin')
      .map((m) => m.user_id),
  )

  const earlyFailures = new Set(failed.map((f) => f.row))
  for (const [, row] of cleaned.entries()) {
    const rowNumber = typeof row.row === 'number' ? row.row : rows.indexOf(row) + 1
    if (earlyFailures.has(rowNumber)) continue
    if (!clinical.has(row.professionalId)) {
      failed.push({
        row: rowNumber,
        error: 'El usuario no tiene una membresía activa como profesional en este consultorio',
      })
      continue
    }

    if (!replaceAll) {
      const conflict = existing.find(
        (e) =>
          e.professional_id === row.professionalId &&
          e.day_of_week === row.dayOfWeek &&
          e.kind === row.kind &&
          overlaps(e.start_time, e.end_time, row.startTime, row.endTime),
      )
      if (conflict) {
        failed.push({
          row: rowNumber,
          error: `Se solapa con un bloque existente (${conflict.start_time}–${conflict.end_time})`,
        })
      }
    }
  }

  // Inserción parcial: las filas con errores se reportan y el resto se inserta.
  // Dedupe por número de fila (un mismo bloque puede aparecer en varios pares).
  const failedByRow = new Map<number, { row: number; error: string }>()
  for (const f of failed) {
    if (!failedByRow.has(f.row)) failedByRow.set(f.row, f)
  }
  failed.length = 0
  failed.push(...failedByRow.values())
  const seenFailures = new Set(failed.map((f) => f.row))
  const toInsert = cleaned.filter((r) => !seenFailures.has(r.row))
  if (toInsert.length === 0) {
    return json({ inserted: 0, failed })
  }

  // Reemplazo: eliminar bloques existentes de los profesionales que se insertarán.
  if (replaceAll) {
    const toInsertProfessionalIds = [...new Set(toInsert.map((r) => r.professionalId))]
    const { error: deleteError } = await serviceClient
      .from('professional_schedule')
      .delete()
      .eq('tenant_id', tenantId)
      .in('professional_id', toInsertProfessionalIds)
    if (deleteError) {
      return json({ error: deleteError.message }, 500)
    }
  }

  const { error: insertError } = await serviceClient.from('professional_schedule').insert(
    toInsert.map((r) => ({
      tenant_id: tenantId,
      professional_id: r.professionalId,
      day_of_week: r.dayOfWeek,
      start_time: r.startTime,
      end_time: r.endTime,
      kind: r.kind,
    })),
  )
  if (insertError) {
    return json({ error: insertError.message }, 500)
  }

  return json({ inserted: toInsert.length, failed })
})
