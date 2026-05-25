/**
 * SearchBox Component
 * Provides intelligent search functionality across all products and data
 */
import React from 'react';
interface SearchBoxProps {
    expanded?: boolean;
    autoFocus?: boolean;
    compact?: boolean;
    placeholder?: string;
    className?: string;
    onToggle?: () => void;
}
export declare const SearchBox: React.FC<SearchBoxProps>;
export {};
//# sourceMappingURL=SearchBox.d.ts.map