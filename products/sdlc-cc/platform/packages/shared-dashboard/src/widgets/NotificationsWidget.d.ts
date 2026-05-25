/**
 * NotificationsWidget Component
 * Displays recent notifications and alerts
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface NotificationsWidgetProps {
    user?: User;
    dashboardService: DashboardService;
    className?: string;
}
export declare const NotificationsWidget: React.FC<NotificationsWidgetProps>;
export {};
//# sourceMappingURL=NotificationsWidget.d.ts.map