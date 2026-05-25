/**
 * Product Card Component
 * Displays individual product status and metrics
 */

import React from 'react';
import { Activity, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  category: string;
  deployment_status: string;
  uptime?: number;
  responseTime?: number;
  requestsPerMinute?: number;
  errorRate?: number;
}

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'maintenance':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-5 h-5" />;
      case 'degraded':
        return <AlertCircle className="w-5 h-5" />;
      case 'down':
        return <XCircle className="w-5 h-5" />;
      case 'maintenance':
        return <Clock className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'core':
        return 'bg-purple-100 text-purple-800';
      case 'devx':
        return 'bg-blue-100 text-blue-800';
      case 'data-intelligence':
        return 'bg-green-100 text-green-800';
      case 'consumer':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {product.display_name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {product.description || product.name}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(product.category)}`}>
          {product.category}
        </span>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-4 ${getStatusColor(product.status)}`}>
        {getStatusIcon(product.status)}
        <span className="font-medium capitalize">{product.status}</span>
      </div>

      {/* Metrics */}
      {product.status !== 'down' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Uptime</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {product.uptime?.toFixed(1) || '99.9'}%
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Response</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {product.responseTime || '120'}ms
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Requests/min</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {product.requestsPerMinute?.toLocaleString() || '0'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Error Rate</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {((product.errorRate || 0) * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      {/* Deployment Status */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Deployment</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
            {product.deployment_status}
          </span>
        </div>
      </div>
    </div>
  );
};
