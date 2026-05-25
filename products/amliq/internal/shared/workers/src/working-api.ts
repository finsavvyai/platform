import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { jwt, sign, verify } from "hono/jwt";

const app = new Hono();

// CORS configuration
app.use(
  "*",
  cors({
    origin: [
      "https://finsavvyai.com",
      "https://app.finsavvyai.com",
      "https://api.finsavvyai.com",
      "https://billing.finsavvyai.com",
      "https://compliance.finsavvyai.com",
      "https://intelligence.finsavvyai.com",
      "https://risk.finsavvyai.com",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-XSS-Protection", "1; mode=block");
});

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: "production",
    services: {
      auth: "operational",
      billing: "operational",
      compliance: "operational",
      intelligence: "operational",
      risk: "operational",
    },
  });
});

// API status
app.get("/api/v1/status", (c) => {
  return c.json({
    api: "FinTech Suite API",
    version: "1.0.0",
    environment: "production",
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

// Authentication - working simple version
app.post("/api/v1/auth/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    // Simple demo authentication
    if (email === "demo@finsavvyai.com" && password === "DemoPass123!") {
      const payload = {
        sub: "user_demo_123",
        email: email,
        role: "finance",
        organization_id: "org_demo",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      // Secure JWT secret from environment variables
      const secret = c.env.JWT_SECRET;
      if (!secret) {
        throw new Error("JWT_SECRET environment variable is required");
      }
      const token = await sign(payload, secret);

      return c.json({
        success: true,
        message: "Login successful",
        data: {
          token: token,
          user: {
            id: "user_demo_123",
            email: email,
            role: "finance",
            last_login: new Date().toISOString(),
          },
          expires_in: 3600,
        },
      });
    } else {
      return c.json({ error: "Invalid credentials" }, 401);
    }
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Protected endpoints with JWT middleware
app.use("/api/v1/*", async (c, next) => {
  if (c.req.path === "/api/v1/status" || c.req.path === "/health") {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Authorization required" }, 401);
  }

  try {
    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET environment variable is required");
    }
    const payload = await verify(token, secret);
    c.set("user", payload);
    await next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// Billing endpoints
app.get("/api/v1/billing/invoices", async (c) => {
  const user = c.get("user");

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

  return c.json({
    success: true,
    data: {
      invoices: invoices,
      pagination: {
        page: 1,
        limit: 20,
        total: invoices.length,
        pages: 1,
      },
    },
  });
});

// Compliance endpoints
app.get("/api/v1/compliance/kyc", async (c) => {
  return c.json({
    success: true,
    data: {
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
    },
  });
});

// Intelligence endpoints
app.get("/api/v1/intelligence/transactions", async (c) => {
  const transactions = [
    {
      id: "txn_001",
      amount: 150.0,
      currency: "USD",
      category: "software",
      description: "Software subscription",
      date: "2024-01-15T10:00:00Z",
      confidence_score: 0.95,
    },
    {
      id: "txn_002",
      amount: 89.99,
      currency: "USD",
      category: "infrastructure",
      description: "Cloud hosting services",
      date: "2024-01-14T14:30:00Z",
      confidence_score: 0.87,
    },
  ];

  return c.json({
    success: true,
    data: {
      transactions: transactions,
      pagination: {
        page: 1,
        limit: 20,
        total: transactions.length,
        pages: 1,
      },
      analytics: {
        total_amount: transactions.reduce((sum, tx) => sum + tx.amount, 0),
        average_amount:
          transactions.reduce((sum, tx) => sum + tx.amount, 0) /
          transactions.length,
        categories: [...new Set(transactions.map((tx) => tx.category))],
      },
    },
  });
});

// Risk endpoints
app.get("/api/v1/risk/score", async (c) => {
  const riskScore = {
    entity_id: "entity_001",
    entity_type: "customer",
    score: 25,
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

  return c.json({
    success: true,
    data: riskScore,
  });
});

// User profile
app.get("/api/v1/auth/profile", async (c) => {
  const user = c.get("user");

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
});

// Logout
app.post("/api/v1/auth/logout", async (c) => {
  return c.json({
    success: true,
    message: "Logout successful",
  });
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
