import type { Context, Next } from 'hono';

export interface CorsConfig {
  origins: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

export function createCors(config: CorsConfig) {
  const {
    origins,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = true,
  } = config;

  return async (c: Context, next: Next) => {
    const origin = c.req.header('origin');
    const isAllowed = !origin || origins.includes(origin) ||
      origins.includes('*');

    if (c.req.method === 'OPTIONS') {
      if (!isAllowed) {
        return c.text('Forbidden', 403);
      }

      c.header('Access-Control-Allow-Origin', origin || origins[0]);
      c.header('Access-Control-Allow-Methods', methods.join(', '));
      c.header('Access-Control-Allow-Headers', headers.join(', '));
      if (credentials) {
        c.header('Access-Control-Allow-Credentials', 'true');
      }
      return new Response(null, { status: 204 });
    }

    if (isAllowed) {
      c.header('Access-Control-Allow-Origin', origin || origins[0]);
      if (credentials) {
        c.header('Access-Control-Allow-Credentials', 'true');
      }
    }

    return next();
  };
}
