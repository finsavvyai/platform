'use client'

import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BulkConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bulkAction: string
  selectedCount: number
  isLoading: boolean
  onConfirm: () => void
}

export function BulkConfirmDialog({
  open,
  onOpenChange,
  bulkAction,
  selectedCount,
  isLoading,
  onConfirm,
}: BulkConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Bulk Action</DialogTitle>
          <DialogDescription>
            Are you sure you want to {bulkAction} {selectedCount} user(s)?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} Users`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface BulkInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  inviteEmails: string
  onEmailsChange: (value: string) => void
  onSend: () => void
}

export function BulkInviteDialog({
  open,
  onOpenChange,
  inviteEmails,
  onEmailsChange,
  onSend,
}: BulkInviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Invite Users</DialogTitle>
          <DialogDescription>
            Enter email addresses, one per line. We'll send invitation
            emails to all addresses.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="emails">Email Addresses</Label>
            <textarea
              id="emails"
              className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
              value={inviteEmails}
              onChange={(e) => onEmailsChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSend} disabled={!inviteEmails.trim()}>
            <Send className="mr-2 h-4 w-4" />
            Send Invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
