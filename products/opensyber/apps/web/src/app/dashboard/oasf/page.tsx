import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { OasfClient } from './oasf-client';

interface Assessment {
  id: string;
  overallScore: number;
  grade: string;
  passingCount: number;
  failingCount: number;
  partialCount: number;
  totalControls: number;
  createdAt: string;
}

export default async function OasfPage() {
  let assessments: Assessment[] = [];

  try {
    
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ data: Assessment[] }>('/api/oasf/assessments?limit=10', {
        token,
      });
      assessments = data.data ?? [];
    }
  } catch {
    // API not available
  }

  return <OasfClient assessments={assessments} />;
}
