/**
 * API Gateway Page Component
 * Manages SDLC API gateway configuration and monitoring
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface APIGatewayPageProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const APIGatewayPage: React.FC<APIGatewayPageProps>;
export {};
//# sourceMappingURL=APIGatewayPage.d.ts.map