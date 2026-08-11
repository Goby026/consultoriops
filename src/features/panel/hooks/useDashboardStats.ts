import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

type SessionForStats = {
  id: string
  status: string
  patient_id: string
  professional_id: string
  started_at: string
  patient: { first_name: string; last_name: string } | null
  appointment: { duration_minutes: number } | null
}

type AppointmentForStats = {
  id: string
  status: string
  attendance: string | null
  scheduled_at: string
  patient: { first_name: string; last_name: string } | null
  service: { name: string } | null
}

export type DashboardStats = {
  sessions: SessionForStats[]
  plans: { id: string; status: string; professional_id: string }[]
  appointments: AppointmentForStats[]
  patientsTotal: number
  patientsNewThisMonth: number
  totals: {
    sessions: number
    openSessions: number
    hours: number
    patientsAttended: number
    plansActive: number
    plansCompleted: number
  }
  attendanceRate: number | null
  todayCount: number
  upcoming: AppointmentForStats[]
  isLoading: boolean
}

function todayKeyLocal(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function useDashboardStats(
  tenantId: string | null,
  professionalId: string | null = null,
  clinical = true,
) {
  const sessionsQuery = useQuery({
    queryKey: ['stats_sessions', tenantId, professionalId],
    enabled: Boolean(tenantId) && clinical,
    queryFn: async () => {
      let q = supabase
        .from('session')
        .select('id, status, patient_id, professional_id, started_at, patient(first_name, last_name), appointment(duration_minutes)')
        .eq('tenant_id', tenantId!)
        .order('started_at', { ascending: false })
      if (professionalId) q = q.eq('professional_id', professionalId)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return (data ?? []) as unknown as SessionForStats[]
    },
  })

  const plansQuery = useQuery({
    queryKey: ['stats_plans', tenantId, professionalId],
    enabled: Boolean(tenantId) && clinical,
    queryFn: async () => {
      let q = supabase.from('treatment_plan').select('id, status, professional_id').eq('tenant_id', tenantId!)
      if (professionalId) q = q.eq('professional_id', professionalId)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return (data ?? []) as { id: string; status: string; professional_id: string }[]
    },
  })

  const patientsQuery = useQuery({
    queryKey: ['stats_patients', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient')
        .select('id, created_at')
        .eq('tenant_id', tenantId!)
        .limit(500)
      if (error) throw error
      return (data ?? []) as { id: string; created_at: string }[]
    },
  })

  const appointmentsQuery = useQuery({
    queryKey: ['stats_appointments', tenantId, professionalId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      let q = supabase
        .from('appointment')
        .select('id, status, attendance, scheduled_at, patient(first_name, last_name), service(name)')
        .eq('tenant_id', tenantId!)
        .order('scheduled_at', { ascending: true })
      if (professionalId) q = q.eq('professional_id', professionalId)
      const { data, error } = await q.limit(500)
      if (error) throw error
      return (data ?? []) as unknown as AppointmentForStats[]
    },
  })

  return useMemo(() => {
    const sessions = sessionsQuery.data ?? []
    const plans = plansQuery.data ?? []
    const appointments = appointmentsQuery.data ?? []
    const patients = patientsQuery.data ?? []

    const totalSessions = sessions.length
    const openSessions = sessions.filter((s) => s.status === 'open').length
    const hours = sessions.reduce(
      (acc, s) => acc + (s.appointment?.duration_minutes ?? 0),
      0,
    ) / 60
    const patientsAttended = new Set(sessions.map((s) => s.patient_id)).size
    const plansActive = plans.filter((p) => p.status === 'active').length
    const plansCompleted = plans.filter((p) => p.status === 'completed').length

    const now = new Date()
    const nowPlus7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const patientsTotal = patients.length
    const patientsNewThisMonth = patients.filter((p) => new Date(p.created_at) >= monthStart).length

    const attended = appointments.filter((a) => a.attendance === 'PRESENT' || a.attendance === 'LATE')
    const absent = appointments.filter((a) => a.attendance === 'ABSENT')
    const attendanceRate =
      attended.length + absent.length > 0
        ? Math.round((attended.length / (attended.length + absent.length)) * 100)
        : null

    const todayKey = todayKeyLocal(now)

    const upcoming = appointments.filter(
      (a) =>
        a.status === 'PROGRAMADA' &&
        new Date(a.scheduled_at) >= now &&
        new Date(a.scheduled_at) <= nowPlus7,
    )
    const todayCount = appointments.filter(
      (a) => a.status === 'PROGRAMADA' && todayKeyLocal(new Date(a.scheduled_at)) === todayKey,
    ).length

    return {
      sessions,
      plans,
      appointments,
      patientsTotal,
      patientsNewThisMonth,
      totals: {
        sessions: totalSessions,
        openSessions,
        hours: Math.round(hours * 10) / 10,
        patientsAttended,
        plansActive,
        plansCompleted,
      },
      attendanceRate,
      todayCount,
      upcoming,
      isLoading:
        sessionsQuery.isLoading || plansQuery.isLoading ||
        appointmentsQuery.isLoading || patientsQuery.isLoading,
    }
  }, [
    sessionsQuery.data,
    plansQuery.data,
    appointmentsQuery.data,
    patientsQuery.data,
    sessionsQuery.isLoading,
    plansQuery.isLoading,
    appointmentsQuery.isLoading,
    patientsQuery.isLoading,
  ])
}
