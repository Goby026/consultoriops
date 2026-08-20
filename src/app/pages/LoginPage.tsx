import { Navigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useSession } from '@/features/auth/hooks/useSession'

export function LoginPage() {
  const { session, loading } = useSession()

  if (loading) return null
  if (session) return <Navigate to="/app" replace />

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--accent) 60%, transparent), transparent 70%)',
        }}
      />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-(--shadow-card)">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-lg leading-tight font-semibold">ConsultorioPS</p>
            <p className="text-sm text-muted-foreground">Gestión de consultorio psicológico</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}