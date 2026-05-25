import { MCPManifest, AuthMode } from '../types/database';

export function generateWorkerCode(manifest: MCPManifest, authMode: AuthMode): string {
  const toolHandlers = manifest.tools.map(tool => `
async function ${tool.name}(env: Env, args: any) {
  const url = new URL(env.API_BASE);
  // TODO: Implement actual endpoint mapping

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  ${authMode === 'api_key' ? "headers['Authorization'] = `Bearer ${env.API_KEY}`;" : ''}
  ${authMode === 'jwt' ? "headers['Authorization'] = `Bearer ${env.JWT_TOKEN}`;" : ''}

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
    });

    if (!res.ok) {
      throw new Error(\`API error: \${res.status}\`);
    }

    return await res.json();
  } catch (error) {
    throw new Error(\`Request failed: \${(error as Error).message}\`);
  }
}`).join('\n');

  return `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface Env {
  API_BASE: string;
  ${authMode === 'api_key' ? 'API_KEY: string;' : ''}
  ${authMode === 'oauth_client' ? 'OAUTH_CLIENT_ID: string;\n  OAUTH_CLIENT_SECRET: string;' : ''}
  ${authMode === 'jwt' ? 'JWT_TOKEN: string;' : ''}
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

${toolHandlers}

const toolMap: Record<string, (env: Env, args: any) => Promise<any>> = {
${manifest.tools.map(tool => `  '${tool.name}': ${tool.name}`).join(',\n')}
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { tool, args } = await req.json();

    const handler = toolMap[tool];
    if (!handler) {
      return new Response(
        JSON.stringify({ error: 'Tool not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const env = {
      API_BASE: Deno.env.get('API_BASE') || '',
      ${authMode === 'api_key' ? "API_KEY: Deno.env.get('API_KEY') || ''," : ''}
      ${authMode === 'jwt' ? "JWT_TOKEN: Deno.env.get('JWT_TOKEN') || ''," : ''}
    } as Env;

    const result = await handler(env, args);

    return new Response(
      JSON.stringify({ result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
`;
}
