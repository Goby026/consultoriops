import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Revisa tu correo</CardTitle>
          <CardDescription>
            Enviamos un enlace de confirmación a tu cuenta. Verifícalo antes de iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/login">Ir a iniciar sesión</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
