// @ts-nocheck
/**
 * Rollback confirmation dialog
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface RollbackDialogProps {
  rollbackReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RollbackDialog({
  rollbackReason, onReasonChange, onConfirm, onCancel
}: RollbackDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-[500px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Confirm Rollback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              Rolling back will revert the policy to its previous version. This may affect active services.
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="rollback-reason">Reason for Rollback</Label>
            <Textarea
              id="rollback-reason"
              value={rollbackReason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Describe the issue that requires rollback..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm} disabled={!rollbackReason.trim()}>
              <RotateCcw className="h-4 w-4 mr-1" />Rollback
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
