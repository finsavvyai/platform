/**
 * DeleteConfirmModal — requires user to type the provider name to confirm deletion.
 * Accessible: aria-modal, focus trap, Esc to close, role=alertdialog.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DeleteConfirmModalProps {
    providerName: string;
    isLoading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

export function DeleteConfirmModal({
    providerName,
    isLoading = false,
    onConfirm,
    onClose,
}: DeleteConfirmModalProps) {
    const [typed, setTyped] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const firstFocusRef = useRef<HTMLButtonElement>(null);
    const lastFocusRef = useRef<HTMLButtonElement>(null);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Esc closes
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Focus trap
    function handleTabKey(e: React.KeyboardEvent) {
        if (e.key !== 'Tab') return;
        const focusable = document.querySelectorAll<HTMLElement>(
            '[data-modal-focus]'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    const confirmed = typed === providerName;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-desc"
            onKeyDown={handleTabKey}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog */}
            <div className="relative w-full max-w-md rounded-2xl bg-neutral-900 border border-red-500/20 p-6 shadow-2xl shadow-red-500/10 animate-scale-in">
                {/* Close button */}
                <button
                    ref={firstFocusRef}
                    data-modal-focus
                    onClick={onClose}
                    className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    aria-label="Close dialog"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>

                {/* Icon + heading */}
                <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-red-500/10">
                        <AlertTriangle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div>
                        <h2
                            id="delete-modal-title"
                            className="text-base font-semibold text-white"
                        >
                            Delete identity provider
                        </h2>
                        <p id="delete-modal-desc" className="mt-1 text-sm text-neutral-400">
                            This will permanently remove{' '}
                            <strong className="text-white">{providerName}</strong> and disable SSO
                            for all users in this domain. This action cannot be undone.
                        </p>
                    </div>
                </div>

                {/* Confirmation input */}
                <div className="mb-5">
                    <label
                        htmlFor="delete-confirm-input"
                        className="block text-sm font-medium text-neutral-300 mb-1.5"
                    >
                        Type <strong className="text-white font-mono">{providerName}</strong> to confirm
                    </label>
                    <input
                        id="delete-confirm-input"
                        ref={inputRef}
                        data-modal-focus
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        aria-describedby="delete-modal-desc"
                        aria-invalid={typed.length > 0 && !confirmed}
                        className={cn(
                            'w-full px-4 py-3 rounded-xl text-sm bg-white/5 border text-white placeholder-neutral-500',
                            'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all',
                            typed.length > 0 && !confirmed
                                ? 'border-red-500/60'
                                : 'border-white/10'
                        )}
                        placeholder={providerName}
                    />
                    {typed.length > 0 && !confirmed && (
                        <p className="mt-1.5 text-xs text-red-400" role="alert">
                            Name does not match
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <Button
                        data-modal-focus
                        variant="ghost"
                        size="md"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        ref={lastFocusRef}
                        data-modal-focus
                        variant="danger"
                        size="md"
                        disabled={!confirmed || isLoading}
                        isLoading={isLoading}
                        onClick={onConfirm}
                    >
                        Delete provider
                    </Button>
                </div>
            </div>
        </div>
    );
}
