/**
 * Billing Agent
 * Autonomous AI-powered billing and payment automation specialist
 */

import { BaseAgent, AgentGoal, AgentPlan, AgentCapability, AgentContext } from './agent-framework';
import type { Env, Invoice, Payment, Customer, Subscription } from '../types';

export interface BillingTask {
  type: 'invoice_creation' | 'payment_processing' | 'subscription_management' | 'reconciliation' | 'reminder';
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
}

export interface BillingInsight {
  type: 'payment_pattern' | 'cash_flow' | 'customer_behavior' | 'revenue_anomaly';
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  recommendation?: string;
  data?: any;
}

/**
 * Billing Agent Class
 * Specializes in automated billing, payment processing, and financial reconciliation
 */
export class BillingAgent extends BaseAgent {
  private billingKnowledge: Map<string, any> = new Map();
  private customerProfiles: Map<string, any> = new Map();
  private paymentPatterns: Map<string, any[]> = new Map();

  constructor(context: AgentContext) {
    super('billing-agent-001', 'Billing Agent', 'billing', context);
    this.initializeBillingKnowledge();
  }

  /**
   * Get agent capabilities
   */
  protected getCapabilities(): AgentCapability[] {
    return [
      {
        name: 'invoice_processing',
        description: 'Create, validate, and process invoices with AI automation',
        enabled: true,
        confidence: 0.95,
        tools: ['invoice_generator', 'tax_calculator', 'validator'],
        permissions: ['billing.write', 'billing.read'],
      },
      {
        name: 'payment_orchestration',
        description: 'Manage payment processing across multiple providers',
        enabled: true,
        confidence: 0.92,
        tools: ['payment_gateway', 'webhook_handler', 'reconciliation'],
        permissions: ['billing.write', 'billing.read'],
      },
      {
        name: 'subscription_management',
        description: 'Handle subscription lifecycle and billing cycles',
        enabled: true,
        confidence: 0.88,
        tools: ['subscription_manager', 'proration_calculator', 'renewal_handler'],
        permissions: ['billing.write', 'billing.read'],
      },
      {
        name: 'financial_reconciliation',
        description: 'Reconcile payments and generate financial reports',
        enabled: true,
        confidence: 0.85,
        tools: ['reconciliation_engine', 'report_generator', 'anomaly_detector'],
        permissions: ['billing.write', 'billing.read'],
      },
      {
        name: 'customer_insights',
        description: 'Analyze customer payment behavior and patterns',
        enabled: true,
        confidence: 0.80,
        tools: ['behavior_analyzer', 'pattern_detector', 'predictor'],
        permissions: ['billing.read', 'analytics.read'],
      },
      {
        name: 'automated_communications',
        description: 'Send payment reminders and billing notifications',
        enabled: true,
        confidence: 0.90,
        tools: ['email_sender', 'sms_sender', 'notification_manager'],
        permissions: ['billing.write', 'communications.write'],
      },
    ];
  }

  /**
   * Generate execution plan for billing goals
   */
  protected async generatePlanSteps(goal: AgentGoal): Promise<AgentPlan['steps']> {
    const steps: AgentPlan['steps'] = [];

    switch (goal.description.toLowerCase().split(' ')[0]) {
      case 'create':
      case 'generate':
        steps.push(...await this.planInvoiceCreation(goal));
        break;
      case 'process':
      case 'handle':
        steps.push(...await this.planPaymentProcessing(goal));
        break;
      case 'manage':
      case 'update':
        steps.push(...await this.planSubscriptionManagement(goal));
        break;
      case 'reconcile':
      case 'reconcilation':
        steps.push(...await this.planReconciliation(goal));
        break;
      case 'analyze':
      case 'report':
        steps.push(...await this.planFinancialAnalysis(goal));
        break;
      default:
        steps.push(...await this.planGeneralBillingTask(goal));
    }

    return steps;
  }

  /**
   * Execute individual steps
   */
  protected async executeStep(step: AgentPlan['steps'][0]): Promise<any> {
    this.updateHealth();

    switch (step.tool) {
      case 'invoice_generator':
        return await this.generateInvoice(step.parameters);
      case 'tax_calculator':
        return await this.calculateTaxes(step.parameters);
      case 'payment_gateway':
        return await this.processPayment(step.parameters);
      case 'subscription_manager':
        return await this.manageSubscription(step.parameters);
      case 'reconciliation_engine':
        return await this.reconcileTransactions(step.parameters);
      case 'behavior_analyzer':
        return await this.analyzeCustomerBehavior(step.parameters);
      case 'email_sender':
        return await this.sendBillingEmail(step.parameters);
      case 'anomaly_detector':
        return await this.detectAnomalies(step.parameters);
      default:
        throw new Error(`Unknown tool: ${step.tool}`);
    }
  }

  /**
   * Check if collaboration is needed
   */
  protected async checkCollaborationNeeds(step: AgentPlan['steps'][0]): Promise<string | null> {
    // High-value transactions need risk agent collaboration
    if (step.tool === 'payment_gateway' && step.parameters.amount > 10000) {
      return 'risk';
    }

    // Complex subscriptions need intelligence agent analysis
    if (step.tool === 'subscription_manager' && step.parameters.complexity === 'high') {
      return 'intelligence';
    }

    // International payments need compliance agent
    if (step.tool === 'payment_gateway' && step.parameters.international) {
      return 'compliance';
    }

    return null;
  }

  /**
   * Analyze execution results
   */
  protected async analyzeResults(results: any[]): Promise<any[]> {
    const insights: BillingInsight[] = [];

    for (const result of results) {
      if (result.type === 'payment_processed') {
        const paymentInsights = await this.analyzePaymentPattern(result);
        insights.push(...paymentInsights);
      } else if (result.type === 'invoice_created') {
        const invoiceInsights = await this.analyzeInvoicePattern(result);
        insights.push(...invoiceInsights);
      } else if (result.type === 'subscription_updated') {
        const subscriptionInsights = await this.analyzeSubscriptionPattern(result);
        insights.push(...subscriptionInsights);
      }
    }

    return insights;
  }

  /**
   * Plan invoice creation workflow
   */
  private async planInvoiceCreation(goal: AgentGoal): Promise<AgentPlan['steps']> {
    return [
      {
        id: 'validate_invoice_data',
        description: 'Validate invoice data and requirements',
        tool: 'validator',
        parameters: { data: goal.constraints?.invoice_data },
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'calculate_taxes',
        description: 'Calculate applicable taxes and fees',
        tool: 'tax_calculator',
        parameters: {
          customer_id: goal.constraints?.customer_id,
          amount: goal.constraints?.amount,
          location: goal.constraints?.location,
        },
        dependencies: ['validate_invoice_data'],
        status: 'pending',
      },
      {
        id: 'generate_invoice',
        description: 'Generate invoice with proper formatting',
        tool: 'invoice_generator',
        parameters: {
          template: goal.constraints?.template || 'standard',
          data: goal.constraints?.invoice_data,
          taxes: 'previous_step_result',
        },
        dependencies: ['calculate_taxes'],
        status: 'pending',
      },
      {
        id: 'store_invoice',
        description: 'Store invoice in database and update records',
        tool: 'database_storage',
        parameters: { invoice: 'previous_step_result' },
        dependencies: ['generate_invoice'],
        status: 'pending',
      },
      {
        id: 'send_notification',
        description: 'Send invoice to customer',
        tool: 'email_sender',
        parameters: {
          recipient: goal.constraints?.customer_email,
          template: 'invoice_created',
          data: { invoice_id: 'previous_step_result.id' },
        },
        dependencies: ['store_invoice'],
        status: 'pending',
      },
    ];
  }

  /**
   * Plan payment processing workflow
   */
  private async planPaymentProcessing(goal: AgentGoal): Promise<AgentPlan['steps']> {
    return [
      {
        id: 'validate_payment_request',
        description: 'Validate payment request and security checks',
        tool: 'validator',
        parameters: { payment_data: goal.constraints?.payment_data },
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'check_fraud_risk',
        description: 'Check for fraud risk and suspicious activity',
        tool: 'anomaly_detector',
        parameters: {
          transaction: goal.constraints?.payment_data,
          customer_id: goal.constraints?.customer_id,
        },
        dependencies: ['validate_payment_request'],
        status: 'pending',
      },
      {
        id: 'process_payment',
        description: 'Process payment through appropriate gateway',
        tool: 'payment_gateway',
        parameters: {
          amount: goal.constraints?.amount,
          method: goal.constraints?.payment_method,
          customer_id: goal.constraints?.customer_id,
        },
        dependencies: ['check_fraud_risk'],
        status: 'pending',
      },
      {
        id: 'update_records',
        description: 'Update payment records and customer balance',
        tool: 'database_storage',
        parameters: { payment_result: 'previous_step_result' },
        dependencies: ['process_payment'],
        status: 'pending',
      },
      {
        id: 'send_receipt',
        description: 'Send payment confirmation to customer',
        tool: 'email_sender',
        parameters: {
          recipient: goal.constraints?.customer_email,
          template: 'payment_confirmation',
          data: { payment_id: 'previous_step_result.id' },
        },
        dependencies: ['update_records'],
        status: 'pending',
      },
    ];
  }

  /**
   * Plan subscription management workflow
   */
  private async planSubscriptionManagement(goal: AgentGoal): Promise<AgentPlan['steps']> {
    return [
      {
        id: 'validate_subscription_request',
        description: 'Validate subscription change request',
        tool: 'validator',
        parameters: { subscription_data: goal.constraints?.subscription_data },
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'calculate_proration',
        description: 'Calculate proration and billing adjustments',
        tool: 'proration_calculator',
        parameters: {
          subscription_id: goal.constraints?.subscription_id,
          new_plan: goal.constraints?.new_plan,
          change_date: goal.constraints?.change_date,
        },
        dependencies: ['validate_subscription_request'],
        status: 'pending',
      },
      {
        id: 'update_subscription',
        description: 'Update subscription in database',
        tool: 'subscription_manager',
        parameters: {
          subscription_id: goal.constraints?.subscription_id,
          updates: goal.constraints?.updates,
          proration: 'previous_step_result',
        },
        dependencies: ['calculate_proration'],
        status: 'pending',
      },
      {
        id: 'schedule_billing',
        description: 'Schedule next billing date and amount',
        tool: 'subscription_manager',
        parameters: {
          subscription_id: goal.constraints?.subscription_id,
          new_billing_date: 'calculated_date',
        },
        dependencies: ['update_subscription'],
        status: 'pending',
      },
      {
        id: 'notify_customer',
        description: 'Notify customer of subscription changes',
        tool: 'email_sender',
        parameters: {
          recipient: goal.constraints?.customer_email,
          template: 'subscription_updated',
          data: { changes: goal.constraints?.updates },
        },
        dependencies: ['schedule_billing'],
        status: 'pending',
      },
    ];
  }

  /**
   * Plan reconciliation workflow
   */
  private async planReconciliation(goal: AgentGoal): Promise<AgentPlan['steps']> {
    return [
      {
        id: 'import_transactions',
        description: 'Import transactions from payment providers',
        tool: 'data_importer',
        parameters: {
          providers: goal.constraints?.providers || ['stripe', 'paypal'],
          date_range: goal.constraints?.date_range,
        },
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'match_transactions',
        description: 'Match transactions with invoices and payments',
        tool: 'reconciliation_engine',
        parameters: {
          transactions: 'previous_step_result',
          matching_algorithm: 'fuzzy_matching',
        },
        dependencies: ['import_transactions'],
        status: 'pending',
      },
      {
        id: 'identify_discrepancies',
        description: 'Identify and categorize reconciliation discrepancies',
        tool: 'anomaly_detector',
        parameters: {
          matches: 'previous_step_result',
          tolerance_threshold: 0.01,
        },
        dependencies: ['match_transactions'],
        status: 'pending',
      },
      {
        id: 'generate_reports',
        description: 'Generate reconciliation reports',
        tool: 'report_generator',
        parameters: {
          report_type: 'reconciliation',
          data: 'previous_step_result',
          format: 'pdf',
        },
        dependencies: ['identify_discrepancies'],
        status: 'pending',
      },
      {
        id: 'update_ledger',
        description: 'Update general ledger with reconciled transactions',
        tool: 'database_storage',
        parameters: {
          transactions: 'previous_step_result.matched_transactions',
        },
        dependencies: ['generate_reports'],
        status: 'pending',
      },
    ];
  }

  /**
   * Plan financial analysis workflow
   */
  private async planFinancialAnalysis(goal: AgentGoal): Promise<AgentPlan['steps']> {
    return [
      {
        id: 'gather_billing_data',
        description: 'Gather billing and payment data for analysis',
        tool: 'data_collector',
        parameters: {
          date_range: goal.constraints?.date_range || 'last_30_days',
          metrics: goal.constraints?.metrics || ['revenue', 'payments', 'subscriptions'],
        },
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'analyze_patterns',
        description: 'Analyze payment patterns and trends',
        tool: 'behavior_analyzer',
        parameters: {
          data: 'previous_step_result',
          analysis_type: 'payment_patterns',
        },
        dependencies: ['gather_billing_data'],
        status: 'pending',
      },
      {
        id: 'detect_anomalies',
        description: 'Detect unusual patterns and anomalies',
        tool: 'anomaly_detector',
        parameters: {
          data: 'previous_step_result',
          sensitivity: 'medium',
        },
        dependencies: ['analyze_patterns'],
        status: 'pending',
      },
      {
        id: 'generate_insights',
        description: 'Generate AI-powered insights and recommendations',
        tool: 'insight_generator',
        parameters: {
          patterns: 'previous_step_result',
          anomalies: 'previous_step_result',
        },
        dependencies: ['detect_anomalies'],
        status: 'pending',
      },
      {
        id: 'create_dashboard',
        description: 'Create financial dashboard and visualizations',
        tool: 'dashboard_generator',
        parameters: {
          insights: 'previous_step_result',
          charts: goal.constraints?.charts || ['revenue_trend', 'payment_methods'],
        },
        dependencies: ['generate_insights'],
        status: 'pending',
      },
    ];
  }

  /**
   * Plan general billing task
   */
  private async planGeneralBillingTask(goal: AgentGoal): Promise<AgentPlan['steps']> {
    return [
      {
        id: 'analyze_goal',
        description: 'Analyze goal requirements and determine approach',
        tool: 'goal_analyzer',
        parameters: { goal: goal.description },
        dependencies: [],
        status: 'pending',
      },
      {
        id: 'execute_billing_task',
        description: 'Execute billing task with appropriate tools',
        tool: 'general_executor',
        parameters: {
          task: goal.description,
          data: goal.constraints,
        },
        dependencies: ['analyze_goal'],
        status: 'pending',
      },
      {
        id: 'validate_result',
        description: 'Validate and document task results',
        tool: 'validator',
        parameters: { result: 'previous_step_result' },
        dependencies: ['execute_billing_task'],
        status: 'pending',
      },
    ];
  }

  // Tool implementation methods
  private async generateInvoice(params: any): Promise<any> {
    // AI-powered invoice generation
    const invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      number: this.generateInvoiceNumber(),
      customer_id: params.customer_id,
      amount: params.data.amount,
      taxes: params.taxes,
      total: params.data.amount + params.taxes.total,
      currency: params.data.currency || 'USD',
      status: 'draft',
      created_at: new Date().toISOString(),
      ai_generated: true,
      confidence_score: 0.95,
    };

    // Store in episodic memory
    this.state.memory.episodic.push({
      timestamp: new Date(),
      context: `Invoice generation for customer ${params.customer_id}`,
      action: 'Generated invoice',
      outcome: `Invoice ${invoice.id} created successfully`,
      learned: ['Invoice template improved'],
    });

    return { type: 'invoice_created', invoice };
  }

  private async calculateTaxes(params: any): Promise<any> {
    // AI-powered tax calculation
    const taxRate = await this.getTaxRate(params.customer_id, params.location);
    const taxes = {
      subtotal: params.amount,
      tax_rate: taxRate,
      tax_amount: params.amount * taxRate,
      total: params.amount + (params.amount * taxRate),
      jurisdiction: params.location,
      calculated_at: new Date().toISOString(),
    };

    return taxes;
  }

  private async processPayment(params: any): Promise<any> {
    // AI-optimized payment processing
    const payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: params.amount,
      method: params.method,
      customer_id: params.customer_id,
      status: 'processing',
      created_at: new Date().toISOString(),
      ai_optimized: true,
    };

    // Store payment pattern
    if (!this.paymentPatterns.has(params.customer_id)) {
      this.paymentPatterns.set(params.customer_id, []);
    }
    this.paymentPatterns.get(params.customer_id)!.push({
      timestamp: new Date(),
      amount: params.amount,
      method: params.method,
    });

    return { type: 'payment_processed', payment };
  }

  private async manageSubscription(params: any): Promise<any> {
    // AI-powered subscription management
    const subscription = {
      id: params.subscription_id,
      status: 'active',
      updated_at: new Date().toISOString(),
      ai_managed: true,
      next_billing_date: params.new_billing_date,
    };

    return { type: 'subscription_updated', subscription };
  }

  private async reconcileTransactions(params: any): Promise<any> {
    // AI-enhanced reconciliation
    const reconciliation = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      matched_transactions: params.transactions || [],
      unmatched_count: 0,
      discrepancies: [],
      completed_at: new Date().toISOString(),
      ai_enhanced: true,
    };

    return { type: 'reconciliation_completed', reconciliation };
  }

  private async analyzeCustomerBehavior(params: any): Promise<any> {
    // AI-powered customer behavior analysis
    const insights = await this.generateCustomerInsights(params.customer_id);
    return { type: 'behavior_analyzed', insights };
  }

  private async sendBillingEmail(params: any): Promise<any> {
    // AI-personalized email sending
    const email = {
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipient: params.recipient,
      template: params.template,
      personalized: true,
      sent_at: new Date().toISOString(),
    };

    return { type: 'email_sent', email };
  }

  private async detectAnomalies(params: any): Promise<any> {
    // AI-powered anomaly detection
    const anomalies = await this.identifyAnomalies(params.transaction);
    return { type: 'anomalies_detected', anomalies };
  }

  // Helper methods
  private initializeBillingKnowledge(): void {
    this.billingKnowledge.set('tax_rates', new Map());
    this.billingKnowledge.set('invoice_templates', new Map());
    this.billingKnowledge.set('payment_methods', ['card', 'bank_transfer', 'crypto']);
    this.billingKnowledge.set('currencies', ['USD', 'EUR', 'GBP']);
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = Math.floor(Math.random() * 9999);
    return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  private async getTaxRate(customerId: string, location: string): Promise<number> {
    // AI-powered tax rate determination
    // This would integrate with tax APIs and use ML for predictions
    return 0.08; // 8% default rate
  }

  private async analyzePaymentPattern(result: any): Promise<BillingInsight[]> {
    const insights: BillingInsight[] = [];

    // Analyze payment amount patterns
    if (result.payment.amount > 5000) {
      insights.push({
        type: 'payment_pattern',
        description: 'High-value payment detected - consider enhanced verification',
        confidence: 0.85,
        impact: 'medium',
        recommendation: 'Implement additional fraud checks for payments over $5000',
      });
    }

    return insights;
  }

  private async analyzeInvoicePattern(result: any): Promise<BillingInsight[]> {
    const insights: BillingInsight[] = [];

    // Analyze invoice generation patterns
    insights.push({
      type: 'revenue_anomaly',
      description: 'Invoice created with AI optimization',
      confidence: 0.90,
      impact: 'low',
    });

    return insights;
  }

  private async analyzeSubscriptionPattern(result: any): Promise<BillingInsight[]> {
    const insights: BillingInsight[] = [];

    // Analyze subscription changes
    insights.push({
      type: 'customer_behavior',
      description: 'Subscription updated with AI assistance',
      confidence: 0.88,
      impact: 'low',
    });

    return insights;
  }

  private async generateCustomerInsights(customerId: string): Promise<any> {
    // AI-powered customer insights generation
    const patterns = this.paymentPatterns.get(customerId) || [];

    return {
      customer_id: customerId,
      payment_frequency: this.calculatePaymentFrequency(patterns),
      preferred_methods: this.getPreferredPaymentMethods(patterns),
      average_amount: this.calculateAverageAmount(patterns),
      reliability_score: this.calculateReliabilityScore(patterns),
    };
  }

  private async identifyAnomalies(transaction: any): Promise<any[]> {
    // AI-powered anomaly identification
    const anomalies = [];

    // Check for unusual amounts
    if (transaction.amount > 10000) {
      anomalies.push({
        type: 'high_amount',
        description: 'Unusually high transaction amount',
        severity: 'medium',
      });
    }

    return anomalies;
  }

  private calculatePaymentFrequency(patterns: any[]): string {
    if (patterns.length === 0) return 'unknown';

    const daysDiff = patterns.length > 1
      ? (new Date(patterns[patterns.length - 1].timestamp).getTime() -
         new Date(patterns[0].timestamp).getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    return daysDiff > 0 ? `${Math.round(patterns.length / daysDiff * 30)}/month` : 'irregular';
  }

  private getPreferredPaymentMethods(patterns: any[]): string[] {
    const methodCounts = new Map<string, number>();

    patterns.forEach(pattern => {
      methodCounts.set(pattern.method, (methodCounts.get(pattern.method) || 0) + 1);
    });

    return Array.from(methodCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([method]) => method);
  }

  private calculateAverageAmount(patterns: any[]): number {
    if (patterns.length === 0) return 0;

    const total = patterns.reduce((sum, pattern) => sum + pattern.amount, 0);
    return total / patterns.length;
  }

  private calculateReliabilityScore(patterns: any[]): number {
    // AI-powered reliability scoring based on payment patterns
    if (patterns.length < 3) return 0.5; // Insufficient data

    // Factors: consistency, timeliness, amount stability
    let score = 0.5;

    // Consistency bonus
    const variance = this.calculateVariance(patterns.map(p => p.amount));
    const avgAmount = this.calculateAverageAmount(patterns);
    if (variance / avgAmount < 0.2) score += 0.2; // Low variance

    // Timeliness bonus (would need due date data)
    score += 0.1; // Placeholder

    // Amount stability bonus
    if (avgAmount > 100) score += 0.1; // Regular payer

    return Math.min(1.0, score);
  }

  private calculateVariance(values: number[]): number {
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - avg, 2));
    return squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
}