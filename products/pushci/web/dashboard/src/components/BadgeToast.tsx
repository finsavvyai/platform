import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface BadgeNotification {
  id: string;
  icon: string;
  name: string;
  xp: number;
}

interface BadgeToastContextType {
  showBadge: (icon: string, name: string, xp: number) => void;
}

const BadgeToastContext = createContext<BadgeToastContextType>({
  showBadge: () => {},
});

export const useBadgeToast = () => useContext(BadgeToastContext);

function BadgeToastNotification({
  item,
  onDismiss,
}: {
  item: BadgeNotification;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-amber-500/40 bg-surface-card px-4 py-3 shadow-2xl animate-slide-down min-w-[280px] max-w-[360px]"
    >
      <div
        className="absolute inset-0 rounded-xl animate-shimmer pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(245,158,11,0.12) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
        }}
      />
      <div className="relative flex items-center gap-3">
        <span className="text-2xl shrink-0">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-100">Badge Earned!</p>
          <p className="text-xs text-zinc-300 truncate">{item.name}</p>
        </div>
        <span className="text-xs font-bold text-amber-400 shrink-0">
          +{item.xp} XP
        </span>
        <button
          onClick={onDismiss}
          className="text-zinc-500 hover:text-zinc-300 text-xs shrink-0 p-1"
        >
          x
        </button>
      </div>
    </div>
  );
}

export function BadgeToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<BadgeNotification[]>([]);

  const showBadge = useCallback((icon: string, name: string, xp: number) => {
    const id = `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, icon, name, xp }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <BadgeToastContext.Provider value={{ showBadge }}>
      {children}
      <div className="fixed top-4 right-4 z-[9998] space-y-2">
        {toasts.map((t) => (
          <BadgeToastNotification
            key={t.id}
            item={t}
            onDismiss={() => dismiss(t.id)}
          />
        ))}
      </div>
    </BadgeToastContext.Provider>
  );
}
