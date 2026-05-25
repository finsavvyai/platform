import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

const positionStyles: Record<string, React.CSSProperties> = {
  top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 },
  bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 },
  left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 },
  right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 },
};

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 500,
}) => {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            role="tooltip"
            className="absolute z-50 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap pointer-events-none"
            style={{
              ...positionStyles[position],
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: '#ffffff',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Tooltip;
