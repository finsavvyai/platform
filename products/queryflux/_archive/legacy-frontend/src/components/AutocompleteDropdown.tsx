import React, { useEffect, useRef } from 'react';
import { Database, Table, Columns2 as Columns, Zap, Code, BookOpen } from 'lucide-react';
import { AutocompleteItem } from '../utils/sqlAutocomplete';

interface AutocompleteDropdownProps {
  items: AutocompleteItem[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (item: AutocompleteItem) => void;
  onClose: () => void;
}

export function AutocompleteDropdown({
  items,
  selectedIndex,
  position,
  onSelect,
  onClose,
}: AutocompleteDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedElement = dropdownRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getIcon = (type: AutocompleteItem['type']) => {
    switch (type) {
      case 'table':
        return <Table className="w-4 h-4 text-blue-500" />;
      case 'column':
        return <Columns className="w-4 h-4 text-green-500" />;
      case 'function':
        return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'keyword':
        return <Code className="w-4 h-4 text-purple-500" />;
      case 'snippet':
        return <BookOpen className="w-4 h-4 text-orange-500" />;
      default:
        return <Database className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: AutocompleteItem['type']) => {
    switch (type) {
      case 'table':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'column':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'function':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'keyword':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'snippet':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: '500px',
        minWidth: '300px',
        maxHeight: '400px',
      }}
    >
      <div className="overflow-y-auto max-h-96">
        {items.map((item, index) => (
          <div
            key={`${item.type}-${item.label}-${index}`}
            data-index={index}
            onClick={() => onSelect(item)}
            className={`flex items-start gap-3 px-3 py-2 cursor-pointer transition-colors ${
              index === selectedIndex
                ? 'bg-blue-50 dark:bg-blue-900/30'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">{getIcon(item.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {item.label}
                </span>
                <span
                  className={`px-1.5 py-0.5 text-xs font-semibold rounded ${getTypeColor(
                    item.type
                  )}`}
                >
                  {item.type}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                  {item.description}
                </p>
              )}
              {item.detail && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate font-mono">
                  {item.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">Enter</kbd> Select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
