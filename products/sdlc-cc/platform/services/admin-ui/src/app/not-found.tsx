import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-muted-foreground">404</span>
          </div>
          <CardTitle className="text-2xl">Page Not Found</CardTitle>
          <CardDescription>
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground">
            Please check the URL for typos or return to the dashboard.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/">
              <span className="inline-flex items-center">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </span>
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">
              <span className="inline-flex items-center">
                <Home className="w-4 h-4 mr-2" />
                Dashboard
              </span>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
