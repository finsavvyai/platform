/**
 * Sidebar Component
 * Provides navigation and quick access to all products and features
 */
import React from 'react';
import type { DashboardLayout } from '../types';
interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    layout?: DashboardLayout;
    className?: string;
}
export declare const Sidebar: React.FC<SidebarProps>;
export {};
//# sourceMappingURL=Sidebar.d.ts.map