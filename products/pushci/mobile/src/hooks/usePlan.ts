import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export type Plan = 'free' | 'pro' | 'team';

interface PlanContextValue {
  plan: Plan;
  loading: boolean;
  isFree: boolean;
  hasFeature: (required: Plan) => boolean;
}

const RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

export const PlanContext = createContext<PlanContextValue>({
  plan: 'free', loading: true, isFree: true,
  hasFeature: () => false,
});

export function usePlan(): PlanContextValue {
  return useContext(PlanContext);
}

export function usePlanLoader(token: string | null): PlanContextValue {
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API_BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { plan?: string }) => {
        const p = data.plan === 'pro' || data.plan === 'team' ? data.plan : 'free';
        setPlan(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return {
    plan, loading,
    isFree: plan === 'free',
    hasFeature: (required: Plan) => RANK[plan] >= RANK[required],
  };
}
