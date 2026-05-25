'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  defaultOpen?: boolean
}

const CollapsibleContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {},
})

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ open: controlledOpen, onOpenChange, defaultOpen = false, className, children, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const handleOpenChange = onOpenChange ?? setInternalOpen

    return (
      <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
        <div ref={ref} className={cn(className)} {...props}>
          {children}
        </div>
      </CollapsibleContext.Provider>
    )
  }
)
Collapsible.displayName = 'Collapsible'

const CollapsibleTrigger = ({
  className,
  onClick,
  asChild = false,
  ...props
}: React.HTMLAttributes<HTMLElement> & { asChild?: boolean }) => {
  const { open, onOpenChange } = React.useContext(CollapsibleContext)
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : 'button'}
      className={cn(className)}
      onClick={(e: React.MouseEvent<HTMLElement>) => {
        onOpenChange(!open)
        onClick?.(e)
      }}
      {...(props as Record<string, unknown>)}
    />
  )
}
CollapsibleTrigger.displayName = 'CollapsibleTrigger'

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open } = React.useContext(CollapsibleContext)
  if (!open) return null
  return (
    <div ref={ref} className={cn(className)} {...props}>
      {children}
    </div>
  )
})
CollapsibleContent.displayName = 'CollapsibleContent'

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
