import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { z } from 'zod'
import { apiClient } from '@/lib/api-client'

// Validation schemas
const credentialsSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// User session interface
export interface UserSession {
  id: string
  email: string
  name?: string | null
  image?: string | null
  role: string
  permissions: string[]
  tenantId: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

// Custom JWT interface
declare module 'next-auth' {
  interface Session {
    user: UserSession
    accessToken?: string
    error?: string
  }

  interface User {
    role?: string
    permissions?: string[]
    tenantId?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    permissions?: string[]
    tenantId?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 15 * 60, // 15 minutes
    updateAge: 5 * 60, // Update token every 5 minutes
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'email@example.com' },
        password: { label: 'Password', type: 'password' },
        tenantId: { label: 'Tenant ID', type: 'text', placeholder: 'Optional' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        // Validate credentials format
        const validation = credentialsSchema.safeParse(credentials)
        if (!validation.success) {
          throw new Error('Invalid email or password format')
        }

        try {
          // Call Gateway service for authentication
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': credentials.tenantId || 'default',
            },
            body: JSON.stringify({
              email: validation.data.email,
              password: validation.data.password,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.message || 'Authentication failed')
          }

          // Return user object for JWT callback
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            image: data.user.image,
            role: data.user.role,
            permissions: data.user.permissions || [],
            tenantId: data.user.tenantId,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresAt: Math.floor(Date.now() / 1000) + (data.expiresIn || 900), // Default 15 minutes
          }
        } catch (error) {
          console.error('Authentication error:', error)
          if (error instanceof Error) {
            throw new Error(error.message)
          }
          throw new Error('Authentication service unavailable')
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    // JWT callback - called whenever a JWT is created or updated
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user && account) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
        token.role = user.role ?? undefined
        token.permissions = user.permissions ? [...user.permissions] : undefined
        token.tenantId = user.tenantId ?? undefined
        token.accessToken = user.accessToken ?? undefined
        token.refreshToken = user.refreshToken ?? undefined
        token.expiresAt = user.expiresAt ?? undefined

        return token
      }

      // Return previous token if it's still valid
      if (Date.now() < (token.expiresAt as number) * 1000) {
        return token
      }

      // Token expired - try to refresh it
      if (token.refreshToken) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-ID': token.tenantId as string || 'default',
            },
            body: JSON.stringify({
              refreshToken: token.refreshToken,
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error('Failed to refresh token')
          }

          return {
            ...token,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || token.refreshToken,
            expiresAt: Math.floor(Date.now() / 1000) + (data.expiresIn || 900),
          }
        } catch (error) {
          console.error('Token refresh error:', error)
          // Return error to trigger sign out
          return { ...token, error: 'RefreshTokenError' }
        }
      }

      return { ...token, error: 'RefreshTokenError' }
    },

    // Session callback - called whenever a session is accessed
    async session({ session, token }) {
      if (token.error) {
        session.error = token.error as string
        return session
      }

      if (token) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string | null,
          image: token.picture as string | null,
          role: token.role as string,
          permissions: token.permissions as string[],
          tenantId: token.tenantId as string,
          accessToken: token.accessToken as string,
          refreshToken: token.refreshToken as string,
          expiresAt: token.expiresAt as number,
        }
        session.accessToken = token.accessToken as string
      }

      return session
    },

    // Sign in callback for OAuth providers
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') {
        return true
      }

      // For OAuth providers, we need to create or update user in our system
      if (account?.provider === 'google' || account?.provider === 'github') {
        try {
          // Exchange OAuth code for access token with our backend
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/oauth/${account.provider}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: account.access_token || account.id_token,
              // Send additional OAuth data
            }),
          })

          const data = await response.json()

          if (!response.ok) {
            console.error('OAuth sign in error:', data.message)
            return false
          }

          // Attach backend user data to the user object
          user.id = data.user.id
          user.role = data.user.role
          user.permissions = data.user.permissions || []
          user.tenantId = data.user.tenantId
          ;(user as any).accessToken = data.accessToken
          ;(user as any).refreshToken = data.refreshToken
          ;(user as any).expiresAt = Math.floor(Date.now() / 1000) + (data.expiresIn || 900)

          return true
        } catch (error) {
          console.error('OAuth sign in error:', error)
          return false
        }
      }

      return false
    },

    // Redirect callback
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url
      }
      // Default to dashboard
      return `${baseUrl}/dashboard`
    },
  },

  // Custom pages
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },

  // Events
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User signed in: ${user.email} via ${account?.provider}`)

      // You can add logging or analytics here
      if (isNewUser) {
        console.log(`New user created: ${user.email}`)
      }
    },

    async signOut({ session }) {
      console.log(`User signed out: ${session?.user?.email}`)

      // Call backend to invalidate token if needed
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.accessToken}`,
            'X-Tenant-ID': session?.user?.tenantId || 'default',
          },
        })
      } catch (error) {
        console.error('Logout error:', error)
      }
    },

    async createUser({ user }) {
      console.log('New user created:', user?.email)
    },
  },

  // Enable debug messages in development
  debug: process.env.NODE_ENV === 'development',
}

export default authOptions
