import type { Env, JwtPayload } from "./types";
import { timingSafeEqual } from "./crypto-utils";

const encoder = new TextEncoder();

type AuthProvider = "github" | "gitlab" | "google" | "linkedin" | "facebook" | "bitbucket" | "microsoft";
type OAuthUser = {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  provider: AuthProvider;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getAppUrl(env: Env): string {
  return env.APP_URL || "https://app.pushci.dev";
}

function getGitLabBaseUrl(env: Env): string {
  return (env.GITLAB_BASE_URL || "https://gitlab.com").replace(/\/+$/, "");
}

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
  if (!timingSafeEqual(expected, parts[2])) return null;
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload as JwtPayload;
}

async function issueSession(
  user: OAuthUser,
  jwtSecret: string
): Promise<{
  token: string;
  user: OAuthUser;
}> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = await createJwt(
    { sub: `${user.provider}:${user.id}`, login: user.login, provider: user.provider, iat: now, exp: now + 604800 },
    jwtSecret
  );
  return { token: jwt, user };
}

export async function githubOAuth(
  code: string,
  env: Env
): Promise<{
  token: string;
  user: OAuthUser;
  providerToken: string;
}> {
  const clientId = requireEnv("GITHUB_CLIENT_ID", env.GITHUB_CLIENT_ID);
  const clientSecret = requireEnv("GITHUB_CLIENT_SECRET", env.GITHUB_CLIENT_SECRET);
  const jwtSecret = requireEnv("JWT_SECRET", env.JWT_SECRET);
  const redirectUri = `${getAppUrl(env)}/auth/callback`;

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "GitHub token exchange failed");
  }
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "PushCI",
    },
  });
  const user = (await userRes.json()) as {
    login: string;
    id: number;
    avatar_url?: string;
    name?: string | null;
    message?: string;
  };
  if (!userRes.ok || !user.login || typeof user.id !== "number") {
    throw new Error(user.message ?? "GitHub user fetch failed");
  }
  const session = await issueSession(
    {
      login: user.login,
      id: user.id,
      avatar_url: user.avatar_url ?? `https://github.com/${user.login}.png`,
      name: user.name ?? user.login,
      provider: "github",
    },
    jwtSecret
  );
  return { ...session, providerToken: tokenData.access_token! };
}

export async function gitlabOAuth(
  code: string,
  env: Env
): Promise<{
  token: string;
  user: OAuthUser;
}> {
  const clientId = requireEnv("GITLAB_CLIENT_ID", env.GITLAB_CLIENT_ID);
  const clientSecret = requireEnv("GITLAB_CLIENT_SECRET", env.GITLAB_CLIENT_SECRET);
  const jwtSecret = requireEnv("JWT_SECRET", env.JWT_SECRET);
  const baseUrl = getGitLabBaseUrl(env);
  const redirectUri = `${getAppUrl(env)}/auth/callback`;

  const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    error_description_base?: string[];
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    const description = Array.isArray(tokenData.error_description_base)
      ? tokenData.error_description_base.join(", ")
      : tokenData.error_description;
    throw new Error(description ?? tokenData.error ?? "GitLab token exchange failed");
  }

  const userRes = await fetch(`${baseUrl}/api/v4/user`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = (await userRes.json()) as {
    username: string;
    id: number;
    avatar_url?: string | null;
    name?: string | null;
    message?: string;
    error?: string;
  };
  if (!userRes.ok || !user.username || typeof user.id !== "number") {
    throw new Error(user.message ?? user.error ?? "GitLab user fetch failed");
  }

  return issueSession(
    {
      login: user.username,
      id: user.id,
      avatar_url: user.avatar_url ?? "",
      name: user.name ?? user.username,
      provider: "gitlab",
    },
    jwtSecret
  );
}

export async function googleOAuth(
  code: string,
  env: Env
): Promise<{ token: string; user: OAuthUser }> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID);
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET);
  const jwtSecret = requireEnv("JWT_SECRET", env.JWT_SECRET);
  const redirectUri = `${getAppUrl(env)}/auth/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "Google token exchange failed");
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = (await userRes.json()) as {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    error?: { message?: string };
  };
  if (!userRes.ok || !user.id) {
    throw new Error(user.error?.message ?? "Google user fetch failed");
  }

  return issueSession(
    {
      login: user.email,
      id: parseInt(user.id.slice(-9), 10) || Math.floor(Math.random() * 1e9),
      avatar_url: user.picture ?? "",
      name: user.name ?? user.email,
      provider: "google",
    },
    jwtSecret
  );
}

export async function linkedinOAuth(
  code: string,
  env: Env
): Promise<{ token: string; user: OAuthUser }> {
  const clientId = requireEnv("LINKEDIN_CLIENT_ID", env.LINKEDIN_CLIENT_ID);
  const clientSecret = requireEnv("LINKEDIN_CLIENT_SECRET", env.LINKEDIN_CLIENT_SECRET);
  const jwtSecret = requireEnv("JWT_SECRET", env.JWT_SECRET);
  const redirectUri = `${getAppUrl(env)}/auth/callback`;

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "LinkedIn token exchange failed");
  }

  const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = (await userRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
    error?: string;
  };
  if (!userRes.ok || !user.sub) {
    throw new Error(user.error ?? "LinkedIn user fetch failed");
  }

  return issueSession(
    {
      login: user.email ?? user.sub,
      id: parseInt(user.sub.replace(/\D/g, "").slice(-9), 10) || Math.floor(Math.random() * 1e9),
      avatar_url: user.picture ?? "",
      name: user.name ?? user.email ?? user.sub,
      provider: "linkedin",
    },
    jwtSecret
  );
}

export async function facebookOAuth(
  code: string,
  env: Env
): Promise<{ token: string; user: OAuthUser }> {
  const clientId = requireEnv("FACEBOOK_CLIENT_ID", env.FACEBOOK_CLIENT_ID);
  const clientSecret = requireEnv("FACEBOOK_CLIENT_SECRET", env.FACEBOOK_CLIENT_SECRET);
  const jwtSecret = requireEnv("JWT_SECRET", env.JWT_SECRET);
  const redirectUri = `${getAppUrl(env)}/auth/callback`;

  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("client_secret", clientSecret);
  tokenUrl.searchParams.set("code", code);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error?.message ?? "Facebook token exchange failed");
  }

  const userRes = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`
  );
  const user = (await userRes.json()) as {
    id: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
    error?: { message?: string };
  };
  if (!userRes.ok || !user.id) {
    throw new Error(user.error?.message ?? "Facebook user fetch failed");
  }

  return issueSession(
    {
      login: user.email ?? user.id,
      id: parseInt(user.id, 10) || Math.floor(Math.random() * 1e9),
      avatar_url: user.picture?.data?.url ?? "",
      name: user.name ?? user.email ?? user.id,
      provider: "facebook",
    },
    jwtSecret
  );
}

export async function bitbucketOAuth(
  code: string,
  env: Env
): Promise<{ token: string; user: OAuthUser }> {
  const clientId = requireEnv("BITBUCKET_CLIENT_ID", env.BITBUCKET_CLIENT_ID);
  const clientSecret = requireEnv("BITBUCKET_CLIENT_SECRET", env.BITBUCKET_CLIENT_SECRET);
  const jwtSecret = requireEnv("JWT_SECRET", env.JWT_SECRET);
  const redirectUri = `${getAppUrl(env)}/auth/callback`;

  const tokenRes = await fetch("https://bitbucket.org/site/oauth2/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "Bitbucket token exchange failed");
  }

  const userRes = await fetch("https://api.bitbucket.org/2.0/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = (await userRes.json()) as {
    username?: string;
    display_name?: string;
    nickname?: string;
    uuid: string;
    links?: { avatar?: { href?: string } };
    error?: { message?: string };
  };
  if (!userRes.ok || !user.uuid) {
    throw new Error(user.error?.message ?? "Bitbucket user fetch failed");
  }

  const login = user.username ?? user.nickname ?? user.uuid;
  const numericId = parseInt(user.uuid.replace(/[^0-9]/g, "").slice(-9), 10) || Math.floor(Math.random() * 1e9);

  return issueSession(
    {
      login,
      id: numericId,
      avatar_url: user.links?.avatar?.href ?? "",
      name: user.display_name ?? login,
      provider: "bitbucket",
    },
    jwtSecret
  );
}

export async function microsoftOAuth(
  code: string,
  env: Env
): Promise<{ token: string; user: OAuthUser }> {
  const clientId = requireEnv("MICROSOFT_CLIENT_ID", env.MICROSOFT_CLIENT_ID);
  const clientSecret = requireEnv("MICROSOFT_CLIENT_SECRET", env.MICROSOFT_CLIENT_SECRET);
  const jwtSecret = requireEnv("JWT_SECRET", env.JWT_SECRET);
  const tenantId = env.MICROSOFT_TENANT_ID || "common";
  const redirectUri = `${getAppUrl(env)}/auth/callback`;

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      scope: "openid email profile User.Read",
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "Microsoft token exchange failed");
  }

  const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = (await userRes.json()) as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
    error?: { message?: string };
  };
  if (!userRes.ok || !user.id) {
    throw new Error(user.error?.message ?? "Microsoft user fetch failed");
  }

  const login = user.mail ?? user.userPrincipalName ?? user.id;

  return issueSession(
    {
      login,
      id: parseInt(user.id.replace(/[^0-9]/g, "").slice(-9), 10) || Math.floor(Math.random() * 1e9),
      avatar_url: "",
      name: user.displayName ?? login,
      provider: "microsoft",
    },
    jwtSecret
  );
}
