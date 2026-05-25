/**
 * IdpTypeBadge — small visual chip distinguishing SAML vs OIDC providers.
 * Semantic colors only: blue=SAML, purple=OIDC.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import type { IdpType } from '@/lib/api/sso';

interface IdpTypeBadgeProps {
    type: IdpType;
    className?: string;
}

const styles: Record<IdpType, string> = {
    saml: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    oidc: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
};

export function IdpTypeBadge({ type, className }: IdpTypeBadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
                styles[type],
                className
            )}
        >
            {type.toUpperCase()}
        </span>
    );
}
