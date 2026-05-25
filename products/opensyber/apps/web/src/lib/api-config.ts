/**
 * API base URL — different for server vs client contexts.
 *
 * Server-side (SSR): uses API_URL (workers.dev for CF worker-to-worker routing)
 * Client-side (browser): uses NEXT_PUBLIC_API_URL (branded domain)
 */
const isServer = typeof window === 'undefined';

export const API_BASE_URL = isServer
  ? (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'https://api.opensyber.cloud')
  : (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.opensyber.cloud');
