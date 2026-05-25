import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwt, sign, verify } from "hono/jwt";

interface User {
  id: string;
  email: string;
  role: "admin" | "finance" | "auditor" | "viewer" | "user";
  organization_id: string;
  created_at: string;
  last_login: string;
}

interface Invoice {
  id: string;
  number: string;
  customer_id: string;
  amount: number;
  currency: string;
  status: "draft" | "pending" | "paid" | "overdue" | "cancelled";
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  user_id: string;
  date: string;
  confidence_score?: number;
}

interface ComplianceCase {
  id: string;
  type: "kyc" | "sanctions" | "adverse_media" | "transaction_monitoring";
  status: "pending" | "in_review" | "approved" | "rejected" | "escalated";
  customer_id: string;
  assigned_to: string;
  created_at: string;
  priority: "low" | "medium" | "high" | "critical";
}

interface RiskScore {
  entity_id: string;
  entity_type: "customer" | "transaction" | "merchant";
  score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  factors: Array<{
    factor: string;
    impact: "positive" | "negative" | "neutral";
    score: number;
    description: string;
  }>;
  last_updated: string;
}

const app = new Hono<{ Bindings: Env }>();

// Security configuration - JWT secret must be provided via environment variables
const getJwtSecret = (env: Env): string => {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required for production",
    );
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
  return secret;
};
const ALLOWED_ORIGINS = [
  "https://finsavvyai.com",
  "https://app.finsavvyai.com",
  "https://api.finsavvyai.com",
  "https://billing.finsavvyai.com",
  "https://compliance.finsavvyai.com",
  "https://intelligence.finsavvyai.com",
  "https://risk.finsavvyai.com",
];
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// In-memory rate limiting (in production, use KV)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
const rateLimit = async (c: any, next: any) => {
  const clientIP =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown";
  const now = Date.now();
  const key = `${clientIP}:${Math.floor(now / RATE_LIMIT_WINDOW)}`;

  const current = rateLimitStore.get(key);
  if (current && current.count >= RATE_LIMIT_REQUESTS) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }

  rateLimitStore.set(key, {
    count: (current?.count || 0) + 1,
    resetTime: now + RATE_LIMIT_WINDOW,
  });

  // Cleanup old entries
  if (Math.random() < 0.01) {
    // 1% chance to cleanup
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  await next();
};

// Security headers middleware
const securityHeaders = async (c: any, next: any) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
  c.res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
};

// Input validation middleware
const validateJSON = async (c: any, next: any) => {
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
const logRequest = async (c: any, next: any) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const userAgent = c.req.header("User-Agent") || "unknown";
  const clientIP =
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For") ||
    "unknown";

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // Log without PII
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      method,
      path,
      status,
      duration,
      clientIP,
      userAgent: userAgent.substring(0, 100), // Truncate for security
      env: c.env.ENVIRONMENT,
    }),
  );
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

// JWT middleware for protected routes (dynamic creation)
const createJwtMiddleware = (env: Env) =>
  jwt({
    secret: getJwtSecret(env),
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
    uptime: 0, // process.uptime not available in Workers
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

// Validation schemas
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): boolean => {
  return (
    password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
  );
};

const validateAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 999999.99 && Number.isFinite(amount);
};

// Authentication Routes
app.post("/api/v1/auth/register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, firstName, lastName, organizationId } = body;

    // Input validation
    if (!email || !password || !firstName || !lastName) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!validateEmail(email)) {
      return c.json({ error: "Invalid email format" }, 400);
    }

    if (!validatePassword(password)) {
      return c.json(
        {
          error:
            "Password must be at least 8 characters with uppercase and number",
        },
        400,
      );
    }

    // Check if user already exists (in production, check database)
    // This is a mock implementation - replace with actual database query
    if (email === "admin@finsavvyai.com") {
      return c.json({ error: "User already exists" }, 409);
    }

    // Create user (in production, save to database with proper hashing)
    const userId = "user_" + crypto.randomUUID();
    const hashedPassword = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(password),
    );

    const user: User = {
      id: userId,
      email: email.toLowerCase(),
      role: "user",
      organization_id: organizationId || "default",
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };

    // Log user creation (without PII)
    console.log(
      JSON.stringify({
        event: "user_registered",
        userId: user.id,
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT,
      }),
    );

    return c.json(
      {
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
          },
        },
      },
      201,
    );
  } catch (error) {
    console.error(
      "Registration error:",
      error instanceof Error ? error.message : "Unknown error",
    );
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

    // Authenticate user (in production, verify against database)
    // Mock authentication for demo
    if (email === "demo@finsavvyai.com" && password === "DemoPass123!") {
      const user: User = {
        id: "user_demo_123",
        email: email,
        role: "finance",
        organization_id: "org_demo",
        created_at: "2024-01-01T00:00:00Z",
        last_login: new Date().toISOString(),
      };

      // Generate JWT token
      const token = await sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
          iat: Math.floor(Date.now() / 1000),
        },
        getJwtSecret(c.env),
      );

      // Log successful login (without PII)
      console.log(
        JSON.stringify({
          event: "user_login",
          userId: user.id,
          timestamp: new Date().toISOString(),
          env: c.env.ENVIRONMENT,
        }),
      );

      return c.json({
        success: true,
        message: "Login successful",
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            last_login: user.last_login,
          },
          expires_in: 3600,
        },
      });
    } else {
      // Log failed login attempt (without PII)
      console.log(
        JSON.stringify({
          event: "login_failed",
          emailHash: await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(email),
          ),
          timestamp: new Date().toISOString(),
          env: c.env.ENVIRONMENT,
        }),
      );

      return c.json({ error: "Invalid credentials" }, 401);
    }
  } catch (error) {
    console.error(
      "Login error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Protected routes (require JWT)
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
    const payload = await verify(token, getJwtSecret(c.env));
    c.set("user", payload);
    await next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Billing Routes (protected)
app.get("/api/v1/billing/invoices", async (c) => {
  try {
    const user = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const status = c.req.query("status");

    // Validate parameters
    if (page < 1 || limit < 1) {
      return c.json({ error: "Invalid pagination parameters" }, 400);
    }

    // Mock invoices (in production, query database with proper filtering)
    const invoices: Invoice[] = [
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

    // Filter by status if provided
    const filteredInvoices = status
      ? invoices.filter((inv) => inv.status === status)
      : invoices;

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedInvoices = filteredInvoices.slice(
      startIndex,
      startIndex + limit,
    );

    // Log access (without PII)
    console.log(
      JSON.stringify({
        event: "invoices_accessed",
        userId: user.sub,
        count: paginatedInvoices.length,
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT,
      }),
    );

    return c.json({
      success: true,
      data: {
        invoices: paginatedInvoices,
        pagination: {
          page,
          limit,
          total: filteredInvoices.length,
          pages: Math.ceil(filteredInvoices.length / limit),
        },
      },
    });
  } catch (error) {
    console.error(
      "Invoices fetch error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/api/v1/billing/invoices", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const { customerId, amount, currency, dueDate, items } = body;

    // Input validation
    if (!customerId || !amount || !items || !Array.isArray(items)) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    if (!validateAmount(amount)) {
      return c.json({ error: "Invalid amount" }, 400);
    }

    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      return c.json({ error: "Invalid currency code" }, 400);
    }

    // Validate items array
    if (items.length === 0 || items.length > 100) {
      return c.json({ error: "Items array must have 1-100 items" }, 400);
    }

    for (const item of items) {
      if (!item.description || !item.quantity || !item.unitPrice) {
        return c.json(
          { error: "Each item must have description, quantity, and unitPrice" },
          400,
        );
      }
      if (!validateAmount(item.unitPrice) || item.quantity <= 0) {
        return c.json({ error: "Invalid item quantity or unit price" }, 400);
      }
    }

    // Create invoice (in production, save to database)
    const invoice: Invoice = {
      id: "inv_" + crypto.randomUUID(),
      number:
        "INV-" +
        new Date().getFullYear() +
        "-" +
        Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0"),
      customer_id: customerId,
      amount: amount,
      currency: currency.toUpperCase(),
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Log invoice creation (audit trail)
    console.log(
      JSON.stringify({
        event: "invoice_created",
        invoiceId: invoice.id,
        userId: user.sub,
        amount: invoice.amount,
        currency: invoice.currency,
        customerId: invoice.customer_id,
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT,
      }),
    );

    return c.json(
      {
        success: true,
        message: "Invoice created successfully",
        data: invoice,
      },
      201,
    );
  } catch (error) {
    console.error(
      "Invoice creation error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Compliance Routes (protected)
app.get("/api/v1/compliance/kyc", async (c) => {
  try {
    const user = c.get("user");

    // Mock KYC data (in production, query database)
    const kycData = {
      kyc_status: "verified",
      verification_level: "enhanced",
      verified_at: "2024-01-10T15:30:00Z",
      documents: [
        {
          type: "passport",
          status: "verified",
          uploaded_at: "2024-01-10T15:00:00Z",
        },
        {
          type: "proof_of_address",
          status: "verified",
          uploaded_at: "2024-01-10T15:10:00Z",
        },
      ],
      risk_score: 15,
      last_updated: new Date().toISOString(),
    };

    // Log KYC access (audit trail)
    console.log(
      JSON.stringify({
        event: "kyc_accessed",
        userId: user.sub,
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT,
      }),
    );

    return c.json({
      success: true,
      data: kycData,
    });
  } catch (error) {
    console.error(
      "KYC fetch error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Intelligence Routes (protected)
app.get("/api/v1/intelligence/transactions", async (c) => {
  try {
    const user = c.get("user");
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const category = c.req.query("category");

    // Validate parameters
    if (page < 1 || limit < 1) {
      return c.json({ error: "Invalid pagination parameters" }, 400);
    }

    // Mock transaction data (in production, query database)
    const transactions: Transaction[] = [
      {
        id: "txn_001",
        amount: 150.0,
        currency: "USD",
        category: "software",
        description: "Software subscription",
        user_id: user.sub,
        date: "2024-01-15T10:00:00Z",
        confidence_score: 0.95,
      },
      {
        id: "txn_002",
        amount: 89.99,
        currency: "USD",
        category: "infrastructure",
        description: "Cloud hosting services",
        user_id: user.sub,
        date: "2024-01-14T14:30:00Z",
        confidence_score: 0.87,
      },
    ];

    // Filter by category if provided
    const filteredTransactions = category
      ? transactions.filter((tx) => tx.category === category)
      : transactions;

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = filteredTransactions.slice(
      startIndex,
      startIndex + limit,
    );

    // Log transaction access (audit trail)
    console.log(
      JSON.stringify({
        event: "transactions_accessed",
        userId: user.sub,
        count: paginatedTransactions.length,
        category: category || "all",
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT,
      }),
    );

    return c.json({
      success: true,
      data: {
        transactions: paginatedTransactions,
        pagination: {
          page,
          limit,
          total: filteredTransactions.length,
          pages: Math.ceil(filteredTransactions.length / limit),
        },
        analytics: {
          total_amount: filteredTransactions.reduce(
            (sum, tx) => sum + tx.amount,
            0,
          ),
          average_amount:
            filteredTransactions.length > 0
              ? filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0) /
                filteredTransactions.length
              : 0,
          categories: [
            ...new Set(filteredTransactions.map((tx) => tx.category)),
          ],
        },
      },
    });
  } catch (error) {
    console.error(
      "Transactions fetch error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Risk Routes (protected)
app.get("/api/v1/risk/score", async (c) => {
  try {
    const user = c.get("user");
    const entityId = c.req.query("entityId");
    const entityType = c.req.query("entityType") as
      | "customer"
      | "transaction"
      | "merchant";

    // Validate parameters
    if (!entityId || !entityType) {
      return c.json(
        { error: "entityId and entityType parameters required" },
        400,
      );
    }

    if (!["customer", "transaction", "merchant"].includes(entityType)) {
      return c.json(
        {
          error:
            "Invalid entityType. Must be: customer, transaction, or merchant",
        },
        400,
      );
    }

    // Mock risk score (in production, calculate using ML models)
    const riskScore: RiskScore = {
      entity_id: entityId,
      entity_type: entityType,
      score: Math.floor(Math.random() * 100),
      risk_level: "low",
      factors: [
        {
          factor: "transaction_history",
          impact: "positive",
          score: 10,
          description: "Consistent transaction patterns observed",
        },
        {
          factor: "geographic_location",
          impact: "neutral",
          score: 0,
          description: "Standard geographic risk profile",
        },
      ],
      last_updated: new Date().toISOString(),
    };

    // Determine risk level based on score
    if (riskScore.score >= 70) {
      riskScore.risk_level = "critical";
    } else if (riskScore.score >= 50) {
      riskScore.risk_level = "high";
    } else if (riskScore.score >= 30) {
      riskScore.risk_level = "medium";
    } else {
      riskScore.risk_level = "low";
    }

    // Log risk score access (audit trail)
    console.log(
      JSON.stringify({
        event: "risk_score_accessed",
        userId: user.sub,
        entityId: entityId,
        entityType: entityType,
        riskScore: riskScore.score,
        riskLevel: riskScore.risk_level,
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT,
      }),
    );

    return c.json({
      success: true,
      data: riskScore,
    });
  } catch (error) {
    console.error(
      "Risk score error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Logout (protected)
app.post("/api/v1/auth/logout", async (c) => {
  try {
    const user = c.get("user");

    // In production, add token to blacklist or invalidate session
    console.log(
      JSON.stringify({
        event: "user_logout",
        userId: user.sub,
        timestamp: new Date().toISOString(),
        env: c.env.ENVIRONMENT,
      }),
    );

    return c.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error(
      "Logout error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return c.json({ error: "Internal server error" }, 500);
  }
});

// User profile (protected)
app.get("/api/v1/auth/profile", async (c) => {
  try {
    const user = c.get("user");

    // Mock user profile (in production, fetch from database)
    const profile = {
      id: user.sub,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      created_at: "2024-01-01T00:00:00Z",
      last_login: new Date().toISOString(),
      preferences: {
        notifications: true,
        currency: "USD",
        timezone: "UTC",
      },
    };

    return c.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error(
      "Profile fetch error:",
      error instanceof Error ? error.message : "Unknown error",
    );
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
