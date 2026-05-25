// @ts-nocheck
/**
 * Impact Analysis Users Tab
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, AlertTriangle, Clock, Info } from 'lucide-react';

import { PolicyImpact } from '@/types/policy-management';

interface UsersTabProps {
  impact: PolicyImpact | null;
}

export function UsersTab({ impact }: UsersTabProps) {
  return (
    <div className="space-y-6">
      {/* User Impact Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Affected Users</span>
            </div>
            <p className="text-2xl font-bold">
              {impact?.userImpact.affectedUsers?.toLocaleString() || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="font-medium">Impact Level</span>
            </div>
            <p className="text-2xl font-bold capitalize">
              {impact?.userImpact.impactLevel || 'moderate'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Expected impact
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-green-500" />
              <span className="font-medium">Downtime</span>
            </div>
            <p className="text-2xl font-bold">
              {impact?.userImpact.downtimeWindows?.[0]?.duration || 0}m
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Expected downtime
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-lg font-semibold mb-4">User Notifications</h3>
        <div className="space-y-2">
          {impact?.userImpact.notifications.map((notification, index) => (
            <Alert key={index}>
              <Info className="h-4 w-4" />
              <AlertDescription>{notification}</AlertDescription>
            </Alert>
          ))}
        </div>
      </div>

      {/* Training Requirements */}
      {impact?.userImpact.trainingRequired && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Training Requirements</h3>
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-orange-800">
              Users will require training on the new authentication requirements and session management policies.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
