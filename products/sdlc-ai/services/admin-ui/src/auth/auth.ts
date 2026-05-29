import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Gateway API configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8080'
import { apiClient } from '@/lib/api-client'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

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
        token.id = user.id
        token.role = user.role
        token.permissions = user.permissions
        token.tenantId = user.tenantId
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.expiresAt = user.expiresAt
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
            // Refresh failed - return invalid token
            return null
          }
        } catch (error) {
          console.error('Token refresh error:', error)
          return null
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
    async signIn({ user, account }) {
      if (account?.provider === 'credentials') {
        return true
      }

      // OAuth providers are allowed through
      if (account?.provider === 'google' || account?.provider === 'github') {
        return true
      }

      return false
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser && account?.provider !== 'credentials') {
        // Log new OAuth user creation
        console.log(`New user created via ${account.provider}:`, user.email)
      }
    },
  },
}
