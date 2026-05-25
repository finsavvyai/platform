/**
 * Status Bar Component
 * Provides system status information and theme controls
 */
import React from 'react';
import type { User } from '../types';
interface StatusBarProps {
    user?: User;
    theme: 'light' | 'dark' | 'auto';
    onThemeChange: (theme: 'light' | 'dark' | 'auto') => void;
    className?: string;
}
export declare const StatusBar: React.FC<StatusBarProps>;
export {};
//# sourceMappingURL=StatusBar.d.ts.map