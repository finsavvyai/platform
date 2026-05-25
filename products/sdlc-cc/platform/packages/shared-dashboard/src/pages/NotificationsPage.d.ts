/**
 * Notifications Page Component
 * Comprehensive notification management interface
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface NotificationsPageProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const NotificationsPage: React.FC<NotificationsPageProps>;
export {};
//# sourceMappingURL=NotificationsPage.d.ts.map