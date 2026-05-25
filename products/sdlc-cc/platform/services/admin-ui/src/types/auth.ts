// Re-export UserSession from auth-config for convenience
export type { UserSession } from '@/auth/auth-config'

// Note: Module augmentations for next-auth are declared in auth-config.ts
// Do not redeclare them here to avoid conflicts
