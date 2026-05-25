/**
 * Apple UI Components Index
 * Exports all Apple HIG compliant components
 */

// Core Components
export { default as AppleButton } from './AppleButton';
export type { AppleButtonProps, ButtonVariant, ButtonSize, ButtonEmphasis } from './AppleButton';

export { default as AppleInput } from './AppleInput';
export type { AppleInputProps, InputType, InputState, InputSize } from './AppleInput';

export { default as AppleCard } from './AppleCard';
export type { AppleCardProps, CardVariant, CardSize, CardPadding } from './AppleCard';

// Placeholder exports for components to be implemented
export const AppleSidebar = React.lazy(() => import('./AppleSidebar'));
export const AppleModal = React.lazy(() => import('./AppleModal'));
export const AppleTabs = React.lazy(() => import('./AppleTabs'));

// Type exports for placeholder components
export type { AppleSidebarProps } from './AppleSidebar';
export type { AppleModalProps } from './AppleModal';
export type { AppleTabsProps } from './AppleTabs';
