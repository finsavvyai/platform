/**
 * Search Page Component
 * Advanced search interface for all products and data
 */
import React from 'react';
import type { User } from '../types';
import { DashboardService } from '../services/DashboardService';
interface SearchPageProps {
    user?: User;
    dashboardService: DashboardService;
}
export declare const SearchPage: React.FC<SearchPageProps>;
export {};
//# sourceMappingURL=SearchPage.d.ts.map