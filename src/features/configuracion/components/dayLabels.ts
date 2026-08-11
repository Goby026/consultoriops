export const DAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

export function dayLabel(dayOfWeek: number) {
  return DAY_LABELS[dayOfWeek] ?? String(dayOfWeek)
}
