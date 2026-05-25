/**
 * Main Dashboard Layout Component
 * Provides the primary layout structure with sidebar navigation and main content area
 */
import React, { ReactNode } from 'react';
import type { User, DashboardLayout as DashboardLayoutType } from '../types';
interface DashboardLayoutProps {
    children: ReactNode;
    user?: User;
    layout?: DashboardLayoutType;
    onLayoutChange?: (layout: Partial<DashboardLayoutType>) => void;
    className?: string;
}
export declare const DashboardLayout: React.FC<DashboardLayoutProps>;
export {};
//# sourceMappingURL=DashboardLayout.d.ts.map