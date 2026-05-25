/**
 * Main Dashboard Page
 * Displays overview of all products with real-time metrics
 */

import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { ProductCard } from '../components/ProductCard';
import { MetricsOverview } from '../components/MetricsOverview';
import { ActivityFeed } from '../components/ActivityFeed';
import { AlertBanner } from '../components/AlertBanner';
import { useRealtime } from '../hooks/useRealtime';
import { useProducts } from '../hooks/useProducts';
import { useMetrics } from '../hooks/useMetrics';
import { useNotifications } from '../hooks/useNotifications';

export const Dashboard: React.FC = () => {
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const { metrics, loading: metricsLoading } = useMetrics();
  const { notifications } = useNotifications();
  const { connected } = useRealtime();

  const [filter, setFilter] = useState<'all' | 'core' | 'security' | 'processing' | 'infra'>('all');

  // Filter products by category
  const filteredProducts = filter === 'all'
    ? products
    : products.filter(p => p.category === filter);

  return (
    <DashboardLayout>
      {/* Alert banner for critical notifications */}
      {notifications.some(n => n.severity === 'error' && !n.isRead) && (
        <AlertBanner
          severity="critical"
          message="Critical alerts require attention"
          count={notifications.filter(n => n.severity === 'error' && !n.isRead).length}
        />
      )}

      {/* Real-time connection status */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Enterprise Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor all your products in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Metrics Overview */}
      {!metricsLoading && metrics && (
        <MetricsOverview metrics={metrics} />
      )}

      {/* Category Filter */}
      <div className="mb-6 flex gap-2">
        {['all', 'core', 'security', 'processing', 'infra'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat as any)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {productsError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Error loading products: {productsError}</p>
        </div>
      )}

      {productsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Activity Feed */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <ActivityFeed />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
