import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id'
import LinkedIn from 'next-auth/providers/linkedin'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import type { Role } from '@/lib/rbac'

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

async function authenticateWithGateway(
  email: string,
  password: string,
) {
  const response = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || 'Authentication failed')
  }

  return response.json()
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'consent',
          access_type: 'offline',
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: {
        params: { scope: 'read:user user:email' },
      },
      allowDangerousEmailAccountLinking: true,
    }),
    MicrosoftEntraId({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_SECRET,
      tenantId: process.env.AUTH_MICROSOFT_TENANT_ID,
      authorization: {
        params: {
          scope: 'openid email profile User.Read',
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
    LinkedIn({
      clientId: process.env.AUTH_LINKEDIN_ID,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET,
      authorization: {
        params: { scope: 'openid profile email' },
      },
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        try {
          const result = await authenticateWithGateway(
            parsed.data.email,
            parsed.data.password,
          )
          return {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            image: result.user.image,
            role: result.user.role || 'USER',
            permissions: result.user.permissions || [],
            tenantId: result.user.tenantId,
            accessToken: result.access_token,
            refreshToken: result.refresh_token,
            expiresAt: result.expires_at,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role ?? 'USER'
        token.permissions = (user as any).permissions ?? []
        token.tenantId = (user as any).tenantId
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.expiresAt = (user as any).expiresAt
      }

      if (
        token.expiresAt &&
        Date.now() >= (token.expiresAt as number) * 1000
      ) {
        try {
          const res = await fetch(`${GATEWAY_URL}/v1/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token.refreshToken}`,
            },
          })
          if (res.ok) {
            const data = await res.json()
            token.accessToken = data.access_token
            token.refreshToken = data.refresh_token
            token.expiresAt = data.expires_at
          } else {
            return { ...token, error: 'RefreshTokenError' }
          }
        } catch {
          return { ...token, error: 'RefreshTokenError' }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.permissions = token.permissions as string[]
        session.user.tenantId = token.tenantId as string
        session.accessToken = token.accessToken as string
      }
      return session
    },
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') return true

      const oauthProviders = [
        'google',
        'github',
        'microsoft-entra-id',
        'linkedin',
      ]
      if (account && oauthProviders.includes(account.provider)) {
        if (!user.email) return false
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        })
        if (existing && (existing as any).status !== 'ACTIVE') {
          return false
        }
        return true
      }

      return false
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser && account?.provider !== 'credentials') {
        console.log(
          `New user via ${account?.provider}: ${user.email}`,
        )
      }
    },
  },
})
