import { Navigate } from 'react-router-dom'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useSession } from '@/features/auth/hooks/useSession'

export function LoginPage() {
  const { session, loading } = useSession()

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm />
    </div>
  )
}
