/**
 * Simple Worker Build Script
 * Copies the worker file to dist directory
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

// Create dist directory if it doesn't exist
if (!existsSync("./dist")) {
  mkdirSync("./dist", { recursive: true });
}

// Read the simple worker file
const workerContent = readFileSync("./src/worker-simple.ts", "utf-8");

// Simple Worker content (inline to avoid dependencies)
const simpleWorker = `
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'development',
        version: '1.0.0',
        database: env.DB ? 'connected' : 'not configured'
      });
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      // Test database connection
      let dbStatus = 'not configured';
      try {
        if (env.DB) {
          const result = await env.DB.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type=\\'table\\'').first();
          dbStatus = \`connected (\${result.count} tables)\`;
        }
      } catch (error) {
        dbStatus = 'error';
      }

      return Response.json({
        message: 'Questro API - Workers deployed successfully!',
        database: dbStatus,
        timestamp: new Date().toISOString(),
        endpoints: {
          auth: '/api/v1/auth',
          projects: '/api/v1/projects',
          health: '/health'
        }
      });
    }

    // Default response
    return Response.json({
      message: 'Questro Platform - Cloudflare Workers',
      status: 'operational',
      endpoints: {
        health: '/health',
        api: '/api/v1'
      },
      database: env.DB ? 'configured' : 'not configured'
    });
  }
};
`;

// Convert TypeScript to JavaScript (basic conversion)
const jsContent = workerContent
  .replace(/export default\s*{/, "export default {")
  .replace(/:\s*string/g, "")
  .replace(/:\s*Request/g, "")
  .replace(/:\s*Response/g, "")
  .replace(/:\s*any/g, "")
  .replace(/:\s*ExecutionContext/g, "");

// Read and copy the worker with mobile testing support
const standaloneWorker = readFileSync(
  "./src/standalone-worker-mobile.js",
  "utf-8",
);
writeFileSync("./dist/worker.js", standaloneWorker);

console.log(
  "✅ Complete worker with mobile testing support built successfully!",
);
console.log("🔐 Features: JWT authentication, Projects API, Analytics API");
console.log(
  "📱 Mobile Testing: iOS/Android device management and test execution",
);
console.log("🌐 Real-time: WebSocket communication for collaboration");
console.log("💾 Storage: R2 file storage with KV caching");
console.log("🗄️ Database: D1 SQLite with comprehensive schema");
console.log("🚀 Ready for deployment with: wrangler deploy");
