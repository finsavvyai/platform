// OpenAPI 3.0 spec for the PushCI API.

import { Hono } from "hono";
import type { Env } from "./types";

type Bindings = Env;

const errorSchema = {
  type: "object" as const,
  properties: {
    error: { type: "string" as const },
    error_id: { type: "string" as const },
  },
  required: ["error"],
};

const runSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" as const, format: "uuid" },
    repo: { type: "string" as const },
    branch: { type: "string" as const },
    sha: { type: "string" as const },
    status: { type: "string" as const, enum: ["pending", "running", "passed", "failed", "cancelled"] },
    created_at: { type: "string" as const, format: "date-time" },
    started_at: { type: "string" as const, format: "date-time", nullable: true },
    finished_at: { type: "string" as const, format: "date-time", nullable: true },
    duration_ms: { type: "number" as const, nullable: true },
  },
};

const projectSchema = {
  type: "object" as const,
  properties: {
    id: { type: "string" as const, format: "uuid" },
    repo: { type: "string" as const },
    platform: { type: "string" as const, enum: ["github", "gitlab", "bitbucket"] },
    created_at: { type: "string" as const, format: "date-time" },
  },
};

const userSchema = {
  type: "object" as const,
  properties: {
    sub: { type: "string" as const },
    plan: { type: "string" as const, enum: ["free", "pro", "team"] },
    ai_usage: { type: "number" as const },
    ai_limit: { type: "number" as const },
    cloud_minutes_used: { type: "number" as const },
    cloud_minutes_limit: { type: "number" as const },
  },
};

function bearerRef() {
  return [{ BearerAuth: [] }];
}

function errResponses() {
  return {
    "401": { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    "500": { description: "Internal error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  };
}

const spec = {
  openapi: "3.0.3",
  info: {
    title: "PushCI API",
    description: "AI-native CI/CD platform API",
    version: "1.2.0",
    contact: { url: "https://pushci.dev" },
  },
  servers: [{ url: "https://api.pushci.dev", description: "Production" }],
  components: {
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: errorSchema,
      Run: runSchema,
      Project: projectSchema,
      User: userSchema,
    },
  },
  paths: {
    "/health": {
      get: {
        operationId: "healthCheck",
        summary: "Health check",
        tags: ["System"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                status: { type: "string", example: "ok" },
                timestamp: { type: "string", format: "date-time" },
              },
            } } },
          },
        },
      },
    },
    "/api/runs": {
      get: {
        operationId: "listRuns",
        summary: "List runs for the authenticated user",
        tags: ["Runs"],
        security: bearerRef(),
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "List of runs",
            content: { "application/json": { schema: {
              type: "object",
              properties: { runs: { type: "array", items: { $ref: "#/components/schemas/Run" } } },
            } } },
          },
          ...errResponses(),
        },
      },
    },
    "/api/runs/{id}": {
      get: {
        operationId: "getRun",
        summary: "Get run detail",
        tags: ["Runs"],
        security: bearerRef(),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Run detail with logs",
            content: { "application/json": { schema: {
              type: "object",
              properties: { run: { $ref: "#/components/schemas/Run" } },
            } } },
          },
          "404": { description: "Run not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          ...errResponses(),
        },
      },
    },
    "/api/runs/{id}/rerun": {
      post: {
        operationId: "rerunRun",
        summary: "Re-run a completed run",
        tags: ["Runs"],
        security: bearerRef(),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "202": {
            description: "Rerun queued",
            content: { "application/json": { schema: {
              type: "object",
              properties: { run: { $ref: "#/components/schemas/Run" }, job: { type: "object" } },
            } } },
          },
          "404": { description: "Run not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          ...errResponses(),
        },
      },
    },
    "/api/runs/{id}/cancel": {
      post: {
        operationId: "cancelRun",
        summary: "Cancel a running or queued run",
        tags: ["Runs"],
        security: bearerRef(),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Run cancelled",
            content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } },
          },
          "404": { description: "Run not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          ...errResponses(),
        },
      },
    },
    "/api/projects": {
      get: {
        operationId: "listProjects",
        summary: "List projects for the authenticated user",
        tags: ["Projects"],
        security: bearerRef(),
        responses: {
          "200": {
            description: "List of projects",
            content: { "application/json": { schema: {
              type: "object",
              properties: { projects: { type: "array", items: { $ref: "#/components/schemas/Project" } } },
            } } },
          },
          ...errResponses(),
        },
      },
    },
    "/api/auth/github": {
      post: {
        operationId: "authGithub",
        summary: "Exchange GitHub OAuth code for a session token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object",
            required: ["code"],
            properties: { code: { type: "string", description: "GitHub OAuth authorization code" } },
          } } },
        },
        responses: {
          "200": {
            description: "Session created",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                token: { type: "string" },
                user: { type: "object", properties: {
                  login: { type: "string" }, id: { type: "number" },
                  avatar_url: { type: "string" }, name: { type: "string" },
                  provider: { type: "string" },
                } },
              },
            } } },
          },
          ...errResponses(),
        },
      },
    },
    "/api/auth/gitlab": {
      post: {
        operationId: "authGitlab",
        summary: "Exchange GitLab OAuth code for a session token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object",
            required: ["code"],
            properties: { code: { type: "string" } },
          } } },
        },
        responses: {
          "200": { description: "Session created", content: { "application/json": { schema: { type: "object" } } } },
          ...errResponses(),
        },
      },
    },
    "/api/user/me": {
      get: {
        operationId: "getCurrentUser",
        summary: "Get current authenticated user profile and usage",
        tags: ["User"],
        security: bearerRef(),
        responses: {
          "200": {
            description: "User profile",
            content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
          },
          ...errResponses(),
        },
      },
    },
  },
};

export const openApiRoutes = new Hono<{ Bindings: Bindings }>();

openApiRoutes.get("/spec", (c) => {
  return c.json(spec);
});
