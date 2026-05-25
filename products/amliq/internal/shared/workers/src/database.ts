// Database Helper for Consolidated FinTech Architecture
// This module provides access to the consolidated database schema

export interface DatabaseClient {
  prepare: (query: string) => any;
  batch: (statements: any[]) => Promise<any[]>;
  exec: (query: string) => Promise<any>;
}

export interface DatabaseBindings {
  DB_PRIMARY: DatabaseClient;
  DB_SECONDARY: DatabaseClient;
  DB_COMPLIANCE: DatabaseClient;
}

export interface RegionContext {
  region: 'US' | 'EU';
  organizationId: string;
}

export class FinTechDatabase {
  private db: DatabaseBindings;
  private context: RegionContext;

  constructor(db: DatabaseBindings, context: RegionContext) {
    this.db = db;
    this.context = context;
  }

  // ============================================================================
  // BILLING MODULE
  // ============================================================================

  // Billing Customers
  async getBillingCustomer(customerId: string) {
    const table = this.context.region === 'US' ? 'billing_us_customers' : 'billing_eu_customers';
    const stmt = this.db.DB_PRIMARY.prepare(`
      SELECT * FROM ${table}
      WHERE id = ? AND organization_id = ?
    `);
    return await stmt.bind(customerId, this.context.organizationId).first();
  }

  async createBillingCustomer(customer: any) {
    const table = this.context.region === 'US' ? 'billing_us_customers' : 'billing_eu_customers';
    const stmt = this.db.DB_PRIMARY.prepare(`
      INSERT INTO ${table} (
        id, organization_id, email, name, phone, address,
        billing_address, tax_id, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      customer.id,
      this.context.organizationId,
      customer.email,
      customer.name,
      customer.phone || null,
      customer.address || null,
      customer.billingAddress || null,
      customer.taxId || null,
      JSON.stringify(customer.metadata || {}),
      this.context.region
    ).run();
  }

  // Billing Invoices
  async getBillingInvoices(customerId?: string) {
    const table = this.context.region === 'US' ? 'billing_us_invoices' : 'billing_eu_invoices';
    let query = `SELECT * FROM ${table} WHERE organization_id = ?`;
    const params = [this.context.organizationId];

    if (customerId) {
      query += ' AND customer_id = ?';
      params.push(customerId);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.DB_PRIMARY.prepare(query);
    return await stmt.bind(...params).all();
  }

  async createBillingInvoice(invoice: any) {
    const table = this.context.region === 'US' ? 'billing_us_invoices' : 'billing_eu_invoices';
    const stmt = this.db.DB_PRIMARY.prepare(`
      INSERT INTO ${table} (
        id, organization_id, customer_id, invoice_number, amount_cents,
        currency, status, due_date, items, tax_amount_cents, total_amount_cents,
        notes, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      invoice.id,
      this.context.organizationId,
      invoice.customerId,
      invoice.invoiceNumber,
      invoice.amountCents,
      invoice.currency || (this.context.region === 'US' ? 'USD' : 'EUR'),
      invoice.status || 'draft',
      invoice.dueDate || null,
      JSON.stringify(invoice.items || []),
      invoice.taxAmountCents || 0,
      invoice.totalAmountCents,
      invoice.notes || null,
      JSON.stringify(invoice.metadata || {}),
      this.context.region
    ).run();
  }

  // ============================================================================
  // COMPLIANCE MODULE
  // ============================================================================

  async getComplianceCustomer(customerId: string) {
    const table = this.context.region === 'US' ? 'compliance_us_customers' : 'compliance_eu_customers';
    const stmt = this.db.DB_COMPLIANCE.prepare(`
      SELECT * FROM ${table}
      WHERE customer_id = ? AND organization_id = ?
    `);
    return await stmt.bind(customerId, this.context.organizationId).first();
  }

  async createComplianceCustomer(customer: any) {
    const table = this.context.region === 'US' ? 'compliance_us_customers' : 'compliance_eu_customers';
    const stmt = this.db.DB_COMPLIANCE.prepare(`
      INSERT INTO ${table} (
        id, organization_id, customer_id, verification_status, kyc_level,
        risk_score, documents, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      customer.id,
      this.context.organizationId,
      customer.customerId,
      customer.verificationStatus || 'pending',
      customer.kycLevel || 1,
      customer.riskScore || 0,
      JSON.stringify(customer.documents || []),
      JSON.stringify(customer.metadata || {}),
      this.context.region
    ).run();
  }

  async createComplianceCheck(check: any) {
    const table = this.context.region === 'US' ? 'compliance_us_checks' : 'compliance_eu_checks';
    const stmt = this.db.DB_COMPLIANCE.prepare(`
      INSERT INTO ${table} (
        id, organization_id, customer_id, check_type, status,
        provider, request_data, response_data, risk_score, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      check.id,
      this.context.organizationId,
      check.customerId,
      check.checkType,
      check.status || 'pending',
      check.provider,
      JSON.stringify(check.requestData || {}),
      JSON.stringify(check.responseData || {}),
      check.riskScore || 0,
      JSON.stringify(check.metadata || {}),
      this.context.region
    ).run();
  }

  // ============================================================================
  // INTELLIGENCE MODULE
  // ============================================================================

  async getIntelligenceAccounts() {
    const table = this.context.region === 'US' ? 'intelligence_us_accounts' : 'intelligence_eu_accounts';
    const stmt = this.db.DB_PRIMARY.prepare(`
      SELECT * FROM ${table}
      WHERE organization_id = ? AND status = 'active'
      ORDER BY created_at DESC
    `);
    return await stmt.bind(this.context.organizationId).all();
  }

  async createIntelligenceAccount(account: any) {
    const table = this.context.region === 'US' ? 'intelligence_us_accounts' : 'intelligence_eu_accounts';
    const stmt = this.db.DB_PRIMARY.prepare(`
      INSERT INTO ${table} (
        id, organization_id, account_number, account_type, balance_cents,
        currency, status, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      account.id,
      this.context.organizationId,
      account.accountNumber || null,
      account.accountType,
      account.balanceCents || 0,
      account.currency || (this.context.region === 'US' ? 'USD' : 'EUR'),
      account.status || 'active',
      JSON.stringify(account.metadata || {}),
      this.context.region
    ).run();
  }

  async createIntelligenceTransaction(transaction: any) {
    const table = this.context.region === 'US' ? 'intelligence_us_transactions' : 'intelligence_eu_transactions';
    const stmt = this.db.DB_PRIMARY.prepare(`
      INSERT INTO ${table} (
        id, organization_id, account_id, amount_cents, currency,
        transaction_type, description, category, subcategory, tags,
        counterparty, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      transaction.id,
      this.context.organizationId,
      transaction.accountId,
      transaction.amountCents,
      transaction.currency || (this.context.region === 'US' ? 'USD' : 'EUR'),
      transaction.transactionType,
      transaction.description || null,
      transaction.category || null,
      transaction.subcategory || null,
      JSON.stringify(transaction.tags || []),
      transaction.counterparty || null,
      JSON.stringify(transaction.metadata || {}),
      this.context.region
    ).run();
  }

  async getTransactionsByAccount(accountId: string, limit = 50) {
    const table = this.context.region === 'US' ? 'intelligence_us_transactions' : 'intelligence_eu_transactions';
    const stmt = this.db.DB_PRIMARY.prepare(`
      SELECT * FROM ${table}
      WHERE account_id = ? AND organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return await stmt.bind(accountId, this.context.organizationId, limit).all();
  }

  // ============================================================================
  // RISK MODULE
  // ============================================================================

  async createRiskAssessment(assessment: any) {
    const stmt = this.db.DB_SECONDARY.prepare(`
      INSERT INTO risk_assessments (
        id, organization_id, customer_id, transaction_id, risk_score,
        risk_level, factors, status, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      assessment.id,
      this.context.organizationId,
      assessment.customerId,
      assessment.transactionId || null,
      assessment.riskScore,
      assessment.riskLevel,
      JSON.stringify(assessment.factors || []),
      assessment.status || 'active',
      JSON.stringify(assessment.metadata || {}),
      this.context.region
    ).run();
  }

  async getRiskAssessments(customerId?: string, riskLevel?: string) {
    let query = `
      SELECT * FROM risk_assessments
      WHERE organization_id = ? AND region = ?
    `;
    const params = [this.context.organizationId, this.context.region];

    if (customerId) {
      query += ' AND customer_id = ?';
      params.push(customerId);
    }

    if (riskLevel) {
      query += ' AND risk_level = ?';
      params.push(riskLevel);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.DB_SECONDARY.prepare(query);
    return await stmt.bind(...params).all();
  }

  async createRiskAlert(alert: any) {
    const stmt = this.db.DB_SECONDARY.prepare(`
      INSERT INTO risk_alerts (
        id, organization_id, assessment_id, alert_type, severity,
        message, status, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      alert.id,
      this.context.organizationId,
      alert.assessmentId,
      alert.alertType,
      alert.severity,
      alert.message,
      alert.status || 'open',
      JSON.stringify(alert.metadata || {}),
      this.context.region
    ).run();
  }

  // ============================================================================
  // SHARED TABLES
  // ============================================================================

  async getOrganization() {
    const stmt = this.db.DB_SECONDARY.prepare(`
      SELECT * FROM organizations
      WHERE id = ? AND status = 'active'
    `);
    return await stmt.bind(this.context.organizationId).first();
  }

  async createAuditLog(log: any) {
    const stmt = this.db.DB_SECONDARY.prepare(`
      INSERT INTO audit_logs (
        id, organization_id, user_id, action, resource_type, resource_id,
        old_values, new_values, ip_address, user_agent, metadata, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return await stmt.bind(
      log.id,
      this.context.organizationId,
      log.userId || null,
      log.action,
      log.resourceType,
      log.resourceId || null,
      JSON.stringify(log.oldValues || {}),
      JSON.stringify(log.newValues || {}),
      log.ipAddress || null,
      log.userAgent || null,
      JSON.stringify(log.metadata || {}),
      this.context.region
    ).run();
  }

  // ============================================================================
  // ANALYTICS AND REPORTING
  // ============================================================================

  async getBillingSummary(startDate?: string, endDate?: string) {
    const table = this.context.region === 'US' ? 'billing_us_invoices' : 'billing_eu_invoices';
    let query = `
      SELECT
        COUNT(*) as total_invoices,
        SUM(total_amount_cents) as total_revenue,
        AVG(total_amount_cents) as avg_invoice_amount,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices
      FROM ${table}
      WHERE organization_id = ?
    `;
    const params = [this.context.organizationId];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    const stmt = this.db.DB_PRIMARY.prepare(query);
    return await stmt.bind(...params).first();
  }

  async getComplianceMetrics() {
    const customerTable = this.context.region === 'US' ? 'compliance_us_customers' : 'compliance_eu_customers';
    const checksTable = this.context.region === 'US' ? 'compliance_us_checks' : 'compliance_eu_checks';

    const stmt = this.db.DB_COMPLIANCE.prepare(`
      SELECT
        COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_customers,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_customers,
        COUNT(CASE WHEN verification_status = 'rejected' THEN 1 END) as rejected_customers,
        AVG(risk_score) as avg_risk_score,
        COUNT(*) as total_customers
      FROM ${customerTable}
      WHERE organization_id = ?
    `);
    return await stmt.bind(this.context.organizationId).first();
  }

  // Utility method to execute custom queries
  async executeQuery(database: 'PRIMARY' | 'SECONDARY' | 'COMPLIANCE', query: string, params: any[] = []) {
    const db = this.db[`DB_${database}`];
    const stmt = db.prepare(query);
    return await stmt.bind(...params).all();
  }
}

// Factory function to create database client
export function createDatabaseClient(db: DatabaseBindings, organizationId: string, region: 'US' | 'EU' = 'US') {
  return new FinTechDatabase(db, { organizationId, region });
}