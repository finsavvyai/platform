'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred while loading this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            {error.message || 'Please try again or contact support if the problem persists.'}
          </p>
          {process.env.NODE_ENV === 'development' && error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={reset} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
