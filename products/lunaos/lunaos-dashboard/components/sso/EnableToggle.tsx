/**
 * EnableToggle — small wrapper used on the IdP edit page.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface EnableToggleProps {
    enabled: boolean;
    isLoading: boolean;
    onToggle: () => void;
}

export function EnableToggle({ enabled, isLoading, onToggle }: EnableToggleProps) {
    return (
        <Button
            variant={enabled ? 'secondary' : 'outline'}
            size="md"
            isLoading={isLoading}
            onClick={onToggle}
            aria-label={enabled ? 'Disable provider' : 'Enable provider'}
        >
            {enabled ? 'Disable' : 'Enable'}
        </Button>
    );
}
