/**
 * Billing Page Component
 * Manages subscriptions, payments, and billing information
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface BillingPageProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const BillingPage: React.FC<BillingPageProps>;
export {};
//# sourceMappingURL=BillingPage.d.ts.map