"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export interface User {
  id: string
  email?: string
  name?: string
  avatar_url?: string
}

export interface AuthContextType {
  user: User | null
  session: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on mount
    const checkAuth = () => {
      const storedSession = localStorage.getItem('mcpoverflow_session')
      const storedUser = localStorage.getItem('mcpoverflow_user')

      if (storedSession && storedUser) {
        try {
          setSession(storedSession)
          setUser(JSON.parse(storedUser))
        } catch (error) {
          console.error('Failed to parse stored user data:', error)
          localStorage.removeItem('mcpoverflow_session')
          localStorage.removeItem('mcpoverflow_user')
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const signIn = async (email: string, _password: string) => {
    setIsLoading(true)
    try {
      // Mock authentication - replace with actual auth logic
      const mockUser: User = {
        id: 'user-' + Date.now(),
        email: email,
        name: email.split('@')[0]
      }
      const mockSession = 'session-' + Date.now()

      setUser(mockUser)
      setSession(mockSession)
      localStorage.setItem('mcpoverflow_session', mockSession)
      localStorage.setItem('mcpoverflow_user', JSON.stringify(mockUser))
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (email: string, _password: string, name: string) => {
    setIsLoading(true)
    try {
      // Mock sign up - replace with actual auth logic
      const mockUser: User = {
        id: 'user-' + Date.now(),
        email: email,
        name: name
      }
      const mockSession = 'session-' + Date.now()

      setUser(mockUser)
      setSession(mockSession)
      localStorage.setItem('mcpoverflow_session', mockSession)
      localStorage.setItem('mcpoverflow_user', JSON.stringify(mockUser))
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    try {
      setUser(null)
      setSession(null)
      localStorage.removeItem('mcpoverflow_session')
      localStorage.removeItem('mcpoverflow_user')
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    // Mock password reset - replace with actual logic
    console.log('Password reset requested for:', email)
  }

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}