import { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../contexts/ThemeContext';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'bottom' }: TooltipProps) {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isVisible && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();

      let top = 0;
      let left = rect.left + rect.width / 2;

      if (position === 'top') {
        top = rect.top - 10;
      } else if (position === 'bottom') {
        top = rect.bottom + 10;
      } else if (position === 'left') {
        top = rect.top + rect.height / 2;
        left = rect.left - 10;
      } else if (position === 'right') {
        top = rect.top + rect.height / 2;
        left = rect.right + 10;
      }

      setCoords({ top, left });
    }
  }, [isVisible, position]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {children}
      {isVisible && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: position === 'top' ? 'translate(-50%, -100%)' :
                      position === 'bottom' ? 'translate(-50%, 0%)' :
                      position === 'left' ? 'translate(-100%, -50%)' :
                      'translate(0%, -50%)',
            zIndex: 9999999,
            padding: '10px 16px',
            background: '#FF0080',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 800,
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(255,0,128,0.8), 0 0 0 4px #ffffff, 0 0 20px rgba(255,0,128,1)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            letterSpacing: '0.3px',
          }}
        >
          {content}
          <div
            style={{
              position: 'absolute',
              width: '10px',
              height: '10px',
              background: '#FF0080',
              transform: position === 'top' ? 'translate(-50%, 50%) rotate(45deg)' :
                        position === 'bottom' ? 'translate(-50%, -50%) rotate(45deg)' :
                        position === 'left' ? 'translate(50%, -50%) rotate(45deg)' :
                        'translate(-50%, -50%) rotate(45deg)',
              ...(position === 'top' && { bottom: '-5px', left: '50%' }),
              ...(position === 'bottom' && { top: '-5px', left: '50%' }),
              ...(position === 'left' && { right: '-5px', top: '50%' }),
              ...(position === 'right' && { left: '-5px', top: '50%' }),
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
