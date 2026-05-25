/**
 * useMetrics Hook
 * Fetches and manages aggregate metrics data
 */

import { useState, useEffect } from 'react';
import { useRealtime } from './useRealtime';

interface AggregateMetrics {
  totalRequests: number;
  totalUsers: number;
  totalRevenue: number;
  averageResponseTime: number;
  overallUptime: number;
  activeProducts: number;
  timestamp: string;
}

export const useMetrics = () => {
  const [metrics, setMetrics] = useState<AggregateMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lastMessage } = useRealtime();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/metrics/aggregate');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as AggregateMetrics;
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Refresh every 60 seconds
    const interval = setInterval(fetchMetrics, 60000);

    return () => clearInterval(interval);
  }, []);

  // Update metrics from real-time messages
  useEffect(() => {
    if (lastMessage?.type === 'metrics_update') {
      setMetrics((prev) => ({
        ...prev,
        ...(lastMessage.data as Partial<AggregateMetrics>),
        timestamp: lastMessage.timestamp,
      } as AggregateMetrics));
    }
  }, [lastMessage]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
};
