import { Suspense } from 'react';
import { Server } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { PaymentSuccessBanner } from '@/components/dashboard/PaymentSuccessBanner';
import { RestartButton } from '@/components/dashboard/RestartButton';
import { DeployInstanceButton } from '@/components/dashboard/DeployInstanceButton';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';
import { LimitReachedBanner } from '@/components/dashboard/LimitReachedBanner';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { WelcomeModal } from '@/components/dashboard/WelcomeModal';
import { OnboardingWizard } from '@/components/dashboard/onboarding';
import { SecurityChartsPanel } from '@/components/dashboard/SecurityChartsPanel';
import { ConnectAgentCard } from '@/components/dashboard/ConnectAgentCard';
import { InstanceStatusCard } from './InstanceStatusCard';
import { StatsGrid } from './StatsGrid';
import { RecentEvents } from './RecentEvents';
import type { InstanceData, HealthData, SecurityDashboard } from './dashboard-types';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  let instances: InstanceData[] = [];
  let health: HealthData | null = null;
  let security: SecurityDashboard | null = null;
  let userPlan = 'free';
  let onboardingCompletedAt: string | null = null;
  let gatewayToken: string | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      const [instanceData, userData] = await Promise.allSettled([
        apiClient<{ instances: InstanceData[] }>('/api/instances', { token }),
        apiClient<{ user: { plan: string; onboardingCompletedAt: string | null } }>('/api/user', { token }),
      ]);
      if (instanceData.status === 'fulfilled') instances = instanceData.value.instances ?? [];
      if (userData.status === 'fulfilled') {
        userPlan = userData.value.user.plan;
        onboardingCompletedAt = userData.value.user.onboardingCompletedAt;
      }
      const instance = instances[0];
      if (instance) {
        const [healthRes, securityRes, tokenRes] = await Promise.allSettled([
          apiClient<{ health: HealthData | null }>(`/api/instances/${instance.id}/health`, { token }),
          apiClient<{ dashboard: SecurityDashboard }>(`/api/security/instances/${instance.id}/dashboard`, { token }),
          apiClient<{ data: { gatewayToken: string } }>(`/api/instances/${instance.id}/gateway-token`, { token }),
        ]);
        if (healthRes.status === 'fulfilled' && healthRes.value.health) health = healthRes.value.health;
        if (securityRes.status === 'fulfilled') security = securityRes.value.dashboard;
        if (tokenRes.status === 'fulfilled') gatewayToken = tokenRes.value.data.gatewayToken;
      }
    }
  } catch (err) {
    console.error('[DashboardPage] Error loading data:', err instanceof Error ? err.message : err);
  }

  const instance = instances[0] ?? null;

  return (
    <div>
      <WelcomeModal />
      <Suspense fallback={null}><PaymentSuccessBanner /></Suspense>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">Monitor your AI agent instance</p>
        </div>
        {instance && <RestartButton instanceId={instance.id} />}
      </div>
      {!onboardingCompletedAt && !instance && (
        <div className="mb-8"><OnboardingWizard /></div>
      )}
      {!onboardingCompletedAt && instance && (
        <div className="mb-8"><OnboardingChecklist plan={userPlan} /></div>
      )}
      {instance && userPlan === 'free' && instances.length >= 1 && (
        <LimitReachedBanner kind="agents" current={instances.length} limit={1} />
      )}
      {instance ? (
        <>
          {/*
            ConnectAgentCard is hoisted above everything else when the user
            has no events yet — a just-deployed agent is useless until the
            user runs the CLI on their own machine, and burying the "how to
            connect" card below the (zeroed-out) metrics trapped users on
            an empty dashboard. Once events start flowing the card drops
            down to its natural position below the charts.
          */}
          {(security?.recentEvents?.length ?? 0) === 0 && (
            <ConnectAgentCard
              instanceId={instance.id}
              gatewayToken={gatewayToken}
              hasEvents={false}
            />
          )}
          <QuickActions />
          <InstanceStatusCard instance={instance} />
          <StatsGrid health={health} security={security} />
          <SecurityChartsPanel instanceId={instance.id} />
          <RecentEvents security={security} />
          {(security?.recentEvents?.length ?? 0) > 0 && (
            <ConnectAgentCard
              instanceId={instance.id}
              gatewayToken={gatewayToken}
              hasEvents={true}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded border border-dashed border-wire bg-panel/30 p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded bg-signal/10 mb-6">
            <Server className="h-8 w-8 text-signal" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No instances yet</h2>
          <p className="text-text-secondary text-sm max-w-md mb-6">
            Deploy your first secure AI agent instance. It comes pre-configured with security hardening, encrypted credentials, and real-time monitoring.
          </p>
          <DeployInstanceButton />
        </div>
      )}
    </div>
  );
}
