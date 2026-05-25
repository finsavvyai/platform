import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { createAppleStyle, APPLE_COLORS, APPLE_SPACING, APPLE_BORDER_RADIUS, APPLE_SHADOWS, APPLE_ANIMATIONS, APPLE_BLUR } from '../../design-system/AppleDesignSystem';

interface AppleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  preventClose?: boolean;
  className?: string;
}

const AppleModal: React.FC<AppleModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'medium',
  showCloseButton = true,
  closeOnBackdropClick = true,
  preventClose = false,
  className = ''
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !preventClose) {
      onClose();
    }
  }, [onClose, preventClose]);

  // Trap focus within modal
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (!modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }
  }, []);

  // Handle modal open/close
  useEffect(() => {
    if (isOpen) {
      // Store previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Add event listeners
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', trapFocus);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';

      // Focus modal
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 100);
    } else {
      // Clean up
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = '';

      // Restore focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown, trapFocus]);

  // Size styles
  const sizeStyles = {
    small: {
      maxWidth: '480px',
      width: '90%'
    },
    medium: {
      maxWidth: '640px',
      width: '90%'
    },
    large: {
      maxWidth: '960px',
      width: '95%'
    },
    fullscreen: {
      maxWidth: '100vw',
      width: '100vw',
      height: '100vh',
      borderRadius: 0
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`apple-modal-overlay ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: APPLE_Z_INDEX.modal,
        padding: APPLE_SPACING.lg,
        animation: `fadeIn ${APPLE_ANIMATIONS.duration.standard} ${APPLE_ANIMATIONS.ease.decelerate}`,
        ...APPLE_BLUR.glass.dark
      }}
      onClick={closeOnBackdropClick && !preventClose ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={subtitle ? 'modal-subtitle' : undefined}
    >
      <div
        ref={modalRef}
        className="apple-modal"
        tabIndex={-1}
        style={{
          ...sizeStyles[size],
          backgroundColor: APPLE_COLORS.system.background.primary,
          borderRadius: size === 'fullscreen' ? 0 : APPLE_BORDER_RADIUS.xl,
          boxShadow: APPLE_SHADOWS.xl,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: `scaleIn ${APPLE_ANIMATIONS.duration.standard} ${APPLE_ANIMATIONS.ease.spring}`,
          outline: 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <header
            style={{
              padding: APPLE_SPACING.xl,
              borderBottom: `1px solid ${APPLE_COLORS.system.separator.tertiary}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}
          >
            <div>
              {title && (
                <h2
                  id="modal-title"
                  style={{
                    ...APPLE_TYPOGRAPHY.titleLarge,
                    color: APPLE_COLORS.system.label.primary,
                    margin: 0
                  }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p
                  id="modal-subtitle"
                  style={{
                    ...APPLE_TYPOGRAPHY.bodyMedium,
                    color: APPLE_COLORS.system.label.secondary,
                    margin: `${APPLE_SPACING.xs} 0 0 0`
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>

            {showCloseButton && !preventClose && (
              <button
                onClick={onClose}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: APPLE_BORDER_RADIUS.full,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: APPLE_COLORS.system.label.tertiary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: `all ${APPLE_ANIMATIONS.duration.fast} ${APPLE_ANIMATIONS.ease.standard}`,
                  '&:hover': {
                    backgroundColor: APPLE_COLORS.system.fill.secondary,
                    color: APPLE_COLORS.system.label.primary
                  },
                  '&:active': {
                    transform: 'scale(0.95)'
                  }
                }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}

        {/* Content */}
        <div
          style={{
            padding: title ? 0 : APPLE_SPACING.xl,
            flex: 1,
            overflow: 'auto'
          }}
        >
          {children}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Custom scrollbar for modal content */
        .apple-modal > div:last-child::-webkit-scrollbar {
          width: 8px;
        }

        .apple-modal > div:last-child::-webkit-scrollbar-track {
          background: ${APPLE_COLORS.system.background.secondary};
        }

        .apple-modal > div:last-child::-webkit-scrollbar-thumb {
          background: ${APPLE_COLORS.system.separator.primary};
          border-radius: 4px;
        }

        .apple-modal > div:last-child::-webkit-scrollbar-thumb:hover {
          background: ${APPLE_COLORS.system.separator.secondary};
        }
      `}</style>
    </div>
  );
};

// Need to add missing imports
const APPLE_Z_INDEX = {
  modal: 1400
};

const APPLE_TYPOGRAPHY = {
  titleLarge: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.3,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'
  },
  bodyMedium: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif'
  }
};

export default AppleModal;
