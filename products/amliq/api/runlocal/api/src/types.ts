export type RunStatus = "pending" | "running" | "passed" | "failed" | "cancelled";
export type Platform = "github" | "gitlab" | "bitbucket";
export type EventType = "push" | "pull_request";

export interface Run {
  id: string;
  repo: string;
  branch: string;
  sha: string;
  status: RunStatus;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  checks_json: string | null;
}

export interface Project {
  id: string;
  repo: string;
  platform: Platform;
  created_at: string;
  webhook_secret: string;
}

export interface WebhookEvent {
  platform: Platform;
  event_type: EventType;
  repo: string;
  branch: string;
  sha: string;
  sender: string;
}

export interface Env {
  DB: D1Database;
  RUNNERS: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

export interface JwtPayload {
  sub: string;
  login: string;
  iat: number;
  exp: number;
}
