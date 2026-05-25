/**
 * Settings Page Component
 * User preferences and account settings
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface SettingsPageProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const SettingsPage: React.FC<SettingsPageProps>;
export {};
//# sourceMappingURL=SettingsPage.d.ts.map