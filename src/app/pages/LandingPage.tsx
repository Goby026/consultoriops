import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ClipboardList,
  Globe,
  HeartPulse,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks/useSession'

const features = [
  {
    icon: CalendarDays,
    title: 'Agenda y citas',
    description:
      'Organiza la agenda de tus profesionales con bloques de horario, solapamientos controlados y confirmación automática.',
  },
  {
    icon: ClipboardList,
    title: 'Historial clínico',
    description:
      'Registra sesiones, notas SOAP, adjunta documentos y firma consentimientos con trazabilidad completa.',
  },
  {
    icon: Banknote,
    title: 'Caja y cobros',
    description:
      'Gestiona cobros, pagos parciales, planes y aranceles desde un solo lugar, con registro de caja.',
  },
  {
    icon: HeartPulse,
    title: 'Portal del paciente',
    description:
      'Tus pacientes piden citas, consultan su historial resumido y firman consentimientos desde su propio portal.',
  },
]

const audience = [
  {
    icon: Users,
    title: 'Equipo del consultorio',
    description: 'Profesionales y administración gestionan la operación diaria.',
    to: '/login',
    label: 'Iniciar sesión',
  },
  {
    icon: HeartPulse,
    title: 'Pacientes',
    description: 'Acceso personal con citas, historial y consentimientos.',
    to: '/portal/registro',
    label: 'Portal del paciente',
  },
  {
    icon: Globe,
    title: 'Plataforma',
    description: 'Supervisión de consultorios para administradores de plataforma.',
    to: '/login',
    label: 'Consola de plataforma',
  },
]

export function LandingPage() {
  const { session } = useSession()
  const mainCta = session ? (
    <Button size="lg" asChild>
      <Link to="/app">
        Ir a mi consultorio
        <ArrowRight data-icon="inline-end" />
      </Link>
    </Button>
  ) : (
    <Button size="lg" asChild>
      <Link to="/login">
        Entrar a mi consultorio
        <ArrowRight data-icon="inline-end" />
      </Link>
    </Button>
  )

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--accent) 70%, transparent), transparent 70%)',
        }}
      />

      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-(--shadow-card)">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm leading-tight font-semibold">ConsultorioPS</p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Gestión de consultorio psicológico
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            <Button variant="ghost" asChild>
              <Link to="/portal/registro">Portal del paciente</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/signup">Crear cuenta</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          </nav>

          <div className="sm:hidden">
            <Button asChild>
              <Link to="/login">Acceder</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 pt-20 pb-16 text-center md:px-6 md:pt-28">
          <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-(--shadow-card)">
            Plataforma clínica para consultorios psicológicos
          </span>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl">
              La gestión integral de tu consultorio, en un solo lugar
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
              Agenda, historial clínico, caja y portal del paciente en una plataforma pensada para
              profesionales de la salud mental.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {mainCta}
            <Button size="lg" variant="outline" asChild>
              <Link to="/portal/registro">Portal del paciente</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 md:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col gap-3 rounded-xl border bg-background p-5 shadow-(--shadow-card)"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/50">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-14 sm:grid-cols-3 md:px-6">
            {audience.map((item) => (
              <div key={item.title} className="flex flex-col gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <item.icon className="size-5" />
                </div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <Button variant="ghost" size="sm" className="justify-start px-0" asChild>
                  <Link to={item.to}>
                    {item.label}
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center md:px-6">
          <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            Empieza hoy a gestionar tu consultorio
          </h2>
          <Button size="lg" asChild>
            <Link to={session ? '/app' : '/signup'}>
              {session ? 'Ir a mi consultorio' : 'Crear cuenta'}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row md:px-6">
          <p className="flex items-center gap-2">
            <Sparkles className="size-4" />
            ConsultorioPS
          </p>
          <p>Plataforma de gestión clínica para consultorios psicológicos</p>
        </div>
      </footer>
    </div>
  )
}