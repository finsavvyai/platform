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
import type { CreateTenantRequest } from '@/types/user-management'
import { Badge } from '@/components/ui/badge'
import { Building2, ShieldCheck } from 'lucide-react'

interface TenantCreateFormProps {
  open: boolean
  loading?: boolean
  onSubmit: (payload: CreateTenantRequest) => Promise<void>
  onClose: () => void
}

const PLAN_OPTIONS = [
  { id: 'starter', label: 'Starter', description: 'Up to 50 users, community support' },
  { id: 'professional', label: 'Professional', description: 'Up to 500 users, standard SLA' },
  { id: 'enterprise', label: 'Enterprise', description: 'Unlimited users, premium support' },
]

interface TenantFormState {
  name: string
  displayName: string
  domain: string
  planId: string
  adminName: string
  adminEmail: string
}

const INITIAL_STATE: TenantFormState = {
  name: '',
  displayName: '',
  domain: '',
  planId: 'starter',
  adminName: '',
  adminEmail: '',
}

export function TenantCreateForm({ open, loading, onSubmit, onClose }: TenantCreateFormProps) {
  const [form, setForm] = useState<TenantFormState>(INITIAL_STATE)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setForm(INITIAL_STATE)
      setErrors({})
    }
  }, [open])

  if (!open) {
    return null
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.name.trim()) {
      nextErrors.name = 'Tenant identifier is required.'
    }
    if (!form.displayName.trim()) {
      nextErrors.displayName = 'Display name is required.'
    }
    if (!form.domain.trim()) {
      nextErrors.domain = 'Domain is required.'
    }
    if (!form.adminEmail.trim()) {
      nextErrors.adminEmail = 'Admin email is required.'
    } else if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(form.adminEmail)) {
      nextErrors.adminEmail = 'Enter a valid admin email.'
    }
    if (!form.adminName.trim()) {
      nextErrors.adminName = 'Admin name is required.'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = <K extends keyof TenantFormState>(key: K, value: TenantFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!validate()) {
      return
    }

    await onSubmit({
      name: form.name,
      displayName: form.displayName,
      domain: form.domain,
      planId: form.planId,
      owner: {
        name: form.adminName,
        email: form.adminEmail,
      },
    })
  }

  return (
    <Card className="border-primary/40 bg-primary/5 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Building2 className="h-5 w-5" />
          Create tenant
        </CardTitle>
        <CardDescription>
          Provision a new tenant, assign an initial admin, and select the right plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tenant identifier</label>
            <Input
              value={form.name}
              onChange={(event) => handleChange('name', event.target.value)}
              placeholder="acme-corp"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Display name</label>
            <Input
              value={form.displayName}
              onChange={(event) => handleChange('displayName', event.target.value)}
              placeholder="Acme Corporation"
            />
            {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Domain</label>
            <Input
              value={form.domain}
              onChange={(event) => handleChange('domain', event.target.value)}
              placeholder="acme.sdlc.ai"
            />
            {errors.domain && <p className="text-xs text-destructive">{errors.domain}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Plan</label>
            <Select value={form.planId} onValueChange={(value) => handleChange('planId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose plan" />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {PLAN_OPTIONS.find((plan) => plan.id === form.planId)?.description}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Admin name</label>
            <Input
              value={form.adminName}
              onChange={(event) => handleChange('adminName', event.target.value)}
              placeholder="Jane Smith"
            />
            {errors.adminName && <p className="text-xs text-destructive">{errors.adminName}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Admin email</label>
            <Input
              value={form.adminEmail}
              onChange={(event) => handleChange('adminEmail', event.target.value)}
              placeholder="jane.smith@acme.com"
            />
            {errors.adminEmail && <p className="text-xs text-destructive">{errors.adminEmail}</p>}
          </div>
        </div>

        <div className="rounded-md border border-dashed border-primary/40 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Security defaults
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Newly created tenants inherit platform-wide baseline policies. Fine-grained adjustments
            can be made after provisioning.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">MFA recommended</Badge>
            <Badge variant="outline">Zero-trust perimeter</Badge>
            <Badge variant="outline">DLP defaults</Badge>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Provisioning…' : 'Create tenant'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
