/**
 * AI Assistant Page Component
 * Interface for SDLC AI assistant
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface AIAssistantPageProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const AIAssistantPage: React.FC<AIAssistantPageProps>;
export {};
//# sourceMappingURL=AIAssistantPage.d.ts.map