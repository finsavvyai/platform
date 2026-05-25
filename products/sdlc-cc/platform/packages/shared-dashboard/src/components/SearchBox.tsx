/**
 * SearchBox Component
 * Provides intelligent search functionality across all products and data
 */

import React, { useState, useRef, useEffect } from 'react';
import type { SearchResult } from '../types';
import { useDebounce } from '../hooks/useDebounce';

interface SearchBoxProps {
  expanded?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  placeholder?: string;
  className?: string;
  onToggle?: () => void;
}

interface SearchCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  count?: number;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  expanded = false,
  autoFocus = false,
  compact = false,
  placeholder = 'Search...',
  className = '',
  onToggle,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Mock search categories
  const categories: SearchCategory[] = [
    { id: 'all', label: 'All', icon: '🔍', color: 'text-gray-500' },
    { id: 'pipelines', label: 'Pipelines', icon: '🚀', color: 'text-blue-500', count: 12 },
    { id: 'documentation', label: 'Documentation', icon: '📚', color: 'text-green-500', count: 45 },
    { id: 'apis', label: 'APIs', icon: '🔌', color: 'text-purple-500', count: 23 },
    { id: 'repositories', label: 'Repositories', icon: '💻', color: 'text-orange-500', count: 18 },
    { id: 'billing', label: 'Billing', icon: '💳', color: 'text-yellow-500', count: 5 },
    { id: 'logs', label: 'Logs', icon: '📄', color: 'text-red-500', count: 156 },
  ];

  // Mock search function - this would call the DashboardService
  const performSearch = async (searchQuery: string, category: string): Promise<SearchResult[]> => {
    if (!searchQuery.trim()) return [];

    setLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 200));

    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'Production Deployment Pipeline',
        type: 'pipeline',
        product: 'sdlc',
        description: 'CI/CD pipeline for production deployments',
        url: '/sdlc/pipelines/production-deploy',
        relevanceScore: 0.95,
        metadata: {
          lastModified: '2024-01-15T10:30:00Z',
          status: 'success',
          duration: '12m 34s',
        },
      },
      {
        id: '2',
        title: 'API Gateway Configuration Guide',
        type: 'documentation',
        product: 'gateway',
        description: 'Complete guide for configuring the SDLC API gateway',
        url: '/gateway/docs/configuration',
        relevanceScore: 0.87,
        metadata: {
          lastModified: '2024-01-14T15:22:00Z',
          author: 'DevOps Team',
          readTime: '8 min',
        },
      },
      {
        id: '3',
        title: 'User Authentication API',
        type: 'api',
        product: 'shared',
        description: 'REST API for user authentication and authorization',
        url: '/api/auth',
        relevanceScore: 0.82,
        metadata: {
          method: 'POST',
          endpoint: '/api/auth/login',
          version: 'v1.0.0',
        },
      },
    ];

    const filteredResults = category === 'all'
      ? mockResults
      : mockResults.filter(result => result.type === category);

    setLoading(false);
    return filteredResults.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  };

  // Handle search
  useEffect(() => {
    if (debouncedQuery.trim()) {
      performSearch(debouncedQuery, selectedCategory).then(setResults);
    } else {
      setResults([]);
    }
    setSelectedIndex(0);
  }, [debouncedQuery, selectedCategory]);

  // Focus input when expanded or auto-focus is true
  useEffect(() => {
    if ((expanded || autoFocus) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded, autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          window.location.href = results[selectedIndex].url;
        }
        break;
      case 'Escape':
        if (onToggle) {
          onToggle();
        }
        setQuery('');
        setResults([]);
        break;
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedIndex(0);
    if (query.trim()) {
      performSearch(query, category).then(setResults);
    }
  };

  const getResultIcon = (type: string) => {
    const icons: Record<string, string> = {
      pipeline: '🚀',
      documentation: '📚',
      api: '🔌',
      repository: '💻',
      billing: '💳',
      log: '📄',
    };
    return icons[type] || '📄';
  };

  const getProductBadge = (product: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      sdlc: { label: 'SDLC', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
      rag: { label: 'RAG', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      gateway: { label: 'Gateway', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      billing: { label: 'Billing', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      shared: { label: 'Shared', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
    };
    const badge = badges[product] || badges.shared;
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={onToggle}
          placeholder={placeholder}
          className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`
            w-full px-4 py-2.5 pr-12 bg-white dark:bg-gray-800
            border border-gray-300 dark:border-gray-600 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            placeholder-gray-500 dark:placeholder-gray-400
            ${expanded ? 'text-lg shadow-lg' : 'text-sm'}
          `}
        />

        {/* Search Icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>

        {/* Keyboard Shortcut */}
        {!expanded && !query && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
              ⌘K
            </kbd>
          </div>
        )}
      </div>

      {/* Search Results */}
      {query && (expanded || results.length > 0) && (
        <div className={`
          absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl
          overflow-hidden z-50
          ${expanded ? 'max-h-96' : 'max-h-80'}
        `}>
          {/* Category Tabs */}
          {expanded && (
            <div className="flex items-center space-x-1 p-2 border-b border-gray-200 dark:border-gray-700">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={`
                    flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium
                    transition-colors duration-150
                    ${selectedCategory === category.id
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }
                  `}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                  {category.count && (
                    <span className="text-xs text-gray-500">({category.count})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 21a9 9 0 110-18 9 9 0 010 18z" />
                </svg>
                <p className="text-lg font-medium mb-1">No results found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="py-2">
                {results.map((result, index) => (
                  <a
                    key={result.id}
                    href={result.url}
                    className={`
                      flex items-start space-x-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors duration-150 cursor-pointer
                      ${index === selectedIndex ? 'bg-gray-50 dark:bg-gray-700' : ''}
                    `}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex-shrink-0 text-lg mt-0.5">
                      {getResultIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {result.title}
                        </h3>
                        {result.product && getProductBadge(result.product)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                        {result.description}
                      </p>
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500 dark:text-gray-500">
                        <span>Relevance: {Math.round((result.relevanceScore ?? 0) * 100)}%</span>
                        {result.metadata.lastModified != null && (
                          <>
                            <span>•</span>
                            <span>{new Date(result.metadata.lastModified as string | number).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Found {results.length} results</span>
              <div className="flex items-center space-x-2">
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded">↑↓</kbd>
                <span>to navigate</span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded">↵</kbd>
                <span>to open</span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded">esc</kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};