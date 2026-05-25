'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { can, type Role, type Permission } from '@/lib/rbac'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: Role
  requiredPermission?: Permission
  fallback?: ReactNode
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallback,
}: ProtectedRouteProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      fallback ?? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )
    )
  }

  if (!session?.user) return null

  const userRole = (session.user as any).role as Role

  if (requiredRole && userRole !== requiredRole && userRole !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground mt-2">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  if (requiredPermission && !can(userRole, requiredPermission)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground mt-2">
            Missing required permission: {requiredPermission}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
