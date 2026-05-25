/**
 * Pipelines Page Component
 * Manages CI/CD pipelines and deployments
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface PipelinesPageProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const PipelinesPage: React.FC<PipelinesPageProps>;
export {};
//# sourceMappingURL=PipelinesPage.d.ts.map