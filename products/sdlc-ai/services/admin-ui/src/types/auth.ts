import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      permissions: string[]
      tenantId: string
    }
    accessToken?: string
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: string
    permissions: string[]
    tenantId: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    permissions: string[]
    tenantId: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
}
