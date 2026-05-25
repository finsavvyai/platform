import { useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import type { ReactNode } from 'react'

const appleEase = [0.25, 0.1, 0.25, 1]
const appleDuration = 0.8

export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: appleDuration, delay, ease: appleEase }}>
      {children}
    </motion.div>
  )
}

export function FadeUp({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: appleEase }}>
      {children}
    </motion.div>
  )
}

export function ScaleIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.7, delay, ease: appleEase }}>
      {children}
    </motion.div>
  )
}

export function SlideIn({ children, from = 'left', delay = 0 }: {
  children: ReactNode; from?: 'left' | 'right'; delay?: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, x: from === 'left' ? -32 : 32 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: appleDuration, delay, ease: appleEase }}>
      {children}
    </motion.div>
  )
}

export function Parallax({ children, speed = 0.3 }: { children: ReactNode; speed?: number }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100])
  return <motion.div ref={ref} style={{ y }}>{children}</motion.div>
}

export function StaggerGroup({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.1, delayChildren: delay } },
      }}>
      {children}
    </motion.div>
  )
}

export const staggerChild = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: appleEase } },
}
