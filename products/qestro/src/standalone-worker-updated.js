/**
 * Standalone Questro Worker with R2 File Storage
 *
 * Complete Cloudflare Worker for production deployment
 * Includes D1 database, KV storage, and R2 file operations
 */

// Placeholder Durable Objects (exported for compatibility)
export class CollaborationDO {
  constructor(state, env) {}
  async fetch(request) {
    return new Response("Collaboration DO coming soon");
  }
}

export class SessionDO {
  constructor(state, env) {}
  async fetch(request) {
    return new Response("Session DO coming soon");
  }
}

export class TestExecutionDO {
  constructor(state, env) {}
  async fetch(request) {
    return new Response("Test Execution DO coming soon");
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Add CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-ID, X-Source, X-Filename, X-Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || "development",
        version: "1.0.0",
        database: env.DB ? "connected" : "not configured",
        services: {
          database: env.DB ? "D1 SQLite" : "not configured",
          sessions: env.SESSIONS ? "KV Storage" : "not configured",
          cache: env.CACHE ? "KV Storage" : "not configured",
          artifacts: env.ARTIFACTS ? "R2 Bucket" : "not configured",
          media: env.MEDIA ? "R2 Bucket" : "not configured",
          backups: env.BACKUPS ? "R2 Bucket" : "not configured"
        }
      }, { headers: corsHeaders });
    }

    // API root
    if (url.pathname === "/api" || url.pathname === "/api/") {
      // Test database connection
      let dbStatus = "not configured";
      let tableCount = 0;

      try {
        if (env.DB) {
          const result = await env.DB.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type=\'table\'').first();
          tableCount = result?.count || 0;
          dbStatus = `connected (${tableCount} tables)`;
        }
      } catch (error) {
        dbStatus = "connection error";
        console.error("Database connection error:", error);
      }

      return Response.json({
        message: "Questro API - Workers deployed successfully!",
        status: "operational",
        database: dbStatus,
        tableCount,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: "/health",
          auth: "/api/v1/auth (coming soon)",
          projects: "/api/v1/projects (coming soon)",
          analytics: "/api/v1/analytics (coming soon)",
          ai: "/api/v1/ai (coming soon)",
          files: "/api/files/{bucket}/{path} (R2 Storage)"
        },
        environment: {
          name: env.ENVIRONMENT || "development",
          platform: "Cloudflare Workers",
          database: "Cloudflare D1 SQLite",
          storage: "Cloudflare R2 + KV"
        }
      }, { headers: corsHeaders });
    }

    // API version info
    if (url.pathname === "/api/v1" || url.pathname === "/api/v1/") {
      return Response.json({
        title: "Questro API v1.0.0",
        description: "AI-Powered Testing Platform",
        status: "deployment-ready",
        endpoints: {
          auth: "/api/v1/auth",
          projects: "/api/v1/projects",
          testExecution: "/api/v1/test-execution",
          billing: "/api/v1/billing",
          analytics: "/api/v1/analytics",
          ai: "/api/v1/ai",
          files: "/api/v1/files"
        },
        documentation: "https://docs.qestro.io",
        database: env.DB ? "D1 SQLite operational" : "D1 not configured",
        storage: env.ARTIFACTS ? "R2 Storage operational" : "R2 not configured"
      }, { headers: corsHeaders });
    }

    // Test database tables endpoint
    if (url.pathname === "/api/debug/tables") {
      if (!env.DB) {
        return Response.json({ error: "Database not configured" }, 404, { headers: corsHeaders });
      }

      try {
        const tables = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        ).all();
        return Response.json({
          tables: tables.results || [],
          count: tables.results?.length || 0,
          database: "D1 SQLite",
        }, { headers: corsHeaders });
      } catch (error) {
        return Response.json(
          { error: "Failed to fetch tables", details: error.message },
          500,
          { headers: corsHeaders },
        );
      }
    }

    // Test KV storage endpoint
    if (url.pathname === "/api/debug/kv") {
      try {
        // Test writing to KV
        const testKey = `test-${Date.now()}`;
        await env.SESSIONS.put(testKey, "Hello from Questro Worker!", {
          expirationTtl: 60,
        });

        // Test reading from KV
        const value = await env.SESSIONS.get(testKey);

        return Response.json({
          kv: "operational",
          test: {
            key: testKey,
            value: value,
            success: value === "Hello from Questro Worker!",
          },
          namespaces: {
            sessions: env.SESSIONS ? "available" : "not configured",
            cache: env.CACHE ? "available" : "not configured",
            realtime: env.REALTIME ? "available" : "not configured",
          },
          r2: {
            artifacts: env.ARTIFACTS ? "available" : "not configured",
            media: env.MEDIA ? "available" : "not configured",
            backups: env.BACKUPS ? "available" : "not configured"
          }
        }, { headers: corsHeaders });
      } catch (error) {
        return Response.json(
          { error: "KV test failed", details: error.message },
          500,
          { headers: corsHeaders },
        );
      }
    }

    // File upload and serving from R2
    if (url.pathname.startsWith("/api/files/")) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const bucket = pathParts[2]?.toUpperCase(); // /api/files/{bucket}/{path}
      const filePath = pathParts.slice(3).join("/"); // Remaining path

      if (!bucket || !filePath) {
        return Response.json({ error: "Invalid file path" }, 400, { headers: corsHeaders });
      }

      const validBuckets = ["ARTIFACTS", "MEDIA", "BACKUPS"];
      if (!validBuckets.includes(bucket)) {
        return Response.json({ error: "Invalid bucket" }, 400, { headers: corsHeaders });
      }

      try {
        const bucketMap = {
          "ARTIFACTS": env.ARTIFACTS,
          "MEDIA": env.MEDIA,
          "BACKUPS": env.BACKUPS
        };

        const r2Bucket = bucketMap[bucket];
        if (!r2Bucket) {
          return Response.json({ error: "Bucket not configured" }, 404, { headers: corsHeaders });
        }

        // Handle POST requests for file uploads
        if (request.method === "POST") {
          const contentType = request.headers.get("content-type") || "";

          if (contentType.includes("multipart/form-data")) {
            // Handle multipart form upload
            const formData = await request.formData();
            const file = formData.get("file");

            if (!file) {
              return Response.json({ error: "No file provided in request" }, 400, { headers: corsHeaders });
            }

            // Generate unique filename
            const timestamp = new Date().toISOString().split("T")[0].replace(/-/g, "");
            const filename = `${timestamp}/${Date.now()}-${file.name}`;

            const object = await r2Bucket.put(filename, file.stream(), {
              contentType: file.type,
              customMetadata: {
                originalName: file.name,
                size: file.size.toString(),
                uploadedAt: new Date().toISOString(),
                uploadedBy: request.headers.get("X-User-ID") || "anonymous",
                source: request.headers.get("X-Source") || "api"
              }
            });

            return Response.json({
              success: true,
              file: {
                key: filename,
                url: `https://qestro.broad-dew-49ad.workers.dev/api/files/${bucket.toLowerCase()}/${filename}`,
                size: file.size
              },
              message: "File uploaded successfully"
            }, { headers: corsHeaders });
          } else {
            // Handle direct binary upload
            const arrayBuffer = await request.arrayBuffer();
            const filename = request.headers.get("X-Filename") || `upload-${Date.now()}`;
            const fileType = request.headers.get("X-Content-Type") || "application/octet-stream";

            const object = await r2Bucket.put(filename, arrayBuffer, {
              contentType: fileType,
              customMetadata: {
                uploadedAt: new Date().toISOString(),
                source: "api"
              }
            });

            return Response.json({
              success: true,
              file: {
                key: filename,
                url: `https://qestro.broad-dew-49ad.workers.dev/api/files/${bucket.toLowerCase()}/${filename}`
              },
              message: "File uploaded successfully"
            }, { headers: corsHeaders });
          }
        }

        // Handle GET requests for file downloads
        if (request.method === "GET") {
          const object = await r2Bucket.get(filePath);

          if (!object) {
            return Response.json({ error: "File not found" }, 404, { headers: corsHeaders });
          }

          const headers = new Headers(corsHeaders);
          headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
          headers.set("Content-Length", object.size.toString());
          headers.set("Cache-Control", "public, max-age=3600");

          return new Response(object.body, { headers });
        }

        // Handle DELETE requests for file deletion
        if (request.method === "DELETE") {
          await r2Bucket.delete(filePath);
          return Response.json({
            success: true,
            message: "File deleted successfully"
          }, { headers: corsHeaders });
        }

        // Method not allowed
        return Response.json({ error: "Method not allowed" }, 405, { headers: corsHeaders });
      } catch (error) {
        console.error("R2 operation error:", error);
        return Response.json({
          error: "R2 operation failed",
          details: error.message
        }, 500, { headers: corsHeaders });
      }
    }

    // Default response
    return Response.json({
      message: "Questro Platform - Cloudflare Workers",
      status: "operational",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      availableEndpoints: {
        health: "/health",
        api: "/api",
        apiV1: "/api/v1",
        debugTables: "/api/debug/tables",
        debugKV: "/api/debug/kv",
        files: "/api/files/{bucket}/{path}"
      },
      configuration: {
        database: env.DB ? "D1 SQLite configured" : "D1 not configured",
        kv: env.SESSIONS ? "KV Storage configured" : "KV not configured",
        r2: {
          artifacts: env.ARTIFACTS ? "configured" : "not configured",
          media: env.MEDIA ? "configured" : "not configured",
          backups: env.BACKUPS ? "configured" : "not configured"
        }
      }
    }, { headers: corsHeaders });
  },
};
