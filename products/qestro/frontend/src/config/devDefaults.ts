/**
 * Local defaults when VITE_API_URL / VITE_WS_URL are unset.
 * Matches `npm --prefix backend run dev` (wrangler --port 8000).
 */
export const LOCAL_API_ORIGIN = 'http://localhost:8000';
export const LOCAL_WS_ORIGIN = 'ws://localhost:8000';
