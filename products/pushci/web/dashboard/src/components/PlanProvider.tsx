import { type ReactNode } from 'react';
import { PlanContext, usePlanLoader } from '../hooks/usePlan';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: ReactNode;
}

export default function PlanProvider({ children }: Props) {
  const { token } = useAuth();
  const value = usePlanLoader(token);

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}
