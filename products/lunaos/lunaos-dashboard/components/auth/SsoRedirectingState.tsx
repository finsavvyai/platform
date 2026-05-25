/**
 * Shown while we are POST-ing to /initiate and waiting for the redirect.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';

export function SsoRedirectingState() {
    return (
        <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary-400" aria-hidden="true" />
            <p className="text-sm text-neutral-400">Redirecting to your identity provider…</p>
        </div>
    );
}
