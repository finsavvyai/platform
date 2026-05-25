/**
 * POST /api/proxy/onboarding/auto-deploy
 *
 * Thin proxy to the API orchestrator at POST /api/onboarding/auto-deploy.
 * The orchestrator creates the instance AND installs the requested skills
 * in one round trip. This proxy just forwards auth + body and surfaces the
 * structured response so the wizard can render real per-step status.
 */

import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { getOrgIdFromRequest } from '@/lib/org-context';

interface AutoDeployBody {
  region: string;
  persona?: string;
  skill_ids?: readonly string[];
  signals?: Record<string, unknown>;
}

interface OrchestratorResponse {
  ok: boolean;
  instance_id?: string;
  instance_status?: string;
  skills?: ReadonlyArray<{ slug: string; status: string; message?: string }>;
  persona?: string | null;
  message?: string;
  upgradeUrl?: string;
}

export async function POST(request: Request) {
  let body: AutoDeployBody;
  try {
    body = (await request.json()) as AutoDeployBody;
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.region) {
    return NextResponse.json({ ok: false, message: 'region is required' }, { status: 400 });
  }

  try {
    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }
    const orgId = getOrgIdFromRequest(request);

    // The orchestrator expects `skill_slugs` not `skill_ids` — keep the proxy
    // contract stable for the frontend by translating here.
    const data = await apiClient<OrchestratorResponse>('/api/onboarding/auto-deploy', {
      method: 'POST',
      token,
      orgId,
      body: JSON.stringify({
        region: body.region,
        name: personaToInstanceName(body.persona),
        persona: body.persona,
        skill_slugs: body.skill_ids ?? [],
        signals: body.signals,
      }),
    });

    if (!data?.ok || !data.instance_id) {
      return NextResponse.json(
        { ok: false, message: data?.message ?? 'Auto setup failed', upgradeUrl: data?.upgradeUrl },
        { status: data?.upgradeUrl ? 402 : 502 },
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto setup failed';
    const status = /unauthorized/i.test(message) ? 401 : 500;
    return NextResponse.json({ ok: false, message }, { status });
  }
}

function personaToInstanceName(persona?: string): string {
  switch (persona) {
    case 'solo_dev':
      return 'My Dev Agent';
    case 'security_engineer':
      return 'Security Agent';
    case 'compliance_officer':
      return 'Compliance Agent';
    case 'team_lead':
      return 'Team Agent';
    default:
      return 'My Agent';
  }
}
