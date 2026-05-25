/**
 * Overview Page Component
 * Main dashboard overview with system status and quick access widgets
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface OverviewProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const Overview: React.FC<OverviewProps>;
export {};
//# sourceMappingURL=Overview.d.ts.map