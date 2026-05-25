/* eslint-disable react-refresh/only-export-components */
/**
 * Onboarding Context — Day 1 / Week 1 / Month 1 checklist.
 *
 * Adapted from tenantiq's onboarding-checklist bucket pattern and the
 * luna-os dashboard Onboarding widget. The catalogue lives in
 * `./onboarding/tasks`; persistence (D1 + localStorage fallback) lives in
 * `./onboarding/persistence`. This file is the React provider only.
 */
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from 'react';
import { useAuthStore } from '../stores/authStore';
import {
    DEFAULT_TASKS,
    type OnboardingBucket,
    type OnboardingTask,
    type OnboardingTaskId,
} from './onboarding/tasks';
import {
    fetchRemoteProgress,
    markRemoteComplete,
    mergeCompleted,
    readLocal,
    resetRemote,
    writeLocal,
} from './onboarding/persistence';

export type { OnboardingBucket, OnboardingTask, OnboardingTaskId };

interface OnboardingContextValue {
    tasks: OnboardingTask[];
    progress: number;
    completedCount: number;
    markTaskComplete: (id: OnboardingTaskId) => Promise<void>;
    resetOnboarding: () => Promise<void>;
    isTaskComplete: (id: OnboardingTaskId) => boolean;
    tasksByBucket: Record<OnboardingBucket, OnboardingTask[]>;
    day1Done: boolean;
    isLoaded: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const user = useAuthStore((s) => s.user);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const userId = user?.id ?? null;

    const [tasks, setTasks] = useState<OnboardingTask[]>(() => mergeCompleted(readLocal(userId)));
    const [isLoaded, setIsLoaded] = useState(false);

    // Hydrate from backend when authenticated, fall back to localStorage otherwise.
    useEffect(() => {
        let cancelled = false;

        async function hydrate() {
            if (!isAuthenticated) {
                if (!cancelled) {
                    setTasks(mergeCompleted(readLocal(userId)));
                    setIsLoaded(true);
                }
                return;
            }

            try {
                const ids = await fetchRemoteProgress();
                if (cancelled) return;
                setTasks(mergeCompleted(ids));
                writeLocal(userId, ids);
            } catch {
                if (cancelled) return;
                setTasks(mergeCompleted(readLocal(userId)));
            } finally {
                if (!cancelled) setIsLoaded(true);
            }
        }

        hydrate();
        return () => { cancelled = true; };
    }, [isAuthenticated, userId]);

    const markTaskComplete = useCallback(async (id: OnboardingTaskId) => {
        let completedIds: string[] = [];

        setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === id);
            if (idx === -1 || prev[idx].completed) {
                completedIds = prev.filter((t) => t.completed).map((t) => t.id);
                return prev;
            }
            const next = [...prev];
            next[idx] = { ...next[idx], completed: true };
            completedIds = next.filter((t) => t.completed).map((t) => t.id);
            return next;
        });

        writeLocal(userId, completedIds);

        if (!isAuthenticated) return;
        try { await markRemoteComplete(id); } catch { /* reconcile on next hydrate */ }
    }, [isAuthenticated, userId]);

    const resetOnboarding = useCallback(async () => {
        setTasks(DEFAULT_TASKS.map((t) => ({ ...t, completed: false })));
        writeLocal(userId, []);
        if (!isAuthenticated) return;
        try { await resetRemote(); } catch { /* ignore */ }
    }, [isAuthenticated, userId]);

    const isTaskComplete = useCallback(
        (id: OnboardingTaskId) => tasks.find((t) => t.id === id)?.completed ?? false,
        [tasks],
    );

    const value = useMemo<OnboardingContextValue>(() => {
        const completedCount = tasks.filter((t) => t.completed).length;
        const progress = tasks.length === 0 ? 0 : (completedCount / tasks.length) * 100;
        const tasksByBucket: Record<OnboardingBucket, OnboardingTask[]> = {
            day1: tasks.filter((t) => t.bucket === 'day1'),
            week1: tasks.filter((t) => t.bucket === 'week1'),
            month1: tasks.filter((t) => t.bucket === 'month1'),
        };
        const day1Done = tasksByBucket.day1.length > 0 && tasksByBucket.day1.every((t) => t.completed);

        return {
            tasks, progress, completedCount, markTaskComplete, resetOnboarding,
            isTaskComplete, tasksByBucket, day1Done, isLoaded,
        };
    }, [tasks, markTaskComplete, resetOnboarding, isTaskComplete, isLoaded]);

    return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = (): OnboardingContextValue => {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
    return ctx;
};

export default OnboardingContext;
