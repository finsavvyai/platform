export const authConfig = {
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  session: {
    strategy: 'jwt' as const,
  },
  callbacks: {
    authorized: ({ auth, request: { nextUrl } }) => {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnAuth = nextUrl.pathname.startsWith('/auth')

      if (isOnAuth) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', nextUrl))
        }
        return true
      }

      if (!isLoggedIn && !isOnAuth) {
        return false
      }

      if (isLoggedIn && !isOnDashboard) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }

      return true
    },
  },
}
