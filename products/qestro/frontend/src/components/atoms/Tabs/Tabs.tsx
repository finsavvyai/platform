import React from 'react';
import { cn } from '../../../lib/utils';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  className
}) => {
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5'
  };

  const variantStyles = {
    default: {
      container: 'bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-1',
      tab: 'rounded-lg transition-all',
      active: 'bg-primary/20 text-white shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)] border border-primary/20',
      inactive: 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
    },
    pills: {
      container: 'flex gap-2',
      tab: 'rounded-full transition-all border',
      active: 'bg-primary/20 text-white border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]',
      inactive: 'text-gray-400 hover:text-white border-white/10 hover:border-white/20 bg-black/20'
    },
    underline: {
      container: 'border-b border-white/10',
      tab: 'border-b-2 -mb-px transition-all',
      active: 'border-primary text-white drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]',
      inactive: 'border-transparent text-gray-400 hover:text-white hover:border-white/20'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn('flex', styles.container, className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          className={cn(
            'flex items-center gap-2 font-medium transition-all duration-200',
            sizeClasses[size],
            styles.tab,
            activeTab === tab.id ? styles.active : styles.inactive,
            tab.disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {tab.icon && <span>{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span
              className={cn(
                'ml-1 px-2 py-0.5 rounded-full text-xs font-semibold',
                activeTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-[#374151] text-gray-400'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};
