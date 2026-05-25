import type { Env, JwtPayload } from "./types";

const encoder = new TextEncoder();

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64url(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createJwt(
  payload: JwtPayload,
  secret: string
): Promise<string> {
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url(payload);
  const signature = await hmacSign(secret, `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expected = await hmacSign(secret, `${parts[0]}.${parts[1]}`);
  if (expected !== parts[2]) return null;
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload as JwtPayload;
}

export async function githubOAuth(
  code: string,
  env: Env
): Promise<{ token: string; login: string; id: number }> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token: string };
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "PushCI",
    },
  });
  const user = (await userRes.json()) as { login: string; id: number };
  const now = Math.floor(Date.now() / 1000);
  const jwt = await createJwt(
    { sub: String(user.id), login: user.login, iat: now, exp: now + 86400 },
    env.JWT_SECRET
  );
  return { token: jwt, login: user.login, id: user.id };
}
