import { ShieldX } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2">
            <ShieldX className="size-10 text-destructive" />
          </div>
          <CardTitle>Sin acceso a consultorios</CardTitle>
          <CardDescription>
            Tu cuenta no tiene una membresía activa en ningún consultorio. Contacta al
            administrador de tu consultorio para obtener acceso.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  )
}
