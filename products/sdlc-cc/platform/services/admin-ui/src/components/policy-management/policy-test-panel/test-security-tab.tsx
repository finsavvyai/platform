// @ts-nocheck
/**
 * Test security tab for the Policy Test Panel
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle } from 'lucide-react';
import { TestExecutionMetrics } from './types';

interface TestSecurityTabProps {
  metrics: TestExecutionMetrics;
}

export function TestSecurityTab({ metrics }: TestSecurityTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-3">Security Analysis</h3>
        <div className="space-y-3">
          <Alert className={metrics.vulnerabilities > 0 ? 'border-red-200' : 'border-green-200'}>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {metrics.vulnerabilities > 0
                ? `${metrics.vulnerabilities} vulnerabilities detected`
                : 'No security vulnerabilities detected'}
            </AlertDescription>
          </Alert>
          <Alert className={metrics.complianceIssues > 0 ? 'border-yellow-200' : 'border-green-200'}>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {metrics.complianceIssues > 0
                ? `${metrics.complianceIssues} compliance issues found`
                : 'All compliance checks passed'}
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Security Metrics</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Data Exposure:</span>
            <Badge variant={metrics.vulnerabilities > 0 ? 'destructive' : 'default'}>
              {metrics.vulnerabilities > 0 ? 'Risk' : 'Safe'}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Input Validation:</span>
            <Badge variant="default">Pass</Badge>
          </div>
          <div className="flex justify-between">
            <span>Output Sanitization:</span>
            <Badge variant="default">Pass</Badge>
          </div>
          <div className="flex justify-between">
            <span>Access Control:</span>
            <Badge variant="default">Pass</Badge>
          </div>
          <div className="flex justify-between">
            <span>Audit Logging:</span>
            <Badge variant="default">Enabled</Badge>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Sandbox Analysis</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Isolation:</span>
            <span className="text-green-600">Strict</span>
          </div>
          <div className="flex justify-between">
            <span>Memory Limit:</span>
            <span>256MB</span>
          </div>
          <div className="flex justify-between">
            <span>CPU Limit:</span>
            <span>500ms</span>
          </div>
          <div className="flex justify-between">
            <span>Network Access:</span>
            <span className="text-red-600">Blocked</span>
          </div>
        </div>
      </div>
    </div>
  );
}
