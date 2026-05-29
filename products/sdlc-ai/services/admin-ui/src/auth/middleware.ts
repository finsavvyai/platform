import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Check if user is authenticated
    if (!token) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // Role-based access control
    const isAdminRoute = pathname.startsWith('/admin')
    const isSettingsRoute = pathname.startsWith('/settings')
    const isUsersRoute = pathname.startsWith('/users')

    if (isAdminRoute && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (isUsersRoute && !['ADMIN', 'MANAGER'].includes(token.role as string)) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Tenant-based access control
    if (token.tenantId && req.headers.get('x-tenant-id') !== token.tenantId) {
      return NextResponse.redirect(new URL('/auth/error', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public routes that don't require authentication
        const publicRoutes = [
          '/auth/signin',
          '/auth/signup',
          '/auth/error',
          '/auth/verify-request',
          '/auth/forgot-password',
          '/auth/reset-password',
          '/api/auth',
          '/api/health',
          '/_next',
          '/favicon.ico',
        ]

        const { pathname } = req.nextUrl

        // Check if the path is public
        if (publicRoutes.some(route => pathname.startsWith(route))) {
          return true
        }

        // All other routes require authentication
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
