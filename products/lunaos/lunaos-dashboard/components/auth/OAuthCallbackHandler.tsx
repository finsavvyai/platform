'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAuthToken } from '../../lib/api/client';

/**
 * Handles OAuth callback tokens passed as ?token=JWT in the URL.
 * The engine redirects to https://agents.lunaos.ai/dashboard?token=JWT
 * after a successful OAuth flow. This component extracts the token,
 * stores it, and cleans the URL.
 */
export function OAuthCallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) return;

        setAuthToken(token);

        // Remove token from URL without triggering a full navigation
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.pathname + url.search);

        // Refresh the page to pick up the new auth state
        router.refresh();
    }, [searchParams, router]);

    return null;
}
