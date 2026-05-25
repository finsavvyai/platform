import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { can, type Role, type Permission } from '@/lib/rbac'

/**
 * Get the current session in a Server Component.
 * Redirects to sign-in if unauthenticated.
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin')
  }
  return session
}

/**
 * Require a specific role. Redirects to /unauthorized on failure.
 */
export async function requireRole(role: Role) {
  const session = await requireAuth()
  if (session.user.role !== role && session.user.role !== 'ADMIN') {
    redirect('/unauthorized')
  }
  return session
}

/**
 * Require a specific permission. Redirects to /unauthorized on failure.
 */
export async function requirePermission(permission: Permission) {
  const session = await requireAuth()
  if (!can(session.user.role as Role, permission)) {
    redirect('/unauthorized')
  }
  return session
}

/**
 * Get the current session without redirecting.
 * Returns null if unauthenticated.
 */
export async function getSession() {
  return auth()
}

/**
 * Check if the current user has admin role.
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth()
  return session?.user?.role === 'ADMIN'
}
