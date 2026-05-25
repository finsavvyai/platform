import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { useTheme } from '../theme/useTheme';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (config: { message: string; type: ToastType }) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(
  undefined
);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    ({ message, type }: { message: string; type: ToastType }) => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  const { theme } = useTheme();
  const colorScheme = colors[theme];

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: spacing[4],
    right: spacing[4],
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
  };

  return (
    <div style={containerStyle}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const { theme } = useTheme();
  const colorScheme = colors[theme];

  const typeColors: Record<ToastType, string> = {
    success: colorScheme.success,
    error: colorScheme.destructive,
    info: colorScheme.primary,
  };

  const style: React.CSSProperties = {
    padding: `${spacing[3]} ${spacing[4]}`,
    borderRadius: '8px',
    backgroundColor: typeColors[toast.type],
    color: '#FFFFFF',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
    fontSize: '14px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    animation: 'slideIn 0.3s ease',
  };

  return <div style={style}>{toast.message}</div>;
};
