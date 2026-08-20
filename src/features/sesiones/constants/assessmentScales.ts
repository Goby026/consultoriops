export type AssessmentScaleCode = 'PHQ-9' | 'GAD-7'

export type AssessmentScale = {
  code: AssessmentScaleCode
  label: string
  instructions: string
  questions: string[]
  severityFor: (total: number) => string
}

export const ASSESSMENT_SCALES: AssessmentScale[] = [
  {
    code: 'PHQ-9',
    label: 'PHQ-9 · Cuestionario de salud del paciente',
    instructions:
      'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
    questions: [
      'Poco interés o placer en hacer las cosas',
      'Sentirse decaído(a), deprimido(a) o sin esperanza',
      'Problemas para conciliar el sueño, mantenerlo o dormir demasiado',
      'Sentirse cansado(a) o con poca energía',
      'Sin apetito o comer en exceso',
      'Sentirse mal consigo mismo(a) o que es un fracaso o ha decepcionado a su familia',
      'Dificultad para concentrarse (leer, ver televisión…)',
      'Moverse o hablar tan despacio que otras personas lo han notado; o al contrario, tan inquieto(a) que se mueve más de lo habitual',
      'Pensamientos de que estaría mejor muerto(a) o de hacerse daño de alguna manera',
    ],
    severityFor: (total: number) => {
      if (total <= 4) return 'Mínima'
      if (total <= 9) return 'Leve'
      if (total <= 14) return 'Moderada'
      if (total <= 19) return 'Moderadamente grave'
      return 'Grave'
    },
  },
  {
    code: 'GAD-7',
    label: 'GAD-7 · Trastorno de ansiedad generalizada',
    instructions:
      'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
    questions: [
      'Sentirse nervioso(a), ansioso(a) o al límite',
      'No poder dejar de preocuparse o no poder controlar la preocupación',
      'Preocuparse demasiado por diferentes cosas',
      'Dificultad para relajarse',
      'Tanta inquietud que le es difícil quedarse quieto(a)',
      'Se molesta o irrita fácilmente',
      'Sentir miedo, como si algo malo pudiera ocurrir',
    ],
    severityFor: (total: number) => {
      if (total <= 4) return 'Mínima'
      if (total <= 9) return 'Leve'
      if (total <= 14) return 'Moderada'
      return 'Grave'
    },
  },
]

export const SCALE_LABELS: Record<AssessmentScaleCode, string> = {
  'PHQ-9': 'PHQ-9',
  'GAD-7': 'GAD-7',
}

export function getScale(code: AssessmentScaleCode): AssessmentScale {
  return ASSESSMENT_SCALES.find((s) => s.code === code) ?? ASSESSMENT_SCALES[0]
}

export const SEVERITY_VARIANT: Record<string, 'secondary' | 'outline' | 'destructive'> = {
  Mínima: 'secondary',
  Leve: 'secondary',
  Moderada: 'outline',
  'Moderadamente grave': 'destructive',
  Grave: 'destructive',
}

export function severityVariant(severity: string): 'secondary' | 'outline' | 'destructive' {
  return SEVERITY_VARIANT[severity] ?? 'secondary'
}

export const ICD11_SUGGESTIONS: Array<{ code: string; label: string }> = [
  { code: '6A71', label: 'Trastornos depresivos' },
  { code: '6A72', label: 'Trastornos bipolares o relacionados' },
  { code: '6A40', label: 'Trastorno de estrés postraumático' },
  { code: '6A61', label: 'Agorafobia' },
  { code: '6A62', label: 'Fobia específica' },
  { code: '6A60', label: 'Trastorno de pánico' },
  { code: '6B01', label: 'Trastornos de ansiedad o relacionados con el miedo' },
  { code: '6B03', label: 'Trastorno obsesivo-compulsivo' },
  { code: '6B06', label: 'Trastorno de estrés postraumático complejo' },
  { code: '6C70', label: 'Insomnio' },
  { code: '6D85', label: 'Trastornos del sueño-vigilia' },
  { code: '6D12', label: 'Reacción aguda al estrés' },
  { code: '6D10', label: 'Trastornos de los síntomas somáticos o relacionados' },
  { code: '6D11', label: 'Trastorno por evitación de la salud' },
]