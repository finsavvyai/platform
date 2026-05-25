// @ts-nocheck
/**
 * Approval dialog for deployment
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock, ThumbsUp } from 'lucide-react';
import { DeploymentEnvironment } from '@/types/policy-management';
import { Approver } from './types';

interface ApprovalDialogProps {
  environment: DeploymentEnvironment;
  approvers: Approver[];
  selectedApprovers: string[];
  approvalComment: string;
  onApproversChange: (ids: string[]) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ApprovalDialog({
  environment, approvers, selectedApprovers, approvalComment,
  onApproversChange, onCommentChange, onSubmit, onCancel
}: ApprovalDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-[600px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Deployment Approval Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              This policy requires approval before deployment to {environment}.
            </AlertDescription>
          </Alert>

          <div>
            <Label>Approvers</Label>
            <div className="mt-2 space-y-2">
              {approvers.map(approver => (
                <label key={approver.id} className="flex items-center gap-3 p-2 border rounded cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedApprovers.includes(approver.id)}
                    onChange={(e) => {
                      if (e.target.checked) onApproversChange([...selectedApprovers, approver.id]);
                      else onApproversChange(selectedApprovers.filter(a => a !== approver.id));
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{approver.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {approver.role} - {approver.email}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="approval-comment">Comment</Label>
            <Textarea
              id="approval-comment"
              value={approvalComment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder="Explain why this deployment is needed..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={onSubmit} disabled={!approvalComment.trim() || selectedApprovers.length === 0}>
              <ThumbsUp className="h-4 w-4 mr-1" />Submit for Approval
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
