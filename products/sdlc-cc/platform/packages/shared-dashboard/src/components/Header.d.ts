/**
 * Header Component
 * Provides the main header with breadcrumbs, search, and user actions
 */
import React from 'react';
import type { User } from '../types';
interface HeaderProps {
    user?: User;
    onSidebarToggle: () => void;
    sidebarCollapsed: boolean;
    className?: string;
}
export declare const Header: React.FC<HeaderProps>;
export {};
//# sourceMappingURL=Header.d.ts.map