'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsSubmitted(true)
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-xl">SD</span>
          </div>
          <CardTitle className="text-2xl">
            {isSubmitted ? 'Check your email' : 'Reset your password'}
          </CardTitle>
          <CardDescription>
            {isSubmitted
              ? `We've sent a password reset link to ${email}`
              : 'Enter your email address and we\'ll send you a reset link'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isSubmitted ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-50 dark:bg-green-950 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                Didn't receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-primary hover:underline cursor-pointer"
                >
                  try again
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || !email}>
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="text-center">
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
