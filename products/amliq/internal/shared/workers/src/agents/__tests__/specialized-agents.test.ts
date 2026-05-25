/**
 * Specialized Financial Agents Tests
 *
 * Comprehensive test suite for specialized financial agents including
 * billing, compliance, intelligence, and risk management agents.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BillingAgent } from '../billing-agent';
import { ComplianceAgent } from '../compliance-agent';
import { IntelligenceAgent } from '../intelligence-agent';
import { RiskAgent } from '../risk-agent';
import { AgentGoal } from '../agent-framework';

describe('BillingAgent', () => {
  let billingAgent: BillingAgent;
  const organizationId = 'test-org-billing';
  const agentId = 'billing-agent-123';

  beforeEach(() => {
    billingAgent = new BillingAgent(agentId, organizationId);
  });

  describe('Invoice Processing', () => {
    it('should create and process invoices correctly', async () => {
      const goal: AgentGoal = {
        id: 'invoice-processing-goal',
        description: 'Process customer invoice',
        priority: 'high',
        goal_type: 'invoice_processing',
        parameters: {
          customer_id: 'customer-456',
          amount: 1000,
          currency: 'USD',
          due_date: '2024-02-01',
          line_items: [
            { description: 'Service A', quantity: 1, unit_price: 600 },
            { description: 'Service B', quantity: 2, unit_price: 200 }
          ]
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      const result = await billingAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.invoice_id).toBeDefined();
      expect(result.result.amount).toBe(1000);
      expect(result.result.currency).toBe('USD');
      expect(result.result.status).toBe('created');
    });

    it('should calculate taxes correctly', async () => {
      const goal: AgentGoal = {
        id: 'tax-calculation-goal',
        description: 'Calculate taxes for invoice',
        priority: 'medium',
        goal_type: 'tax_calculation',
        parameters: {
          amount: 1000,
          tax_rate: 0.08,
          customer_location: 'California',
          service_type: 'software'
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      const result = await billingAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.subtotal).toBe(1000);
      expect(result.result.tax_amount).toBe(80);
      expect(result.result.total_amount).toBe(1080);
    });

    it('should handle recurring billing schedules', async () => {
      const goal: AgentGoal = {
        id: 'recurring-billing-goal',
        description: 'Set up recurring billing',
        priority: 'high',
        goal_type: 'recurring_billing_setup',
        parameters: {
          customer_id: 'customer-789',
          amount: 500,
          currency: 'USD',
          billing_cycle: 'monthly',
          start_date: '2024-01-01',
          next_billing_date: '2024-02-01'
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      const result = await billingAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.subscription_id).toBeDefined();
      expect(result.result.next_billing_date).toBe('2024-02-01');
      expect(result.result.status).toBe('active');
    });

    it('should validate invoice data before processing', async () => {
      const invalidGoal: AgentGoal = {
        id: 'invalid-invoice-goal',
        description: 'Process invalid invoice',
        priority: 'medium',
        goal_type: 'invoice_processing',
        parameters: {
          customer_id: '', // Invalid empty customer ID
          amount: -100, // Invalid negative amount
          currency: 'INVALID',
          due_date: 'invalid-date'
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      await expect(billingAgent.executeGoal(invalidGoal)).rejects.toThrow();
    });
  });

  describe('Payment Processing', () => {
    it('should process payment attempts correctly', async () => {
      const goal: AgentGoal = {
        id: 'payment-processing-goal',
        description: 'Process customer payment',
        priority: 'high',
        goal_type: 'payment_processing',
        parameters: {
          invoice_id: 'invoice-123',
          payment_method: 'credit_card',
          amount: 1000,
          currency: 'USD',
          customer_id: 'customer-456'
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      const result = await billingAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.payment_id).toBeDefined();
      expect(result.result.status).toBeOneOf(['pending', 'completed', 'failed']);
      expect(result.result.amount).toBe(1000);
    });

    it('should handle payment failures and retries', async () => {
      const goal: AgentGoal = {
        id: 'payment-retry-goal',
        description: 'Retry failed payment',
        priority: 'high',
        goal_type: 'payment_retry',
        parameters: {
          invoice_id: 'invoice-456',
          original_payment_id: 'payment-789',
          retry_reason: 'insufficient_funds',
          max_retries: 3
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      const result = await billingAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.retry_count).toBeGreaterThanOrEqual(0);
      expect(result.result.retry_count).toBeLessThanOrEqual(3);
    });

    it('should manage subscription billing cycles', async () => {
      const goal: AgentGoal = {
        id: 'subscription-cycle-goal',
        description: 'Process subscription billing cycle',
        priority: 'medium',
        goal_type: 'subscription_cycle',
        parameters: {
          subscription_id: 'sub-123',
          cycle_date: '2024-02-01',
          amount: 500,
          currency: 'USD'
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      const result = await billingAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.billing_date).toBe('2024-02-01');
      expect(result.result.next_billing_date).toBeDefined();
    });
  });

  describe('Financial Reporting', () => {
    it('should generate billing reports', async () => {
      const goal: AgentGoal = {
        id: 'billing-report-goal',
        description: 'Generate monthly billing report',
        priority: 'low',
        goal_type: 'billing_report',
        parameters: {
          report_type: 'monthly',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
          include_metrics: ['revenue', 'invoices', 'payments', 'failed_payments']
        },
        created_at: Date.now(),
        created_by: 'billing-system'
      };

      const result = await billingAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.report_id).toBeDefined();
      expect(result.result.total_revenue).toBeGreaterThanOrEqual(0);
      expect(result.result.total_invoices).toBeGreaterThanOrEqual(0);
      expect(result.result.total_payments).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('ComplianceAgent', () => {
  let complianceAgent: ComplianceAgent;
  const organizationId = 'test-org-compliance';
  const agentId = 'compliance-agent-456';

  beforeEach(() => {
    complianceAgent = new ComplianceAgent(agentId, organizationId);
  });

  describe('KYC Verification', () => {
    it('should perform KYC verification', async () => {
      const goal: AgentGoal = {
        id: 'kyc-verification-goal',
        description: 'Perform KYC verification for customer',
        priority: 'high',
        goal_type: 'kyc_verification',
        parameters: {
          customer_id: 'customer-789',
          documents: [
            { type: 'passport', document_id: 'doc-123', status: 'uploaded' },
            { type: 'utility_bill', document_id: 'doc-456', status: 'uploaded' }
          ],
          personal_info: {
            name: 'John Doe',
            date_of_birth: '1990-01-01',
            address: '123 Main St, City, State'
          }
        },
        created_at: Date.now(),
        created_by: 'compliance-system'
      };

      const result = await complianceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.verification_id).toBeDefined();
      expect(result.result.status).toBeOneOf(['approved', 'rejected', 'pending_review']);
      expect(result.result.risk_score).toBeGreaterThanOrEqual(0);
      expect(result.result.risk_score).toBeLessThanOrEqual(1);
    });

    it('should handle document validation', async () => {
      const goal: AgentGoal = {
        id: 'document-validation-goal',
        description: 'Validate uploaded documents',
        priority: 'medium',
        goal_type: 'document_validation',
        parameters: {
          documents: [
            {
              type: 'passport',
              document_id: 'doc-passport',
              extracted_data: {
                document_number: 'P123456789',
                expiration_date: '2025-01-01',
                issuing_country: 'US'
              }
            }
          ]
        },
        created_at: Date.now(),
        created_by: 'compliance-system'
      };

      const result = await complianceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.validation_results).toBeDefined();
      expect(result.result.validation_results[0].document_type).toBe('passport');
      expect(result.result.validation_results[0].is_valid).toBeDefined();
    });

    it('should detect suspicious activities', async () => {
      const goal: AgentGoal = {
        id: 'suspicious-activity-goal',
        description: 'Analyze transaction for suspicious activity',
        priority: 'high',
        goal_type: 'suspicious_activity_detection',
        parameters: {
          transaction_id: 'txn-suspicious-123',
          amount: 50000,
          customer_id: 'customer-high-risk',
          transaction_pattern: 'large_unusual_amount',
          risk_indicators: ['high_amount', 'new_customer', 'unusual_timing']
        },
        created_at: Date.now(),
        created_by: 'compliance-system'
      };

      const result = await complianceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.suspicious_activity_score).toBeGreaterThanOrEqual(0);
      expect(result.result.requires_manual_review).toBeDefined();
      expect(result.result.recommended_actions).toBeDefined();
    });
  });

  describe('Sanctions Screening', () => {
    it('should screen customers against sanctions lists', async () => {
      const goal: AgentGoal = {
        id: 'sanctions-screening-goal',
        description: 'Screen customer against sanctions lists',
        priority: 'high',
        goal_type: 'sanctions_screening',
        parameters: {
          customer_info: {
            name: 'John Smith',
            date_of_birth: '1980-05-15',
            nationality: 'US',
            addresses: ['123 Main St, New York, NY']
          },
          screening_lists: ['OFAC', 'UN', 'EU', 'HMT']
        },
        created_at: Date.now(),
        created_by: 'compliance-system'
      };

      const result = await complianceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.screening_id).toBeDefined();
      expect(result.result.matches).toBeDefined();
      expect(result.result.overall_risk_level).toBeOneOf(['low', 'medium', 'high']);
    });

    it('should handle adverse media monitoring', async () => {
      const goal: AgentGoal = {
        id: 'adverse-media-goal',
        description: 'Monitor adverse media for customer',
        priority: 'medium',
        goal_type: 'adverse_media_monitoring',
        parameters: {
          customer_id: 'customer-media-123',
          search_terms: ['John Smith Company', 'Smith Enterprises'],
          time_period: 'last_30_days',
          sources: ['news', 'social_media', 'regulatory']
        },
        created_at: Date.now(),
        created_by: 'compliance-system'
      };

      const result = await complianceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.media_hits).toBeDefined();
      expect(result.result.sentiment_analysis).toBeDefined();
      expect(result.result.risk_impact).toBeDefined();
    });
  });

  describe('Compliance Reporting', () => {
    it('should generate regulatory reports', async () => {
      const goal: AgentGoal = {
        id: 'compliance-report-goal',
        description: 'Generate quarterly compliance report',
        priority: 'low',
        goal_type: 'compliance_report',
        parameters: {
          report_type: 'quarterly',
          quarter: 'Q1',
          year: 2024,
          include_sections: ['kyc_summary', 'sanctions_screening', 'suspicious_activities', 'audit_trail']
        },
        created_at: Date.now(),
        created_by: 'compliance-system'
      };

      const result = await complianceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.report_id).toBeDefined();
      expect(result.result.kyc_summary).toBeDefined();
      expect(result.result.sanctions_screening_summary).toBeDefined();
      expect(result.result.compliance_score).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('IntelligenceAgent', () => {
  let intelligenceAgent: IntelligenceAgent;
  const organizationId = 'test-org-intelligence';
  const agentId = 'intelligence-agent-789';

  beforeEach(() => {
    intelligenceAgent = new IntelligenceAgent(agentId, organizationId);
  });

  describe('Financial Analysis', () => {
    it('should analyze financial data patterns', async () => {
      const goal: AgentGoal = {
        id: 'financial-analysis-goal',
        description: 'Analyze financial data patterns',
        priority: 'medium',
        goal_type: 'financial_analysis',
        parameters: {
          data_source: 'transactions',
          time_period: 'last_30_days',
          analysis_type: 'spending_patterns',
          customer_id: 'customer-analysis-123'
        },
        created_at: Date.now(),
        created_by: 'intelligence-system'
      };

      const result = await intelligenceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.analysis_id).toBeDefined();
      expect(result.result.patterns_detected).toBeDefined();
      expect(result.result.insights).toBeDefined();
      expect(result.result.confidence_score).toBeGreaterThanOrEqual(0);
    });

    it('should perform cash flow forecasting', async () => {
      const goal: AgentGoal = {
        id: 'cash-flow-forecast-goal',
        description: 'Forecast cash flow for next quarter',
        priority: 'high',
        goal_type: 'cash_flow_forecasting',
        parameters: {
          forecast_period: 'quarter',
          historical_data_period: 'last_12_months',
          variables: ['revenue', 'expenses', 'seasonal_factors'],
          confidence_level: 0.95
        },
        created_at: Date.now(),
        created_by: 'intelligence-system'
      };

      const result = await intelligenceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.forecast_id).toBeDefined();
      expect(result.result.predicted_cash_flow).toBeDefined();
      expect(result.result.confidence_intervals).toBeDefined();
      expect(result.result.key_drivers).toBeDefined();
    });

    it('should categorize expenses automatically', async () => {
      const goal: AgentGoal = {
        id: 'expense-categorization-goal',
        description: 'Categorize transactions automatically',
        priority: 'medium',
        goal_type: 'expense_categorization',
        parameters: {
          transactions: [
            { description: 'Office rent payment', amount: 5000, date: '2024-01-01' },
            { description: 'Software subscription', amount: 100, date: '2024-01-02' },
            { description: 'Client dinner', amount: 150, date: '2024-01-03' }
          ],
          categorization_model: 'enhanced_ml'
        },
        created_at: Date.now(),
        created_by: 'intelligence-system'
      };

      const result = await intelligenceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.categorized_transactions).toBeDefined();
      expect(result.result.categorized_transactions.length).toBe(3);
      expect(result.result.categorization_accuracy).toBeGreaterThan(0.8);
    });
  });

  describe('Revenue Optimization', () => {
    it('should identify revenue optimization opportunities', async () => {
      const goal: AgentGoal = {
        id: 'revenue-optimization-goal',
        description: 'Identify revenue optimization opportunities',
        priority: 'high',
        goal_type: 'revenue_optimization',
        parameters: {
          business_metrics: ['customer_lifetime_value', 'churn_rate', 'upsell_potential'],
          time_period: 'last_6_months',
          optimization_focus: 'pricing_strategies'
        },
        created_at: Date.now(),
        created_by: 'intelligence-system'
      };

      const result = await intelligenceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.optimization_opportunities).toBeDefined();
      expect(result.result.potential_revenue_increase).toBeDefined();
      expect(result.result.recommendations).toBeDefined();
      expect(result.result.implementation_priority).toBeDefined();
    });

    it('should analyze customer profitability', async () => {
      const goal: AgentGoal = {
        id: 'customer-profitability-goal',
        description: 'Analyze customer profitability',
        priority: 'medium',
        goal_type: 'customer_profitability_analysis',
        parameters: {
          customer_segment: 'enterprise',
          time_period: 'last_12_months',
          metrics: ['revenue', 'costs', 'support_costs', 'acquisition_costs']
        },
        created_at: Date.now(),
        created_by: 'intelligence-system'
      };

      const result = await intelligenceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.profitability_scores).toBeDefined();
      expect(result.result.segment_insights).toBeDefined();
      expect(result.result.actionable_recommendations).toBeDefined();
    });
  });

  describe('Market Intelligence', () => {
    it('should analyze market trends', async () => {
      const goal: AgentGoal = {
        id: 'market-trends-goal',
        description: 'Analyze market trends and competitive landscape',
        priority: 'low',
        goal_type: 'market_intelligence',
        parameters: {
          industry: 'fintech',
          market_segments: ['payments', 'lending', 'wealth_management'],
          time_period: 'last_90_days',
          competitors: ['competitor_a', 'competitor_b']
        },
        created_at: Date.now(),
        created_by: 'intelligence-system'
      };

      const result = await intelligenceAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.market_trends).toBeDefined();
      expect(result.result.competitive_analysis).toBeDefined();
      expect(result.result.opportunity_areas).toBeDefined();
      expect(result.result.threat_assessment).toBeDefined();
    });
  });
});

describe('RiskAgent', () => {
  let riskAgent: RiskAgent;
  const organizationId = 'test-org-risk';
  const agentId = 'risk-agent-101';

  beforeEach(() => {
    riskAgent = new RiskAgent(agentId, organizationId);
  });

  describe('Transaction Monitoring', () => {
    it('should monitor transactions for risk', async () => {
      const goal: AgentGoal = {
        id: 'transaction-monitoring-goal',
        description: 'Monitor high-value transaction for risk',
        priority: 'high',
        goal_type: 'transaction_monitoring',
        parameters: {
          transaction_id: 'txn-risk-123',
          amount: 25000,
          customer_id: 'customer-risk-456',
          transaction_type: 'wire_transfer',
          destination_country: 'high_risk_country',
          risk_indicators: ['high_amount', 'high_risk_destination', 'unusual_timing']
        },
        created_at: Date.now(),
        created_by: 'risk-system'
      };

      const result = await riskAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.risk_score).toBeGreaterThanOrEqual(0);
      expect(result.result.risk_level).toBeOneOf(['low', 'medium', 'high', 'critical']);
      expect(result.result.alert_triggered).toBeDefined();
      expect(result.result.investigation_required).toBeDefined();
    });

    it('should detect fraudulent patterns', async () => {
      const goal: AgentGoal = {
        id: 'fraud-detection-goal',
        description: 'Detect fraudulent transaction patterns',
        priority: 'critical',
        goal_type: 'fraud_detection',
        parameters: {
          customer_transactions: [
            { amount: 100, timestamp: Date.now() - 3600000, location: 'NY' },
            { amount: 5000, timestamp: Date.now() - 1800000, location: 'CA' },
            { amount: 10000, timestamp: Date.now(), location: 'TX' }
          ],
          customer_id: 'customer-fraud-suspect',
          pattern_indicators: ['rapid_succession', 'geographic_impossibility', 'amount_increase']
        },
        created_at: Date.now(),
        created_by: 'risk-system'
      };

      const result = await riskAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.fraud_probability).toBeGreaterThanOrEqual(0);
      expect(result.result.fraud_probability).toBeLessThanOrEqual(1);
      expect(result.result.detected_patterns).toBeDefined();
      expect(result.result.recommended_action).toBeDefined();
    });

    it('should perform real-time risk assessment', async () => {
      const goal: AgentGoal = {
        id: 'real-time-risk-goal',
        description: 'Real-time risk assessment for transaction',
        priority: 'critical',
        goal_type: 'real_time_risk_assessment',
        parameters: {
          transaction: {
            id: 'txn-realtime-789',
            amount: 15000,
            origin: 'US',
            destination: 'MX',
            customer_risk_profile: 'medium'
          },
          assessment_timeout: 5000
        },
        created_at: Date.now(),
        created_by: 'risk-system'
      };

      const result = await riskAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.assessment_completed_within_timeout).toBe(true);
      expect(result.result.risk_decision).toBeOneOf(['approve', 'decline', 'manual_review']);
      expect(result.result.assessment_time_ms).toBeLessThan(5000);
    });
  });

  describe('Risk Management', () => {
    it('should calculate comprehensive risk scores', async () => {
      const goal: AgentGoal = {
        id: 'risk-scoring-goal',
        description: 'Calculate comprehensive risk score for customer',
        priority: 'medium',
        goal_type: 'risk_scoring',
        parameters: {
          customer_id: 'customer-score-123',
          risk_factors: {
            credit_score: 750,
            transaction_history: 'clean',
            geographic_risk: 'low',
            industry_risk: 'medium',
            aml_risk: 'low'
          },
          scoring_model: 'comprehensive_v2'
        },
        created_at: Date.now(),
        created_by: 'risk-system'
      };

      const result = await riskAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.overall_risk_score).toBeGreaterThanOrEqual(0);
      expect(result.result.overall_risk_score).toBeLessThanOrEqual(1);
      expect(result.result.risk_breakdown).toBeDefined();
      expect(result.result.risk_category).toBeOneOf(['low', 'medium', 'high']);
    });

    it('should generate risk reports', async () => {
      const goal: AgentGoal = {
        id: 'risk-report-goal',
        description: 'Generate monthly risk report',
        priority: 'low',
        goal_type: 'risk_report',
        parameters: {
          report_period: 'monthly',
          month: 'January',
          year: 2024,
          include_sections: [
            'transaction_risks',
            'fraud_trends',
            'compliance_violations',
            'risk_mitigation_actions'
          ]
        },
        created_at: Date.now(),
        created_by: 'risk-system'
      };

      const result = await riskAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.report_id).toBeDefined();
      expect(result.result.total_transactions_assessed).toBeGreaterThanOrEqual(0);
      expect(result.result.fraud_cases_detected).toBeGreaterThanOrEqual(0);
      expect(result.result.risk_trends).toBeDefined();
    });
  });

  describe('Alert Management', () => {
    it('should manage risk alerts effectively', async () => {
      const goal: AgentGoal = {
        id: 'alert-management-goal',
        description: 'Process and triage risk alerts',
        priority: 'high',
        goal_type: 'alert_triage',
        parameters: {
          alerts: [
            {
              id: 'alert-1',
              type: 'high_value_transaction',
              severity: 'medium',
              transaction_id: 'txn-123',
              created_at: Date.now() - 3600000
            },
            {
              id: 'alert-2',
              type: 'suspicious_pattern',
              severity: 'high',
              transaction_id: 'txn-456',
              created_at: Date.now() - 1800000
            }
          ],
          triage_rules: ['severity_based', 'time_based', 'risk_score_based']
        },
        created_at: Date.now(),
        created_by: 'risk-system'
      };

      const result = await riskAgent.executeGoal(goal);

      expect(result.success).toBe(true);
      expect(result.result.triaged_alerts).toBeDefined();
      expect(result.result.triaged_alerts.length).toBe(2);
      expect(result.result.escalation_recommendations).toBeDefined();
      expect(result.result.auto_resolved_count).toBeGreaterThanOrEqual(0);
    });
  });
});