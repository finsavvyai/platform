// Onboarding progress API — talks to `/api/onboarding/*` on the backend.
import type { ApiFetchFn } from './types';

export interface OnboardingProgressResponse {
    success?: boolean;
    data?: {
        completedSteps: string[];
        updatedAt?: number;
    };
}

export function createOnboardingApi(fetchFn: ApiFetchFn) {
    return {
        async getOnboardingProgress(): Promise<OnboardingProgressResponse> {
            return fetchFn('/api/onboarding/progress') as Promise<OnboardingProgressResponse>;
        },

        async completeOnboardingStep(stepId: string): Promise<OnboardingProgressResponse> {
            return fetchFn(`/api/onboarding/progress/${encodeURIComponent(stepId)}/complete`, {
                method: 'POST',
            }) as Promise<OnboardingProgressResponse>;
        },

        async resetOnboardingProgress(): Promise<OnboardingProgressResponse> {
            return fetchFn('/api/onboarding/progress', {
                method: 'DELETE',
            }) as Promise<OnboardingProgressResponse>;
        },
    };
}
