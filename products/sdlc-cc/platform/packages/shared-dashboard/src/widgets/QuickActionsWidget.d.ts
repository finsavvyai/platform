/**
 * QuickActionsWidget Component
 * Provides quick access to common actions across all products
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface QuickActionsWidgetProps {
    user?: User;
    dashboardService: DashboardService;
    className?: string;
}
export declare const QuickActionsWidget: React.FC<QuickActionsWidgetProps>;
export {};
//# sourceMappingURL=QuickActionsWidget.d.ts.map