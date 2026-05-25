import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

// Middleware
app.use(
  "*",
  cors({
    origin: ["https://finsavvyai.com", "https://app.finsavvyai.com"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("*", logger());

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      auth: "operational",
      billing: "operational",
      compliance: "operational",
      intelligence: "operational",
      risk: "operational",
    },
  });
});

// API Routes
app.get("/api/v1/status", (c) => {
  return c.json({
    api: "Fintech Suite API",
    version: "1.0.0",
    environment: "production",
    timestamp: new Date().toISOString(),
  });
});

// Authentication Routes
app.post("/api/v1/auth/register", async (c) => {
  const body = await c.req.json();
  return c.json(
    {
      success: true,
      message: "User registered successfully",
      user: {
        id: "user_" + Math.random().toString(36).substr(2, 9),
        email: body.email,
        role: "user",
        created_at: new Date().toISOString(),
      },
    },
    201,
  );
});

app.post("/api/v1/auth/login", async (c) => {
  const body = await c.req.json();
  return c.json({
    success: true,
    message: "Login successful",
    token: "jwt_token_" + Math.random().toString(36).substr(2, 32),
    user: {
      id: "user_" + Math.random().toString(36).substr(2, 9),
      email: body.email,
      role: "user",
    },
  });
});

// Billing Routes
app.get("/api/v1/billing/invoices", (c) => {
  return c.json({
    success: true,
    data: {
      invoices: [
        {
          id: "inv_001",
          number: "INV-2024-001",
          amount: 299.99,
          currency: "USD",
          status: "paid",
          created_at: "2024-01-15T10:00:00Z",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
      },
    },
  });
});

app.post("/api/v1/billing/invoices", async (c) => {
  const body = await c.req.json();
  return c.json(
    {
      success: true,
      message: "Invoice created successfully",
      data: {
        id: "inv_" + Math.random().toString(36).substr(2, 9),
        number: "INV-2024-" + Math.floor(Math.random() * 1000),
        amount: body.amount,
        currency: body.currency || "USD",
        status: "draft",
        created_at: new Date().toISOString(),
      },
    },
    201,
  );
});

// Compliance Routes
app.get("/api/v1/compliance/kyc", (c) => {
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
      ],
    },
  });
});

// Intelligence Routes
app.get("/api/v1/intelligence/transactions", (c) => {
  return c.json({
    success: true,
    data: {
      transactions: [
        {
          id: "txn_001",
          amount: 150.0,
          currency: "USD",
          category: "software",
          description: "Software subscription",
          date: "2024-01-15T10:00:00Z",
          confidence_score: 0.95,
        },
      ],
    },
  });
});

// Risk Routes
app.get("/api/v1/risk/score", (c) => {
  return c.json({
    success: true,
    data: {
      risk_score: 15,
      risk_level: "low",
      factors: [
        {
          factor: "transaction_history",
          impact: "positive",
          score: 10,
        },
      ],
      last_updated: new Date().toISOString(),
    },
  });
});

// Error handling
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Endpoint not found",
      message: "The requested API endpoint does not exist",
    },
    404,
  );
});

app.onError((err, c) => {
  console.error(err);
  return c.json(
    {
      success: false,
      error: "Internal server error",
      message: "An unexpected error occurred",
    },
    500,
  );
});

export default {
  fetch: app.fetch,
};
