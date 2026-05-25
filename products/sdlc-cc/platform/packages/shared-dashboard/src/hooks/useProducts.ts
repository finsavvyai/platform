/**
 * useProducts Hook
 * Fetches and manages product status data
 */

import { useState, useEffect } from 'react';
import { useRealtime } from './useRealtime';

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
  lastChecked?: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage } = useRealtime();

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/products/status');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as { products?: Product[] };
      setProducts(data.products || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    // Refresh every 30 seconds
    const interval = setInterval(fetchProducts, 30000);

    return () => clearInterval(interval);
  }, []);

  // Update products from real-time messages
  useEffect(() => {
    if (lastMessage?.type === 'product_status') {
      const { productId, data } = lastMessage as unknown as { productId: string; data: Partial<Product> };
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, ...data }
            : p
        )
      );
    }
  }, [lastMessage]);

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
  };
};
