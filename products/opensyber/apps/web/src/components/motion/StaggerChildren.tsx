'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
}

const containerVariants = (staggerDelay: number) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: staggerDelay,
    },
  },
});

const childVariants = (direction: string, distance: number, duration: number) => {
  const directionOffset = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  };

  return {
    hidden: { opacity: 0, ...(directionOffset[direction as keyof typeof directionOffset] ?? {}) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, ease: [0.25, 0.1, 0.25, 1] as const },
    },
  };
};

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.1,
  duration: _duration = 0.5,
  direction: _direction = 'up',
  distance: _distance = 24,
}: StaggerChildrenProps) {
  return (
    <motion.div
      className={className}
      variants={containerVariants(staggerDelay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  duration = 0.5,
  direction = 'up',
  distance = 24,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={childVariants(direction, distance, duration)}
    >
      {children}
    </motion.div>
  );
}
