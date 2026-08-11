import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthGate } from '@/features/auth/components/AuthGate'
import { AppShell } from '@/app/AppShell'
import { LoginPage } from '@/app/pages/LoginPage'
import { SignupPage } from '@/app/pages/SignupPage'
import { CheckEmailPage } from '@/app/pages/CheckEmailPage'
import { NoAccessPage } from '@/app/pages/NoAccessPage'
import { DashboardPage } from '@/app/pages/DashboardPage'
import { TenantSelectionPage } from '@/features/tenants/components/TenantSelectionPage'
import { PlatformConsolePage } from '@/features/platform/components/PlatformConsolePage'
import { ConfiguracionPage } from '@/features/configuracion/components/ConfiguracionPage'
import { PacientesPage } from '@/features/pacientes/components/PacientesPage'
import { CitasPage } from '@/features/citas/components/CitasPage'
import { SesionesPage } from '@/features/sesiones/components/SesionesPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/check-email',
    element: <CheckEmailPage />,
  },
  {
    path: '/no-access',
    element: <NoAccessPage />,
  },
  {
    path: '/select-tenant',
    element: <TenantSelectionPage />,
  },
  {
    path: '/plataforma',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [{ index: true, element: <PlatformConsolePage /> }],
  },
  {
    path: '/',
    element: (
      <AuthGate>
        <AppShell />
      </AuthGate>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'configuracion', element: <ConfiguracionPage /> },
      { path: 'pacientes', element: <PacientesPage /> },
      { path: 'citas', element: <CitasPage /> },
      { path: 'sesiones', element: <SesionesPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
