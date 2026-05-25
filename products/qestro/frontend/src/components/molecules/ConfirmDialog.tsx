import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-sm rounded-2xl p-6"
            style={{
              backgroundColor: 'rgba(15, 15, 30, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <h3
              id="confirm-title"
              className="text-lg font-semibold mb-2"
              style={{ color: 'var(--text-primary, #fff)' }}
            >
              {title}
            </h3>
            <p
              className="text-sm mb-6"
              style={{ color: 'var(--text-muted, #9ca3af)' }}
            >
              {message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="h-11 px-4 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-white/10"
                style={{
                  color: 'var(--text-secondary, #d1d5db)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => { onConfirm(); onClose(); }}
                className={clsx(
                  'h-11 px-4 rounded-xl text-sm font-medium text-white transition-all duration-200',
                  'hover:shadow-lg active:scale-[0.98]',
                )}
                style={{
                  background: variant === 'danger'
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
