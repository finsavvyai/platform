import React from 'react'
import { cn } from '@/lib/utils'

interface AccordionProps {
  type?: 'single' | 'multiple'
  className?: string
  children: React.ReactNode
}

const Accordion: React.FC<AccordionProps> = ({
  className,
  children,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {children}
    </div>
  )
}

interface AccordionItemProps {
  value: string
  className?: string
  children: React.ReactNode
}

const AccordionItem: React.FC<AccordionItemProps> = ({
  className,
  children,
}) => {
  return (
    <div className={cn('border-b', className)}>
      {children}
    </div>
  )
}

interface AccordionTriggerProps {
  className?: string
  children: React.ReactNode
}

const AccordionTrigger: React.FC<AccordionTriggerProps> = ({
  className,
  children,
}) => {
  return (
    <button
      className={cn(
        'flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline',
        className
      )}
    >
      {children}
    </button>
  )
}

interface AccordionContentProps {
  className?: string
  children: React.ReactNode
}

const AccordionContent: React.FC<AccordionContentProps> = ({
  className,
  children,
}) => {
  return (
    <div className={cn('overflow-hidden text-sm pb-4 pt-0', className)}>
      {children}
    </div>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
