import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Gateway API configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080'
import { apiClient } from '@/lib/api-client'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

type PrismaUserModel = {
  findUnique: (args: { where: { email: string } }) => Promise<{ status?: string } | null>
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>
}

const prismaClient = prisma as { user: PrismaUserModel }

// Gateway service authentication
async function authenticateWithGateway(email: string, password: string) {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || 'Authentication failed')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Gateway authentication error:', error)
    throw error
  }
}

// Gateway token validation
async function validateGatewayToken(token: string) {
  try {
    const response = await fetch(`${GATEWAY_URL}/v1/auth/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Token validation error:', error)
    return null
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const validation = credentialsSchema.safeParse(credentials)
        if (!validation.success) {
          return null
        }

        try {
          // Authenticate with Gateway service
          const authResult = await authenticateWithGateway(
            validation.data.email,
            validation.data.password
          )

          // Store tokens in the user object for later use in JWT callback
          return {
            id: authResult.user.id,
            email: authResult.user.email,
            name: authResult.user.name,
            image: authResult.user.image,
            role: authResult.user.role || 'USER',
            permissions: authResult.user.permissions || [],
            tenantId: authResult.user.tenantId,
            accessToken: authResult.access_token,
            refreshToken: authResult.refresh_token,
            expiresAt: authResult.expires_at,
          }
        } catch (error) {
          console.error('Authentication error:', error)
          throw new Error(error instanceof Error ? error.message : 'Authentication failed')
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // Initial sign in - store all user data and tokens
        token.id = user.id ?? undefined
        token.role = user.role ?? undefined
        token.permissions = user.permissions ? [...user.permissions] : undefined
        token.tenantId = user.tenantId ?? undefined
        token.accessToken = user.accessToken ?? undefined
        token.refreshToken = user.refreshToken ?? undefined
        token.expiresAt = user.expiresAt ?? undefined
      }

      // Check if token needs refresh
      if (token.expiresAt && Date.now() >= token.expiresAt * 1000) {
        try {
          // Refresh token using Gateway service
          const response = await fetch(`${GATEWAY_URL}/v1/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token.refreshToken}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            token.accessToken = data.access_token
            token.refreshToken = data.refresh_token
            token.expiresAt = data.expires_at
          } else {
            // Refresh failed - return expired token with error marker
            return { ...token, error: 'RefreshTokenError' }
          }
        } catch (error) {
          console.error('Token refresh error:', error)
          return { ...token, error: 'RefreshTokenError' }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.permissions = token.permissions as string[]
        session.user.tenantId = token.tenantId as string
        session.accessToken = token.accessToken as string
      }

      return session
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') {
        return true
      }

      // For OAuth providers, check if user exists and is active
      if (account?.provider === 'google' || account?.provider === 'github') {
        const existingUser = await prismaClient.user.findUnique({
          where: { email: user.email! },
        })

        if (!existingUser) {
          // Create new user for OAuth
          await prismaClient.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              status: 'ACTIVE',
              accounts: {
                create: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  type: account.type,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  refresh_token: account.refresh_token,
                  refresh_token_expires_in: account.refresh_token_expires_in,
                  scope: account.scope,
                  token_type: account.token_type,
                  id_token: account.id_token,
                  session_state: account.session_state,
                },
              },
              roles: {
                connect: {
                  name: 'USER',
                },
              },
            },
          })
        } else if (existingUser.status !== 'ACTIVE') {
          return false
        }

        return true
      }

      return false
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser && account?.provider !== 'credentials') {
        // Log new OAuth user creation
        console.log(`New user created via ${account?.provider}:`, user.email)
      }
    },
  },
}
