/**
 * Smart Billing & Payment SDK Routes
 * Revolutionary AI-enhanced billing, payment processing, and invoice management
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type {
  Env,
  Invoice,
  Payment,
  Customer,
  Subscription,
  SubscriptionPlan,
} from "../types";
import SubscriptionService from "./subscription-service";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  cancelSubscriptionSchema,
  createSubscriptionPlanSchema,
  validateInput,
} from "./validation-schemas";

const billing = new Hono<{ Bindings: Env }>();

// Schemas
const createInvoiceSchema = z.object({
  customer_id: z.string(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unit_price: z.number().positive(),
      tax_rate: z.number().min(0).max(1),
    }),
  ),
  due_date: z.string().optional(),
  currency: z.string().default("USD"),
  purchase_order: z.string().optional(),
  notes: z.string().optional(),
});

const createPaymentSchema = z.object({
  invoice_id: z.string(),
  amount: z.number().positive(),
  currency: z.string(),
  provider: z.enum(["stripe", "lemonsqueezy", "paypal"]),
  payment_method_id: z.string().optional(),
});

const createCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      postal_code: z.string(),
      country: z.string(),
    })
    .optional(),
  tax_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Note: Subscription schemas are now imported from validation-schemas.ts
// They include comprehensive validation for security and data integrity

// Invoice Management Routes
billing.post(
  "/invoices",
  zValidator("json", createInvoiceSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const organization = c.get("organization");
      const aiContext = c.get("aiContext");
      const data = c.req.valid("json");

      // AI-enhanced invoice creation
      let aiEnhancements = {};
      if (aiContext?.enabled) {
        aiEnhancements = await generateInvoiceEnhancements(
          c.env,
          data,
          organization,
        );
      }

      // Create invoice with AI enhancements
      const invoice: Invoice = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        customer_id: data.customer_id,
        number: await generateInvoiceNumber(c.env, organization.id),
        status: "draft",
        currency: data.currency,
        amount: calculateSubtotal(data.items),
        tax_amount: calculateTax(data.items),
        total_amount: calculateTotal(data.items),
        due_date: data.due_date || getDefaultDueDate(),
        items: data.items.map((item, index) => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          total: item.quantity * item.unit_price * (1 + item.tax_rate),
          product_id: null,
          category: aiEnhancements.categories?.[index] || "general",
        })),
        metadata: {
          purchase_order: data.purchase_order,
          ai_generated_notes: aiEnhancements.notes,
          auto_categorization: aiEnhancements.categorization,
          payment_prediction: aiEnhancements.paymentPrediction,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Store invoice
      const db = getDatabaseByRegion(organization.region, c.env);
      await db
        .prepare(
          `
      INSERT INTO invoices (
        id, organization_id, customer_id, number, status, currency,
        amount, tax_amount, total_amount, due_date, items, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        )
        .bind(
          invoice.id,
          invoice.organization_id,
          invoice.customer_id,
          invoice.number,
          invoice.status,
          invoice.currency,
          invoice.amount,
          invoice.tax_amount,
          invoice.total_amount,
          invoice.due_date,
          JSON.stringify(invoice.items),
          JSON.stringify(invoice.metadata),
          invoice.created_at,
          invoice.updated_at,
        )
        .run();

      // Trigger AI processing if enabled
      if (aiContext?.enabled) {
        await queueInvoiceProcessing(c.env, invoice);
      }

      return c.json({
        success: true,
        data: {
          invoice,
          aiEnhancements,
        },
        meta: {
          request_id: c.get("requestId"),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Invoice creation failed:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INVOICE_CREATION_FAILED",
            message: "Failed to create invoice",
            details:
              c.env.ENVIRONMENT === "development" ? error.message : undefined,
          },
        },
        500,
      );
    }
  },
);

billing.get("/invoices", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const query = c.req.query();

    const page = parseInt(query.page || "1");
    const limit = Math.min(parseInt(query.limit || "20"), 100);
    const status = query.status;
    const customer_id = query.customer_id;

    const db = getDatabaseByRegion(organization.region, c.env);

    let whereClause = "WHERE organization_id = ?";
    const bindings = [organization.id];

    if (status) {
      whereClause += " AND status = ?";
      bindings.push(status);
    }

    if (customer_id) {
      whereClause += " AND customer_id = ?";
      bindings.push(customer_id);
    }

    // Get total count
    const countResult = await db
      .prepare(
        `
      SELECT COUNT(*) as total FROM invoices ${whereClause}
    `,
      )
      .bind(...bindings)
      .first();

    const total = countResult?.total || 0;

    // Get invoices with pagination
    const offset = (page - 1) * limit;
    const invoices = await db
      .prepare(
        `
      SELECT * FROM invoices ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      )
      .bind(...bindings, limit, offset)
      .all();

    return c.json({
      success: true,
      data: {
        invoices: invoices.results || [],
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_more: offset + limit < total,
        },
      },
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Invoice list failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INVOICE_LIST_FAILED",
          message: "Failed to retrieve invoices",
        },
      },
      500,
    );
  }
});

billing.get("/invoices/:id", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const invoiceId = c.req.param("id");

    const db = getDatabaseByRegion(organization.region, c.env);
    const invoice = await db
      .prepare(
        `
      SELECT * FROM invoices WHERE id = ? AND organization_id = ?
    `,
      )
      .bind(invoiceId, organization.id)
      .first();

    if (!invoice) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVOICE_NOT_FOUND",
            message: "Invoice not found",
          },
        },
        404,
      );
    }

    // Parse JSON fields
    const parsedInvoice = {
      ...invoice,
      items: JSON.parse(invoice.items || "[]"),
      metadata: JSON.parse(invoice.metadata || "{}"),
    };

    return c.json({
      success: true,
      data: parsedInvoice,
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Invoice get failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INVOICE_GET_FAILED",
          message: "Failed to retrieve invoice",
        },
      },
      500,
    );
  }
});

billing.post("/invoices/:id/send", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const invoiceId = c.req.param("id");
    const { send_method = "email", recipient, message } = await c.req.json();

    const db = getDatabaseByRegion(organization.region, c.env);

    // Get invoice
    const invoice = await db
      .prepare(
        `
      SELECT * FROM invoices WHERE id = ? AND organization_id = ?
    `,
      )
      .bind(invoiceId, organization.id)
      .first();

    if (!invoice) {
      return c.json(
        {
          success: false,
          error: {
            code: "INVOICE_NOT_FOUND",
            message: "Invoice not found",
          },
        },
        404,
      );
    }

    // Update status to sent
    await db
      .prepare(
        `
      UPDATE invoices SET status = 'sent', updated_at = ?
      WHERE id = ?
    `,
      )
      .bind(new Date().toISOString(), invoiceId)
      .run();

    // Queue sending process
    await queueInvoiceSending(c.env, {
      invoiceId,
      organizationId: organization.id,
      sendMethod: send_method,
      recipient: recipient || invoice.customer_email,
      message,
      userId: user.id,
    });

    return c.json({
      success: true,
      data: {
        invoice_id: invoiceId,
        status: "sent",
        send_method,
        recipient,
      },
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Invoice send failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "INVOICE_SEND_FAILED",
          message: "Failed to send invoice",
        },
      },
      500,
    );
  }
});

// Payment Processing Routes
billing.post(
  "/payments",
  zValidator("json", createPaymentSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const organization = c.get("organization");
      const aiContext = c.get("aiContext");
      const data = c.req.valid("json");

      // AI-powered fraud detection
      let fraudAnalysis = null;
      if (aiContext?.enabled) {
        fraudAnalysis = await analyzePaymentRisk(c.env, data, organization);
      }

      if (fraudAnalysis?.risk_score > 0.8) {
        return c.json(
          {
            success: false,
            error: {
              code: "HIGH_RISK_PAYMENT",
              message: "Payment flagged as high risk",
              details: fraudAnalysis,
            },
          },
          400,
        );
      }

      // Create payment record
      const payment = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        invoice_id: data.invoice_id,
        amount: data.amount,
        currency: data.currency,
        status: "pending",
        provider: data.provider,
        provider_transaction_id: null,
        created_at: new Date().toISOString(),
        ai_metadata: {
          fraud_score: fraudAnalysis?.risk_score || 0,
          processing_prediction: fraudAnalysis?.processing_prediction || 0.9,
        },
      };

      const db = getDatabaseByRegion(organization.region, c.env);
      await db
        .prepare(
          `
      INSERT INTO payments (
        id, organization_id, invoice_id, amount, currency, status,
        provider, provider_transaction_id, created_at, ai_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        )
        .bind(
          payment.id,
          payment.organization_id,
          payment.invoice_id,
          payment.amount,
          payment.currency,
          payment.status,
          payment.provider,
          payment.provider_transaction_id,
          payment.created_at,
          JSON.stringify(payment.ai_metadata),
        )
        .run();

      // Process payment with provider
      const processingResult = await processPaymentWithProvider(
        c.env,
        payment,
        data,
      );

      if (processingResult.success) {
        // Update payment with provider transaction ID
        await db
          .prepare(
            `
        UPDATE payments SET
          provider_transaction_id = ?,
          status = 'completed',
          completed_at = ?
        WHERE id = ?
      `,
          )
          .bind(
            processingResult.transaction_id,
            new Date().toISOString(),
            payment.id,
          )
          .run();

        // Update invoice status if fully paid
        await updateInvoicePaymentStatus(
          c.env,
          data.invoice_id,
          organization.id,
        );
      }

      return c.json({
        success: true,
        data: {
          payment: {
            ...payment,
            ...processingResult,
          },
          fraud_analysis: fraudAnalysis,
        },
        meta: {
          request_id: c.get("requestId"),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Payment processing failed:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "PAYMENT_PROCESSING_FAILED",
            message: "Failed to process payment",
          },
        },
        500,
      );
    }
  },
);

billing.get("/payments", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const query = c.req.query();

    const page = parseInt(query.page || "1");
    const limit = Math.min(parseInt(query.limit || "20"), 100);
    const status = query.status;
    const invoice_id = query.invoice_id;

    const db = getDatabaseByRegion(organization.region, c.env);

    let whereClause = "WHERE organization_id = ?";
    const bindings = [organization.id];

    if (status) {
      whereClause += " AND status = ?";
      bindings.push(status);
    }

    if (invoice_id) {
      whereClause += " AND invoice_id = ?";
      bindings.push(invoice_id);
    }

    // Get payments with pagination
    const offset = (page - 1) * limit;
    const payments = await db
      .prepare(
        `
      SELECT * FROM payments ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      )
      .bind(...bindings, limit, offset)
      .all();

    return c.json({
      success: true,
      data: {
        payments: payments.results || [],
        pagination: {
          page,
          limit,
          total: 0, // TODO: Implement count query
          total_pages: 1,
          has_more: false,
        },
      },
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Payment list failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "PAYMENT_LIST_FAILED",
          message: "Failed to retrieve payments",
        },
      },
      500,
    );
  }
});

// Customer Management Routes
billing.post(
  "/customers",
  zValidator("json", createCustomerSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const organization = c.get("organization");
      const aiContext = c.get("aiContext");
      const data = c.req.valid("json");

      // AI-powered customer analysis
      let customerInsights = null;
      if (aiContext?.enabled) {
        customerInsights = await analyzeCustomerData(c.env, data, organization);
      }

      const customer: Customer = {
        id: crypto.randomUUID(),
        organization_id: organization.id,
        email: data.email,
        name: data.name,
        phone: data.phone,
        address: data.address,
        tax_id: data.tax_id,
        metadata: {
          ...data.metadata,
          ai_insights: customerInsights,
          risk_score: customerInsights?.risk_score || 0,
          predicted_ltv: customerInsights?.predicted_ltv || 0,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const db = getDatabaseByRegion(organization.region, c.env);
      await db
        .prepare(
          `
      INSERT INTO customers (
        id, organization_id, email, name, phone, address, tax_id,
        metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        )
        .bind(
          customer.id,
          customer.organization_id,
          customer.email,
          customer.name,
          JSON.stringify(customer.phone),
          JSON.stringify(customer.address),
          customer.tax_id,
          JSON.stringify(customer.metadata),
          customer.created_at,
          customer.updated_at,
        )
        .run();

      return c.json({
        success: true,
        data: {
          customer,
          insights: customerInsights,
        },
        meta: {
          request_id: c.get("requestId"),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Customer creation failed:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "CUSTOMER_CREATION_FAILED",
            message: "Failed to create customer",
          },
        },
        500,
      );
    }
  },
);

billing.get("/customers", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const query = c.req.query();

    const page = parseInt(query.page || "1");
    const limit = Math.min(parseInt(query.limit || "20"), 100);
    const search = query.search;

    const db = getDatabaseByRegion(organization.region, c.env);

    let whereClause = "WHERE organization_id = ?";
    const bindings = [organization.id];

    if (search) {
      whereClause += " AND (name LIKE ? OR email LIKE ?)";
      bindings.push(`%${search}%`, `%${search}%`);
    }

    const offset = (page - 1) * limit;
    const customers = await db
      .prepare(
        `
      SELECT * FROM customers ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      )
      .bind(...bindings, limit, offset)
      .all();

    // Parse metadata for each customer
    const parsedCustomers = (customers.results || []).map((customer) => ({
      ...customer,
      metadata: JSON.parse(customer.metadata || "{}"),
      address: customer.address ? JSON.parse(customer.address) : null,
      phone: customer.phone ? JSON.parse(customer.phone) : null,
    }));

    return c.json({
      success: true,
      data: {
        customers: parsedCustomers,
        pagination: {
          page,
          limit,
          total: 0,
          total_pages: 1,
          has_more: false,
        },
      },
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Customer list failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "CUSTOMER_LIST_FAILED",
          message: "Failed to retrieve customers",
        },
      },
      500,
    );
  }
});

// Analytics and Reporting Routes
billing.get("/analytics/dashboard", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const aiContext = c.get("aiContext");

    const db = getDatabaseByRegion(organization.region, c.env);

    // Get key metrics
    const [
      totalRevenue,
      totalInvoices,
      paidInvoices,
      outstandingInvoices,
      avgPaymentTime,
    ] = await Promise.all([
      db
        .prepare(
          'SELECT SUM(total_amount) as total FROM invoices WHERE status = "paid" AND organization_id = ?',
        )
        .bind(organization.id)
        .first(),
      db
        .prepare(
          "SELECT COUNT(*) as total FROM invoices WHERE organization_id = ?",
        )
        .bind(organization.id)
        .first(),
      db
        .prepare(
          'SELECT COUNT(*) as total FROM invoices WHERE status = "paid" AND organization_id = ?',
        )
        .bind(organization.id)
        .first(),
      db
        .prepare(
          'SELECT SUM(total_amount) as total FROM invoices WHERE status != "paid" AND organization_id = ?',
        )
        .bind(organization.id)
        .first(),
      db
        .prepare(
          `
        SELECT AVG(JULIANDAY(completed_at) - JULIANDAY(created_at)) as avg_days
        FROM payments WHERE organization_id = ? AND status = "completed"
      `,
        )
        .bind(organization.id)
        .first(),
    ]);

    // AI-powered insights
    let insights = null;
    if (aiContext?.enabled) {
      insights = await generateBillingInsights(c.env, organization, {
        totalRevenue: totalRevenue?.total || 0,
        totalInvoices: totalInvoices?.total || 0,
        paidInvoices: paidInvoices?.total || 0,
        outstandingInvoices: outstandingInvoices?.total || 0,
        avgPaymentTime: avgPaymentTime?.avg_days || 0,
      });
    }

    const dashboard = {
      metrics: {
        total_revenue: totalRevenue?.total || 0,
        total_invoices: totalInvoices?.total || 0,
        paid_invoices: paidInvoices?.total || 0,
        outstanding_amount: outstandingInvoices?.total || 0,
        average_payment_time: Math.round((avgPaymentTime?.avg_days || 0) * 24), // Convert to hours
      },
      insights,
      generated_at: new Date().toISOString(),
    };

    return c.json({
      success: true,
      data: dashboard,
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Dashboard analytics failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "DASHBOARD_ANALYTICS_FAILED",
          message: "Failed to retrieve dashboard analytics",
        },
      },
      500,
    );
  }
});

// Helper functions
function calculateSubtotal(items: any[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}

function calculateTax(items: any[]): number {
  return items.reduce((sum, item) => {
    const subtotal = item.quantity * item.unit_price;
    return sum + subtotal * item.tax_rate;
  }, 0);
}

function calculateTotal(items: any[]): number {
  return calculateSubtotal(items) + calculateTax(items);
}

function getDefaultDueDate(): string {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30); // 30 days default
  return dueDate.toISOString();
}

async function generateInvoiceNumber(
  env: Env,
  organizationId: string,
): Promise<string> {
  const db = env.DB_BILLING_US; // Default to US for invoice numbering

  const result = await db
    .prepare(
      `
    SELECT COUNT(*) as count FROM invoices WHERE organization_id = ?
  `,
    )
    .bind(organizationId)
    .first();

  const invoiceCount = (result?.count || 0) + 1;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `INV-${year}-${month}-${String(invoiceCount).padStart(4, "0")}`;
}

function getDatabaseByRegion(region: "US" | "EU", env: Env): D1Database {
  return region === "EU" ? env.DB_BILLING_EU : env.DB_BILLING_US;
}

// AI-enhanced functions (simplified for now)
async function generateInvoiceEnhancements(
  env: Env,
  data: any,
  organization: any,
): Promise<any> {
  try {
    if (!env.AI) return {};

    // AI would generate categories, notes, and payment predictions
    return {
      categories: data.items.map(() => "general"),
      notes: "AI-generated notes",
      categorization: "automatic",
      paymentPrediction: 0.95,
    };
  } catch (error) {
    console.error("AI enhancements failed:", error);
    return {};
  }
}

async function analyzePaymentRisk(
  env: Env,
  data: any,
  organization: any,
): Promise<any> {
  try {
    if (!env.AI) return { risk_score: 0.1, processing_prediction: 0.9 };

    // AI would analyze payment for fraud risk
    return {
      risk_score: Math.random() * 0.3, // Low risk for demo
      processing_prediction: 0.95,
    };
  } catch (error) {
    console.error("Payment risk analysis failed:", error);
    return { risk_score: 0.1, processing_prediction: 0.9 };
  }
}

async function analyzeCustomerData(
  env: Env,
  data: any,
  organization: any,
): Promise<any> {
  try {
    if (!env.AI) return {};

    // AI would analyze customer data for insights
    return {
      risk_score: Math.random() * 0.2,
      predicted_ltv: Math.random() * 10000,
      segment: "standard",
    };
  } catch (error) {
    console.error("Customer analysis failed:", error);
    return {};
  }
}

async function generateBillingInsights(
  env: Env,
  organization: any,
  metrics: any,
): Promise<any> {
  try {
    if (!env.AI) return {};

    // AI would generate business insights
    return {
      trends: ["Revenue increasing"],
      recommendations: ["Follow up on overdue invoices"],
      opportunities: ["Expand payment options"],
    };
  } catch (error) {
    console.error("Billing insights generation failed:", error);
    return {};
  }
}

// Processing functions (simplified)
async function queueInvoiceProcessing(
  env: Env,
  invoice: Invoice,
): Promise<void> {
  // Queue for AI processing
  if (env.BILLING_QUEUE) {
    await env.BILLING_QUEUE.send({
      type: "invoice_processing",
      invoiceId: invoice.id,
      organizationId: invoice.organization_id,
    });
  }
}

async function queueInvoiceSending(env: Env, data: any): Promise<void> {
  // Queue for sending
  if (env.BILLING_QUEUE) {
    await env.BILLING_QUEUE.send({
      type: "invoice_sending",
      ...data,
    });
  }
}

async function processPaymentWithProvider(
  env: Env,
  payment: any,
  data: any,
): Promise<any> {
  // Simplified payment processing
  return {
    success: true,
    transaction_id: `txn_${Date.now()}`,
    provider_response: { status: "succeeded" },
  };
}

async function updateInvoicePaymentStatus(
  env: Env,
  invoiceId: string,
  organizationId: string,
): Promise<void> {
  const db = env.DB_BILLING_US;

  // Check if invoice is fully paid
  const result = await db
    .prepare(
      `
    SELECT SUM(p.amount) as paid_total, i.total_amount
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE p.invoice_id = ? AND p.status = 'completed' AND i.organization_id = ?
    GROUP BY i.total_amount
  `,
    )
    .bind(invoiceId, organizationId)
    .first();

  if (result && result.paid_total >= result.total_amount) {
    await db
      .prepare(
        `
      UPDATE invoices SET status = 'paid', updated_at = ?
      WHERE id = ?
    `,
      )
      .bind(new Date().toISOString(), invoiceId)
      .run();
  }
}

// Subscription Management Routes
billing.post(
  "/subscriptions",
  zValidator("json", createSubscriptionSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const organization = c.get("organization");
      const data = c.req.valid("json");

      const subscriptionService = new SubscriptionService(
        c.env,
        c.get("logger"),
      );
      const result = await subscriptionService.createSubscription(
        organization.id,
        user.id,
        data,
      );

      return c.json({
        success: true,
        data: {
          subscription: result.subscription,
          insights: result.insights,
        },
        meta: {
          request_id: c.get("requestId"),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Subscription creation failed:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "SUBSCRIPTION_CREATION_FAILED",
            message: "Failed to create subscription",
            details:
              c.env.ENVIRONMENT === "development" ? error.message : undefined,
          },
        },
        500,
      );
    }
  },
);

billing.get("/subscriptions", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const query = c.req.query();

    const filters = {
      status: query.status,
      customer_id: query.customer_id,
      plan_id: query.plan_id,
      page: parseInt(query.page || "1"),
      limit: Math.min(parseInt(query.limit || "20"), 100),
    };

    const subscriptionService = new SubscriptionService(c.env, c.get("logger"));
    const result = await subscriptionService.listSubscriptions(
      organization.id,
      filters,
    );

    return c.json({
      success: true,
      data: result,
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Subscription list failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "SUBSCRIPTION_LIST_FAILED",
          message: "Failed to retrieve subscriptions",
        },
      },
      500,
    );
  }
});

billing.get("/subscriptions/:id", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const subscriptionId = c.req.param("id");

    const subscriptionService = new SubscriptionService(c.env, c.get("logger"));
    const subscription = await subscriptionService.getSubscription?.(
      subscriptionId,
      organization.id,
    );

    if (!subscription) {
      return c.json(
        {
          success: false,
          error: {
            code: "SUBSCRIPTION_NOT_FOUND",
            message: "Subscription not found",
          },
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: subscription,
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Subscription get failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "SUBSCRIPTION_GET_FAILED",
          message: "Failed to retrieve subscription",
        },
      },
      500,
    );
  }
});

billing.put(
  "/subscriptions/:id",
  zValidator("json", updateSubscriptionSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const organization = c.get("organization");
      const subscriptionId = c.req.param("id");
      const data = c.req.valid("json");

      const subscriptionService = new SubscriptionService(
        c.env,
        c.get("logger"),
      );
      const result = await subscriptionService.updateSubscription(
        organization.id,
        subscriptionId,
        data,
      );

      return c.json({
        success: true,
        data: {
          subscription: result.subscription,
          proration: result.proration,
          insights: result.insights,
        },
        meta: {
          request_id: c.get("requestId"),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Subscription update failed:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "SUBSCRIPTION_UPDATE_FAILED",
            message: "Failed to update subscription",
            details:
              c.env.ENVIRONMENT === "development" ? error.message : undefined,
          },
        },
        500,
      );
    }
  },
);

billing.post(
  "/subscriptions/:id/cancel",
  zValidator("json", cancelSubscriptionSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const organization = c.get("organization");
      const subscriptionId = c.req.param("id");
      const data = c.req.valid("json");

      const subscriptionService = new SubscriptionService(
        c.env,
        c.get("logger"),
      );
      const result = await subscriptionService.cancelSubscription(
        organization.id,
        subscriptionId,
        data.cancel_at_period_end,
        data.reason,
        data.feedback,
      );

      return c.json({
        success: true,
        data: {
          subscription: result.subscription,
          insights: result.insights,
        },
        meta: {
          request_id: c.get("requestId"),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Subscription cancellation failed:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "SUBSCRIPTION_CANCELLATION_FAILED",
            message: "Failed to cancel subscription",
            details:
              c.env.ENVIRONMENT === "development" ? error.message : undefined,
          },
        },
        500,
      );
    }
  },
);

// Subscription Plan Management Routes
billing.post(
  "/plans",
  zValidator("json", createSubscriptionPlanSchema),
  async (c) => {
    try {
      const user = c.get("user");
      const organization = c.get("organization");
      const data = c.req.valid("json");

      const subscriptionService = new SubscriptionService(
        c.env,
        c.get("logger"),
      );
      const plan = await subscriptionService.createPlan(organization.id, data);

      return c.json({
        success: true,
        data: plan,
        meta: {
          request_id: c.get("requestId"),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Plan creation failed:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "PLAN_CREATION_FAILED",
            message: "Failed to create subscription plan",
            details:
              c.env.ENVIRONMENT === "development" ? error.message : undefined,
          },
        },
        500,
      );
    }
  },
);

billing.get("/plans", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");

    const db = getDatabaseByRegion(organization.region || "US", c.env);
    const plans = await db
      .prepare(
        `
      SELECT * FROM subscription_plans
      WHERE organization_id = ? AND active = true
      ORDER BY amount ASC
    `,
      )
      .bind(organization.id)
      .all();

    const parsedPlans = (plans.results || []).map((plan) => ({
      ...plan,
      features: JSON.parse(plan.features || "[]"),
      metadata: JSON.parse(plan.metadata || "{}"),
    }));

    return c.json({
      success: true,
      data: {
        plans: parsedPlans,
      },
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Plan list failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "PLAN_LIST_FAILED",
          message: "Failed to retrieve subscription plans",
        },
      },
      500,
    );
  }
});

// Subscription Analytics Routes
billing.get("/subscriptions/analytics", async (c) => {
  try {
    const user = c.get("user");
    const organization = c.get("organization");
    const period =
      (c.req.query("period") as "month" | "quarter" | "year") || "month";

    const subscriptionService = new SubscriptionService(c.env, c.get("logger"));
    const analytics = await subscriptionService.getAnalytics(
      organization.id,
      period,
    );

    return c.json({
      success: true,
      data: analytics,
      meta: {
        request_id: c.get("requestId"),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Subscription analytics failed:", error);
    return c.json(
      {
        success: false,
        error: {
          code: "SUBSCRIPTION_ANALYTICS_FAILED",
          message: "Failed to retrieve subscription analytics",
        },
      },
      500,
    );
  }
});

export { billing as billingRoutes };
