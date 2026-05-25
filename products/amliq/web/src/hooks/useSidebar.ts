import { useState, useEffect } from 'react';
import { useIsMobile } from './useMediaQuery';

export function useSidebar() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(!isMobile);

  useEffect(() => {
    setIsOpen(!isMobile);
  }, [isMobile]);

  return {
    isOpen,
    toggle: () => setIsOpen((v) => !v),
    close: () => setIsOpen(false),
    open: () => setIsOpen(true),
  };
}
