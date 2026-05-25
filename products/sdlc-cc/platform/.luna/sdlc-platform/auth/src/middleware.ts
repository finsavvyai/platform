import { auth } from '@/auth'

export default auth((req) => {
  const isAuth = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/auth')
  const protectedPaths = ['/dashboard', '/settings', '/users']
  const isProtected = protectedPaths.some((p) =>
    req.nextUrl.pathname.startsWith(p),
  )

  if (isAuthPage && isAuth) {
    return Response.redirect(new URL('/dashboard', req.nextUrl))
  }

  if (isProtected && !isAuth) {
    const signInUrl = new URL('/auth/signin', req.nextUrl)
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname)
    return Response.redirect(signInUrl)
  }
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/settings/:path*',
    '/users/:path*',
    '/auth/:path*',
  ],
}
