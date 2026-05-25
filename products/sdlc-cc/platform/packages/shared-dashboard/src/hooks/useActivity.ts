/**
 * useActivity Hook
 * Fetches and manages recent activity data
 */

import { useState, useEffect } from 'react';

interface Activity {
  id: string;
  product_id: string;
  activity_type: 'deployment' | 'alert' | 'user_action' | 'system_event';
  description: string;
  user_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const useActivity = (limit: number = 20) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/activity/recent?limit=${limit}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as { activities?: Activity[] };
      setActivities(data.activities || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();

    // Refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30000);

    return () => clearInterval(interval);
  }, [limit]);

  return {
    activities,
    loading,
    error,
    refetch: fetchActivity,
  };
};
