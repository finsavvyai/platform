export async function safeJson<T = any>(req: Request): Promise<T> {
  const text = await req.text();
  if (!text) return {} as T;
  return JSON.parse(text);
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function notFound(): Response {
  return json({ error: "Not found" }, { status: 404 });
}
