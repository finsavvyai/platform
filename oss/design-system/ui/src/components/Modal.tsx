import React, { useEffect, useRef } from 'react';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';
import { useTheme } from '../theme/useTheme';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  const { theme } = useTheme();
  const colorScheme = colors[theme];
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: colorScheme.background,
    borderRadius: '12px',
    padding: spacing[5],
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    fontFamily: 'SF Pro Display, -apple-system, sans-serif',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: spacing[3],
    color: colorScheme.foreground,
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        ref={modalRef}
        style={contentStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 style={titleStyle}>{title}</h2>}
        {children}
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';
