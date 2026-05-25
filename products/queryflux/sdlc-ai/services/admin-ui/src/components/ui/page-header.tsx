import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { useUIStore } from '@/store'
import { Plus, Settings } from 'lucide-react'
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: Array<{
    label: string
    href?: string
  }>
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  children,
  className,
}: PageHeaderProps) {
  const { breadcrumbs } = useUIStore()

  return (
    <div className={cn('space-y-4', className)}>
      {/* Breadcrumb */}
      {(breadcrumb || breadcrumbs.length > 0) && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {(breadcrumb || breadcrumbs).map((item, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < (breadcrumb || breadcrumbs).length - 1 && (
                  <BreadcrumbSeparator />
                )}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Header content */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center space-x-2">{actions}</div>}
      </div>

      {/* Additional content */}
      {children}

      <Separator />
    </div>
  )
}

// Quick action button for page headers
export function PageHeaderAction({
  label,
  icon,
  onClick,
  variant = 'default',
  disabled = false,
}: {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive'
  disabled?: boolean
}) {
  return (
    <Button variant={variant} onClick={onClick} disabled={disabled}>
      {icon}
      {label}
    </Button>
  )
}

// Default add button
export function AddButton({ onClick, label = 'Add New', disabled = false }: {
  onClick: () => void
  label?: string
  disabled?: boolean
}) {
  return (
    <PageHeaderAction
      label={label}
      icon={<Plus className="mr-2 h-4 w-4" />}
      onClick={onClick}
      disabled={disabled}
    />
  )
}

// Default settings button
export function SettingsButton({ onClick, disabled = false }: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <PageHeaderAction
      label="Settings"
      icon={<Settings className="mr-2 h-4 w-4" />}
      onClick={onClick}
      variant="outline"
      disabled={disabled}
    />
  )
}
