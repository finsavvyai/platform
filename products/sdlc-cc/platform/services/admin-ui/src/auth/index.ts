import { getServerSession } from 'next-auth'
import { authOptions } from './auth-config'

export async function auth() {
  return getServerSession(authOptions)
}

export { authOptions }
