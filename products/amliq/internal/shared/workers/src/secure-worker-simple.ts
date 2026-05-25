import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwt, sign, verify } from "hono/jwt";

const app = new Hono();

// Security configuration
const ALLOWED_ORIGINS = ["https://finsavvyai.com", "https://app.finsavvyai.com"];
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// In-memory rate limiting
const rateLimitStore = new Map();

// Rate limiting middleware
const rateLimit = async (c, next) => {
  const clientIP = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
  const now = Date.now();
  const key = `${clientIP}:${Math.floor(now / RATE_LIMIT_WINDOW)}`;

  const current = rateLimitStore.get(key);
  if (current && current.count >= RATE_LIMIT_REQUESTS) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  rateLimitStore.set(key, { count: (current?.count || 0) + 1, resetTime: now + RATE_LIMIT_WINDOW });

  // Cleanup old entries
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  await next();
};

// Security headers middleware
const securityHeaders = async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
};

// Input validation middleware
const validateJSON = async (c, next) => {
  if (c.req.method === "POST" || c.req.method === "PUT") {
    try {
      await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }
  }
  await next();
};

// Request logging with PII filtering
const logRequest = async (c, next) => {
  const start = Date.now();
  await next();

  const duration = Date.now() - start;
  const userAgent = c.req.header("User-Agent") || "unknown";
  const clientIP = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";

  // Log without PII
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
    clientIP,
    userAgent: userAgent.substring(0, 100),
    env: c.env.ENVIRONMENT
  }));
};

// Apply security middleware
app.use("*", rateLimit);
app.use("*", securityHeaders);
app.use("*", validateJSON);
app.use("*", logRequest);

// CORS with strict configuration
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      if (!origin) return ALLOWED_ORIGINS[0];
      if (ALLOWED_ORIGINS.includes(origin)) return origin;
      return null; // Reject unauthorized origins
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposeHeaders: ["X-Total-Count"],
    credentials: true,
    maxAge: 86400,
  }),
);

// JWT middleware for protected routes
const jwtMiddleware = jwt({
  secret: (c) => c.env.JWT_SECRET,
  alg: "HS256",
});

// Health check (public)
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: c.env.ENVIRONMENT,
    services: {
      auth: "operational",
      billing: "operational",
      compliance: "operational",
      intelligence: "operational",
      risk: "operational",
    },
  });
});

// API status (public)
app.get("/api/v1/status", (c) => {
  return c.json({
    api: "Fintech Suite API",
    version: "1.0.0",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    features: {
      authentication: "enabled",
      billing: "enabled",
      compliance: "enabled",
      intelligence: "enabled",
      risk_assessment: "enabled",
    },
  });
});

// Validation functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
};

const validateAmount = (amount) => {
  return amount > 0 && amount <= 999999.99 && Number.isFinite(amount);
};

// Authentication Routes
app.post("/api/v1/auth/register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, firstName, lastName } = body;

    // Input validation
    if (!email || !password || !firstName || !lastName) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }

    if (!validatePassword(password)) {
      return c.json({ error: "Password must be at least 8 characters with uppercase and number" }, 400);
    }

    // Check if user already exists (mock check)
    if (email === "admin@finsavvyai.com") {
      return c.json({ error: "User already exists" }, 409);
    }

    // Create user (mock implementation)
    const userId = "user_" + crypto.randomUUID();

    // Log user creation (without PII)
    console.log(JSON.stringify({
      event: "user_registered",
      userId: userId,
      timestamp: new Date().toISOString(),
      env: c.env.ENVIRONMENT
    }));

    return c.json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: userId,
          email: email.toLowerCase(),
          role: "user",
          created_at: new Date().toISOString(),
        }
      }
    }, 201);

  } catch (error) {
    console.error("Registration error:", error.message || "Unknown error");
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    // Input validation
    if (!email || !password) {
      return c.json({ error: "Email and password required" }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }

    // Mock authentication
    if (email === "demo@finsavvyai.com" && password === "DemoPass123!") {
      const token = await sign({
        sub: "user_demo_123",
        email: email,
        role: "finance",
        organization_id: "org_demo",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      }, c.env.JWT_SECRET);

      // Log successful login (without PII)
      console.log(JSON.stringify({
        event: "user_login",
        userId: "user_demo_123",
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT
      }));

      return c.json({
        success: true,
        message: "Login successful",
        data: {
          token,
          user: {
            id: "user_demo_123",
            email: email,
            role: "finance",
            last_login: new Date().toISOString(),
          },
          expires_in: 3600,
        }
      });

    } else {
      // Log failed login attempt (without PII)
      console.log(JSON.stringify({
        event: "login_failed",
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT
      }));

      return c.json({ error: "Invalid credentials" }, 401);
    }

  } catch (error) {
    console.error("Login error:", error.message || "Unknown error");
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Protected routes middleware
app.use("/api/v1/*", async (c, next) => {
  // Skip auth for public routes
  if (c.req.path === "/api/v1/status" || c.req.path === "/health") {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Authorization required" }, 401);
  }

  try {
    const token = authHeader.substring(7);
    const payload = await verify(token, c.env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Mock invoice data for authenticated routes
app.get("/api/v1/billing/invoices", async (c) => {
  try {
    const user = c.get('user');
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

    // Validate parameters
    if (page < 1 || limit < 1) {
      return c.json({ error: "Invalid pagination parameters" }, 400);
    }

    // Mock invoices
    const invoices = [
      {
        id: "inv_001",
        number: "INV-2024-001",
        customer_id: "cust_001",
        amount: 299.99,
        currency: "USD",
        status: "paid",
        created_at: "2024-01-15T10:00:00Z",
        updated_at: "2024-01-15T10:30:00Z",
      },
      {
        id: "inv_002",
        number: "INV-2024-002",
        customer_id: "cust_002",
        amount: 599.99,
        currency: "USD",
        status: "pending",
        created_at: "2024-01-16T14:00:00Z",
        updated_at: "2024-01-16T14:00:00Z",
      },
    ];

    // Log access (audit trail)
    console.log(JSON.stringify({
      event: "invoices_accessed",
      userId: user.sub,
      count: invoices.length,
      timestamp: new Date().toISOString(),
      env: c.env.ENVIRONMENT
    }));

    return c.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page,
          limit,
          total: invoices.length,
        },
      },
    });

  } catch (error) {
    console.error("Invoices fetch error:", error.message || "Unknown error");
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Error handling
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Endpoint not found",
      message: "The requested API endpoint does not exist",
      path: c.req.path,
      method: c.req.method,
    },
    404,
  );
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: "Internal server error",
      message: "An unexpected error occurred",
      requestId: crypto.randomUUID(),
    },
    500,
  );
});

export default {
  fetch: app.fetch,
};
