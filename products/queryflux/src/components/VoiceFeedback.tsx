/**
 * Voice Feedback Toast Component
 */

import { X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface VoiceFeedbackProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function VoiceFeedback({ message, type, onClose }: VoiceFeedbackProps) {
  const { theme } = useTheme();

  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div
      className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg px-6 py-4 shadow-lg"
      style={{ backgroundColor: theme.colors.sidebar, border: `1px solid ${theme.colors.border}` }}
    >
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 animate-pulse rounded-full ${colors[type]}`} />
        <p className="text-sm font-medium" style={{ color: theme.colors.text }}>{message}</p>
        <button
          onClick={onClose}
          className="ml-2 rounded p-1 hover:bg-gray-700"
          style={{ color: theme.colors.textSecondary }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
