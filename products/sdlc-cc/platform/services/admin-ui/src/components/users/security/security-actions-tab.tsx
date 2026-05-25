'use client'

import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, Mail, Smartphone, UserCheck, UserX } from 'lucide-react'
import type { User } from '@/types/user-management'

interface SecurityActionsTabProps {
  user: User
  isSendingResetLink: boolean
  isResettingMFA: boolean
  isImpersonating: boolean
  onSendPasswordReset: () => void
  onResetMFA: () => void
  onImpersonateUser: () => void
}

export function SecurityActionsTab({
  user,
  isSendingResetLink,
  isResettingMFA,
  isImpersonating,
  onSendPasswordReset,
  onResetMFA,
  onImpersonateUser,
}: SecurityActionsTabProps) {
  return (
    <div className="space-y-4">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Administrative Actions</AlertTitle>
        <AlertDescription>
          These actions require elevated permissions and will be logged.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-2">
        <Button
          variant="outline"
          onClick={onSendPasswordReset}
          disabled={isSendingResetLink}
          className="justify-start"
        >
          <Mail className="h-4 w-4 mr-2" />
          {isSendingResetLink ? 'Sending...' : 'Send Password Reset'}
        </Button>

        <Button
          variant="outline"
          onClick={onResetMFA}
          disabled={isResettingMFA || !user.mfaEnabled}
          className="justify-start"
        >
          <Smartphone className="h-4 w-4 mr-2" />
          {isResettingMFA ? 'Resetting...' : 'Reset MFA'}
        </Button>

        <Button
          variant="outline"
          onClick={onImpersonateUser}
          disabled={isImpersonating}
          className="justify-start"
        >
          <UserCheck className="h-4 w-4 mr-2" />
          {isImpersonating ? 'Starting...' : 'Impersonate User'}
        </Button>

        <Button
          variant="destructive"
          onClick={() => {
            // Handle lock account
          }}
          className="justify-start"
        >
          <UserX className="h-4 w-4 mr-2" />
          Lock Account
        </Button>
      </div>
    </div>
  )
}
