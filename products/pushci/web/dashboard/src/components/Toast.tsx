import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (item: Omit<ToastItem, 'id'>) => void;
  confirm: (title: string, message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  confirm: () => Promise.resolve(false),
});

export const useToast = () => useContext(ToastContext);

const ICONS: Record<string, string> = {
  success: '*', error: '!', warning: '~', info: 'i',
};
const COLORS: Record<string, string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
};
const ICON_COLORS: Record<string, string> = {
  success: 'text-emerald-400 bg-emerald-500/20',
  error: 'text-red-400 bg-red-500/20',
  warning: 'text-amber-400 bg-amber-500/20',
  info: 'text-blue-400 bg-blue-500/20',
};

function ToastNotification({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, item.duration || 4000);
    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  const role = item.type === 'error' ? 'alert' : 'status';
  return (
    <div
      role={role}
      className={`glass rounded-xl border px-4 py-3 shadow-2xl animate-slide-down min-w-[300px] max-w-[420px] ${COLORS[item.type]}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${ICON_COLORS[item.type]}`}>
          {ICONS[item.type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100">
            <span className="sr-only">{item.type}: </span>
            {item.title}
          </p>
          {item.message && <p className="text-xs text-zinc-400 mt-0.5">{item.message}</p>}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-zinc-500 hover:text-zinc-300 text-xs shrink-0 p-1"
        >
          <span aria-hidden="true">x</span>
        </button>
      </div>
    </div>
  );
}

interface ConfirmState {
  title: string;
  message: string;
  resolve: (v: boolean) => void;
}

function ConfirmDialog({ state, onResolve }: { state: ConfirmState; onResolve: (v: boolean) => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = 'toast-confirm-title';
  const descId = 'toast-confirm-desc';

  useFocusTrap(dialogRef, {
    onEscape: () => onResolve(false),
    initialFocus: 'last',
  });

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onResolve(false); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="glass rounded-2xl border border-surface-border w-full max-w-sm mx-4 p-6 shadow-2xl animate-scale-in"
      >
        <h3 id={titleId} className="text-base font-semibold text-zinc-100">{state.title}</h3>
        <p id={descId} className="text-sm text-zinc-400 mt-2 leading-relaxed">{state.message}</p>
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="flex-1 rounded-xl border border-surface-border px-4 py-2.5 text-sm text-zinc-400 hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-400 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { ...item, id }]);
  }, []);

  const confirm = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise(resolve => setConfirmState({ title, message, resolve }));
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleConfirm = useCallback((v: boolean) => {
    if (!confirmState) return;
    confirmState.resolve(v);
    setConfirmState(null);
  }, [confirmState]);

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none"
      >
        <div className="space-y-2 pointer-events-auto">
          {toasts.map(t => (
            <ToastNotification key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      </div>
      {confirmState && <ConfirmDialog state={confirmState} onResolve={handleConfirm} />}
    </ToastContext.Provider>
  );
}
