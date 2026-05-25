/**
 * NotificationCenter Component
 * Provides notification management and display functionality
 */
import React from 'react';
import type { User } from '../types';
interface NotificationCenterProps {
    open: boolean;
    onToggle: () => void;
    user?: User;
    className?: string;
}
export declare const NotificationCenter: React.FC<NotificationCenterProps>;
export {};
//# sourceMappingURL=NotificationCenter.d.ts.map