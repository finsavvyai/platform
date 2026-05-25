import type { NextAuthConfig } from 'next-auth'

export const authConfig = {
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  session: { strategy: 'jwt' as const },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith('/auth')
      const protectedPaths = ['/dashboard', '/settings', '/users']
      const isProtected = protectedPaths.some((p) =>
        nextUrl.pathname.startsWith(p),
      )

      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }

      if (isProtected && !isLoggedIn) {
        const redirectUrl = new URL('/auth/signin', nextUrl)
        redirectUrl.searchParams.set('callbackUrl', nextUrl.pathname)
        return Response.redirect(redirectUrl)
      }

      return true
    },
  },
} satisfies NextAuthConfig
