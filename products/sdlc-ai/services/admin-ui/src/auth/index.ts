import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * Server-side session helper.
 * Wraps getServerSession with configured auth options.
 */
export async function auth() {
  return getServerSession(authOptions)
}

export { authOptions }
