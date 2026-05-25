import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Supabase client
const mockSupabaseAuth = {
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  resend: vi.fn(),
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: mockSupabaseAuth,
  },
}))

// Export mock for use in tests
export { mockSupabaseAuth }

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    hash: '',
    origin: 'http://localhost:5173',
  },
  writable: true,
})
