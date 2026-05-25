/**
 * GET /api/proxy/onboarding/profile
 * Forwards to /api/onboarding/profile so client components can read the
 * persisted persona without exposing the API JWT to the browser.
 */

import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { getOrgIdFromRequest } from '@/lib/org-context';

export async function GET(request: Request) {
  try {
    const token = await getApiToken();
    if (!token) {
      return NextResponse.json({ profile: null }, { status: 401 });
    }
    const orgId = getOrgIdFromRequest(request);
    const data = await apiClient<{ profile: unknown }>('/api/onboarding/profile', {
      token,
      orgId,
    });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { profile: null, message: err instanceof Error ? err.message : 'Failed to load profile' },
      { status: 500 },
    );
  }
}
