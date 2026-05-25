/**
 * Onboarding persistence helpers.
 *
 * Backed by the Qestro backend (`/api/onboarding/progress`) when the user is
 * authenticated, with localStorage as an always-on fallback so the checklist
 * still works in anonymous or offline sessions. The backend is the source of
 * truth when reachable; writes fan out to both so the UI stays consistent.
 */
import { api } from '../../lib/api';
import { DEFAULT_TASKS, type OnboardingTask, type OnboardingTaskId } from './tasks';

const LOCAL_STORAGE_KEY = 'qestro_onboarding_v2';

function storageKey(userId: string | null): string {
    return userId ? `${LOCAL_STORAGE_KEY}::${userId}` : LOCAL_STORAGE_KEY;
}

export function readLocal(userId: string | null): string[] {
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export function writeLocal(userId: string | null, ids: string[]): void {
    try {
        localStorage.setItem(storageKey(userId), JSON.stringify(ids));
    } catch {
        // ignore quota / private-mode errors
    }
}

export function mergeCompleted(completedIds: string[]): OnboardingTask[] {
    const set = new Set(completedIds);
    return DEFAULT_TASKS.map((t) => ({ ...t, completed: set.has(t.id) }));
}

export async function fetchRemoteProgress(): Promise<string[]> {
    const res = await api.getOnboardingProgress();
    return res?.data?.completedSteps ?? [];
}

export async function markRemoteComplete(id: OnboardingTaskId): Promise<void> {
    await api.completeOnboardingStep(id);
}

export async function resetRemote(): Promise<void> {
    await api.resetOnboardingProgress();
}
