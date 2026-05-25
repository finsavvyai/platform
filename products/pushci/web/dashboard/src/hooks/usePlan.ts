import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export type Plan = 'free' | 'pro' | 'team';

interface PlanState {
  plan: Plan;
  loading: boolean;
}

interface PlanContextValue extends PlanState {
  isFree: boolean;
  hasFeature: (required: Plan) => boolean;
  refetch: () => void;
}

const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, team: 2 };

export const PlanContext = createContext<PlanContextValue>({
  plan: 'free',
  loading: true,
  isFree: true,
  hasFeature: () => false,
  refetch: () => {},
});

export function usePlan(): PlanContextValue {
  return useContext(PlanContext);
}

export function usePlanLoader(token: string | null): PlanContextValue {
  const [state, setState] = useState<PlanState>({ plan: 'free', loading: true });

  function fetchPlan() {
    if (!token) {
      setState({ plan: 'free', loading: false });
      return;
    }
    fetch(`${API_BASE_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data: { plan?: string }) => {
        const plan = (data.plan === 'pro' || data.plan === 'team') ? data.plan : 'free';
        setState({ plan, loading: false });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }

  useEffect(() => { fetchPlan(); }, [token]);

  const isFree = state.plan === 'free';
  const hasFeature = (required: Plan) => PLAN_RANK[state.plan] >= PLAN_RANK[required];

  return { ...state, isFree, hasFeature, refetch: fetchPlan };
}
