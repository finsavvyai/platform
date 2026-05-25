/**
 * UserMenu Component
 * Provides user profile management and quick actions
 */
import React from 'react';
import type { User } from '../types';
interface UserMenuProps {
    open: boolean;
    onToggle: () => void;
    user?: User;
    className?: string;
}
export declare const UserMenu: React.FC<UserMenuProps>;
export {};
//# sourceMappingURL=UserMenu.d.ts.map