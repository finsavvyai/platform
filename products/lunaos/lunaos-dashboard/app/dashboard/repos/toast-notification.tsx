'use client';

export interface ToastData {
    type: 'success' | 'error';
    message: string;
}

interface ToastNotificationProps {
    toast: ToastData;
    onDismiss: () => void;
}

export function ToastNotification({ toast, onDismiss }: ToastNotificationProps) {
    const colorClasses = toast.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        : 'bg-red-500/10 border-red-500/30 text-red-300';

    return (
        <div
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right ${colorClasses}`}
        >
            <span>{toast.type === 'success' ? '\u2705' : '\u274C'}</span>
            {toast.message}
            <button
                onClick={onDismiss}
                className="ml-2 text-neutral-500 hover:text-neutral-300"
            >
                \u2715
            </button>
        </div>
    );
}
