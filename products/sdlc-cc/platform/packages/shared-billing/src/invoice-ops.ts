import { SupabaseClient } from '@supabase/supabase-js';
import {
  BillingConfig,
  Invoice,
  BillingAnalytics,
  BillingError,
} from './types';

interface InvoiceOpsDeps {
  config: BillingConfig;
  getAdminClient: () => SupabaseClient;
}

export class InvoiceOps {
  private deps: InvoiceOpsDeps;

  constructor(deps: InvoiceOpsDeps) {
    this.deps = deps;
  }

  async getUserInvoices(userId: string): Promise<Invoice[]> {
    try {
      const { data: invoices, error } = await this.deps.getAdminClient()
        .from('invoices')
        .select(`*, customers!inner(user_id)`)
        .eq('customers.user_id', userId)
        .order('created', { ascending: false });

      if (error) throw error;
      return invoices as Invoice[];
    } catch (error) {
      throw new BillingError({
        code: 'FETCH_INVOICES_FAILED',
        message: `Failed to fetch user invoices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processor: this.deps.config.processor,
        timestamp: new Date(),
      });
    }
  }

  async getBillingAnalytics(startDate: Date, endDate: Date): Promise<BillingAnalytics> {
    try {
      const admin = this.deps.getAdminClient();

      const { data: invoices } = await admin
        .from('invoices')
        .select('*')
        .gte('created', startDate.toISOString())
        .lte('created', endDate.toISOString())
        .eq('status', 'paid');

      const monthlyRecurring = invoices
        ?.filter(inv => inv.number.includes('SUB'))
        .reduce((sum, inv) => sum + inv.total, 0) || 0;
      const oneTimePayments = invoices
        ?.filter(inv => !inv.number.includes('SUB'))
        .reduce((sum, inv) => sum + inv.total, 0) || 0;

      const { data: subscriptions } = await admin.from('subscriptions').select('*');
      const activeSubscriptions = subscriptions?.filter(sub => sub.status === 'active').length || 0;
      const churnedSubscriptions = subscriptions?.filter(sub => sub.status === 'cancelled').length || 0;

      const { data: customers } = await admin.from('customers').select('*');
      const totalCustomers = customers?.length || 0;

      return {
        period: { start: startDate, end: endDate },
        revenue: {
          monthlyRecurring,
          oneTimePayments,
          total: monthlyRecurring + oneTimePayments,
        },
        subscriptions: {
          total: subscriptions?.length || 0,
          active: activeSubscriptions,
          churned: churnedSubscriptions,
          upgrades: 0,
          downgrades: 0,
        },
        usage: {
          totalRequests: 0,
          topProducts: [],
          topUsers: [],
        },
        customers: {
          total: totalCustomers,
          new: 0,
          churned: churnedSubscriptions,
          avgLifetimeValue: 0,
        },
      };
    } catch (error) {
      throw new BillingError({
        code: 'ANALYTICS_FAILED',
        message: `Failed to fetch billing analytics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processor: this.deps.config.processor,
        timestamp: new Date(),
      });
    }
  }
}
