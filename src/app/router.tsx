/* eslint-disable react/only-export-components */
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthGate } from '@/features/auth/components/AuthGate'
import { PortalGate } from '@/features/portal/components/PortalGate'
import { AppShell } from '@/app/AppShell'

const LoginPage = lazy(() => import('@/app/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('@/app/pages/SignupPage').then((m) => ({ default: m.SignupPage })))
const CheckEmailPage = lazy(() =>
  import('@/app/pages/CheckEmailPage').then((m) => ({ default: m.CheckEmailPage })),
)
const NoAccessPage = lazy(() =>
  import('@/app/pages/NoAccessPage').then((m) => ({ default: m.NoAccessPage })),
)
const CambiarContrasenaPage = lazy(() =>
  import('@/app/pages/CambiarContrasenaPage').then((m) => ({ default: m.CambiarContrasenaPage })),
)
const DashboardPage = lazy(() =>
  import('@/app/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const LandingPage = lazy(() =>
  import('@/app/pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const TenantSelectionPage = lazy(() =>
  import('@/features/tenants/components/TenantSelectionPage').then((m) => ({
    default: m.TenantSelectionPage,
  })),
)
const PlatformConsolePage = lazy(() =>
  import('@/features/platform/components/PlatformConsolePage').then((m) => ({
    default: m.PlatformConsolePage,
  })),
)
const ConfiguracionPage = lazy(() =>
  import('@/features/configuracion/components/ConfiguracionPage').then((m) => ({
    default: m.ConfiguracionPage,
  })),
)
const PacientesPage = lazy(() =>
  import('@/features/pacientes/components/PacientesPage').then((m) => ({
    default: m.PacientesPage,
  })),
)
const HistorialClinicoPage = lazy(() =>
  import('@/features/pacientes/components/HistorialClinicoPage').then((m) => ({
    default: m.HistorialClinicoPage,
  })),
)
const CitasPage = lazy(() =>
  import('@/features/citas/components/CitasPage').then((m) => ({ default: m.CitasPage })),
)
const SesionesPage = lazy(() =>
  import('@/features/sesiones/components/SesionesPage').then((m) => ({
    default: m.SesionesPage,
  })),
)
const CajaPage = lazy(() =>
  import('@/features/caja/components/CajaPage').then((m) => ({ default: m.CajaPage })),
)
const PortalLayout = lazy(() =>
  import('@/features/portal/components/PortalLayout').then((m) => ({ default: m.PortalLayout })),
)
const PortalRegisterPage = lazy(() =>
  import('@/features/portal/pages/PortalRegisterPage').then((m) => ({
    default: m.PortalRegisterPage,
  })),
)
const PortalDashboardPage = lazy(() =>
  import('@/features/portal/pages/PortalDashboardPage').then((m) => ({
    default: m.PortalDashboardPage,
  })),
)
const PortalAppointmentsPage = lazy(() =>
  import('@/features/portal/pages/PortalAppointmentsPage').then((m) => ({
    default: m.PortalAppointmentsPage,
  })),
)
const PortalNewAppointmentPage = lazy(() =>
  import('@/features/portal/pages/PortalNewAppointmentPage').then((m) => ({
    default: m.PortalNewAppointmentPage,
  })),
)
const PortalHistoryPage = lazy(() =>
  import('@/features/portal/pages/PortalHistoryPage').then((m) => ({
    default: m.PortalHistoryPage,
  })),
)
const PortalConsentPage = lazy(() =>
  import('@/features/portal/pages/PortalConsentPage').then((m) => ({
    default: m.PortalConsentPage,
  })),
)
const PortalProfilePage = lazy(() =>
  import('@/features/portal/pages/PortalProfilePage').then((m) => ({
    default: m.PortalProfilePage,
  })),
)

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Page>
        <LoginPage />
      </Page>
    ),
  },
  {
    path: '/signup',
    element: (
      <Page>
        <SignupPage />
      </Page>
    ),
  },
  {
    path: '/check-email',
    element: (
      <Page>
        <CheckEmailPage />
      </Page>
    ),
  },
  {
    path: '/no-access',
    element: (
      <Page>
        <NoAccessPage />
      </Page>
    ),
  },
  {
    path: '/cambiar-contrasena',
    element: (
      <Page>
        <CambiarContrasenaPage />
      </Page>
    ),
  },
  {
    path: '/select-tenant',
    element: (
      <Page>
        <TenantSelectionPage />
      </Page>
    ),
  },
  {
    path: '/plataforma',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      {
        index: true,
        element: (
          <Page>
            <PlatformConsolePage />
          </Page>
        ),
      },
    ],
  },
  {
    path: '/',
    element: (
      <Page>
        <LandingPage />
      </Page>
    ),
  },
  {
    path: '/app',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      {
        index: true,
        element: (
          <Page>
            <DashboardPage />
          </Page>
        ),
      },
      {
        path: 'configuracion',
        element: (
          <Page>
            <ConfiguracionPage />
          </Page>
        ),
      },
      {
        path: 'pacientes',
        element: (
          <Page>
            <PacientesPage />
          </Page>
        ),
      },
      {
        path: 'pacientes/:patientId',
        element: (
          <Page>
            <HistorialClinicoPage />
          </Page>
        ),
      },
      {
        path: 'citas',
        element: (
          <Page>
            <CitasPage />
          </Page>
        ),
      },
      {
        path: 'sesiones',
        element: (
          <Page>
            <SesionesPage />
          </Page>
        ),
      },
      {
        path: 'caja',
        element: (
          <Page>
            <CajaPage />
          </Page>
        ),
      },
    ],
  },
  {
    path: '/portal/registro',
    element: (
      <PortalGate requireLinked={false}>
        <Page>
          <PortalRegisterPage />
        </Page>
      </PortalGate>
    ),
  },
  {
    path: '/portal',
    element: (
      <PortalGate>
        <PortalLayout />
      </PortalGate>
    ),
    children: [
      {
        index: true,
        element: (
          <Page>
            <PortalDashboardPage />
          </Page>
        ),
      },
      {
        path: 'citas',
        element: (
          <Page>
            <PortalAppointmentsPage />
          </Page>
        ),
      },
      {
        path: 'nueva-cita',
        element: (
          <Page>
            <PortalNewAppointmentPage />
          </Page>
        ),
      },
      {
        path: 'historial',
        element: (
          <Page>
            <PortalHistoryPage />
          </Page>
        ),
      },
      {
        path: 'consentimiento',
        element: (
          <Page>
            <PortalConsentPage />
          </Page>
        ),
      },
      {
        path: 'perfil',
        element: (
          <Page>
            <PortalProfilePage />
          </Page>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])