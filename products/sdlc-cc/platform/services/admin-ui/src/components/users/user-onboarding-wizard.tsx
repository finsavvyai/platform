import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { CreateUserRequest, Tenant, UserRole } from '@/types/user-management'
import { Building2, CheckCircle2, Circle, Shield, Users } from 'lucide-react'

interface UserOnboardingWizardProps {
  open: boolean
  tenants: Tenant[]
  roles: UserRole[]
  loading?: boolean
  onSubmit: (payload: CreateUserRequest) => Promise<void>
  onClose: () => void
}

const STEPS = [
  {
    id: 'account',
    title: 'Account details',
    description: 'Set up the basic account information.',
  },
  {
    id: 'access',
    title: 'Access & permissions',
    description: 'Select tenant and role assignments.',
  },
  {
    id: 'review',
    title: 'Review & invite',
    description: 'Confirm details before sending the invitation.',
  },
]

interface FormState {
  name: string
  email: string
  password: string
  tenantId: string
  role: string
  department: string
  location: string
  sendInvite: boolean
}

const initialFormState: FormState = {
  name: '',
  email: '',
  password: '',
  tenantId: '',
  role: '',
  department: '',
  location: '',
  sendInvite: true,
}

export function UserOnboardingWizard({
  open,
  tenants,
  roles,
  loading,
  onSubmit,
  onClose,
}: UserOnboardingWizardProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [form, setForm] = useState<FormState>(initialFormState)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentStep = STEPS[stepIndex]

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...initialFormState,
        tenantId: tenants[0]?.id ?? prev.tenantId,
        role: roles[0]?.id ?? prev.role,
      }))
      setErrors({})
      setStepIndex(0)
    }
  }, [open, tenants, roles])

  if (!open) {
    return null
  }

  const validateStep = (index: number = stepIndex) => {
    const stepErrors: Record<string, string> = {}
    if (index === 0) {
      if (!form.name.trim()) {
        stepErrors.name = 'Name is required.'
      }
      if (!form.email.trim()) {
        stepErrors.email = 'Email is required.'
      } else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(form.email)) {
        stepErrors.email = 'Enter a valid email address.'
      }
    }

    if (index === 1) {
      if (!form.tenantId) {
        stepErrors.tenantId = 'Select a tenant.'
      }
      if (!form.role) {
        stepErrors.role = 'Select a role.'
      }
    }

    if (index === 2 && !form.sendInvite && !form.password) {
      stepErrors.password = 'Provide a password if not sending an invite.'
    }

    setErrors(stepErrors)
    return Object.keys(stepErrors).length === 0
  }

  const goNext = () => {
    if (validateStep(stepIndex)) {
      setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1))
    }
  }

  const goPrevious = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSubmit = async () => {
    if (!validateStep(2)) {
      setStepIndex(2)
      return
    }

    const payload: CreateUserRequest = {
      email: form.email,
      name: form.name,
      role: form.role,
      tenantId: form.tenantId,
      sendInvite: form.sendInvite,
      password: form.sendInvite ? undefined : form.password || undefined,
      department: form.department || undefined,
      location: form.location || undefined,
    }

    await onSubmit(payload)
    onClose()
  }

  const stepProgress = ((stepIndex + 1) / STEPS.length) * 100

  return (
    <Card className="border-primary/40 bg-primary/5 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          User onboarding
        </CardTitle>
        <CardDescription>{currentStep?.description}</CardDescription>
        <div className="mt-4 flex items-center gap-3">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center gap-2">
              <Badge
                variant={index === stepIndex ? 'default' : index < stepIndex ? 'success' : 'outline'}
                className={cn(
                  'flex items-center gap-2',
                  index === stepIndex && 'ring-2 ring-primary/40'
                )}
              >
                {index < stepIndex ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : index === stepIndex ? (
                  <Circle className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs">{step.title}</span>
              </Badge>
              {index < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${stepProgress}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {stepIndex === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full name</label>
              <Input
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="Jane Doe"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Work email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                placeholder="jane.doe@company.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Input
                value={form.department}
                onChange={(event) => handleChange('department', event.target.value)}
                placeholder="Engineering, Finance, ... (optional)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input
                value={form.location}
                onChange={(event) => handleChange('location', event.target.value)}
                placeholder="Remote, NYC, ... (optional)"
              />
            </div>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Tenant
              </label>
              <Select
                value={form.tenantId}
                onValueChange={(value) => handleChange('tenantId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.displayName || tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tenantId && <p className="text-xs text-destructive">{errors.tenantId}</p>}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Role
              </label>
              <Select value={form.role} onValueChange={(value) => handleChange('role', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.displayName || role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
            </div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="space-y-4">
            <div className="rounded-md border border-border p-4">
              <h4 className="text-sm font-semibold">Invitation preferences</h4>
              <div className="mt-3 flex items-center gap-3">
                <Checkbox
                  checked={form.sendInvite}
                  onCheckedChange={(checked) => handleChange('sendInvite', Boolean(checked))}
                  id="send-invite"
                />
                <label htmlFor="send-invite" className="text-sm leading-tight">
                  Send invitation email to the user
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                If disabled, you must provide a temporary password and share it securely.
              </p>

              {!form.sendInvite && (
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium">Temporary password</label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => handleChange('password', event.target.value)}
                    placeholder="Enter a secure temporary password"
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
              )}
            </div>

            <div className="rounded-md border border-border p-4">
              <h4 className="text-sm font-semibold">Summary</h4>
              <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{form.name || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{form.email || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Tenant</dt>
                  <dd>
                    {tenants.find((tenant) => tenant.id === form.tenantId)?.displayName ?? '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>{roles.find((role) => role.id === form.role)?.displayName ?? '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Invite email</dt>
                  <dd>{form.sendInvite ? 'Will be sent automatically' : 'Manual password delivery'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={goPrevious}
              disabled={stepIndex === 0 || loading}
            >
              Back
            </Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button onClick={goNext} disabled={loading}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating…' : 'Create user'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
