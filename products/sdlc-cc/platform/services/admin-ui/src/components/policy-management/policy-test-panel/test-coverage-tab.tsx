// @ts-nocheck
/**
 * Test coverage tab for the Policy Test Panel
 */

'use client';

import React from 'react';
import { Separator } from '@/components/ui/separator';
import { XCircle } from 'lucide-react';
import { TestExecutionMetrics } from './types';

interface TestCoverageTabProps {
  metrics: TestExecutionMetrics;
}

function CoverageBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function TestCoverageTab({ metrics }: TestCoverageTabProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-3">Test Coverage</h3>
        <div className="space-y-3">
          <CoverageBar label="Lines" value={metrics.coverage} color="bg-green-500" />
          <CoverageBar label="Branches" value={metrics.coverage - 5} color="bg-blue-500" />
          <CoverageBar label="Functions" value={metrics.coverage + 5} color="bg-purple-500" />
          <CoverageBar label="Statements" value={metrics.coverage} color="bg-orange-500" />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Uncovered Paths</h3>
        <div className="space-y-1">
          {['rule_1', 'rule_2', 'exception_handler'].map((path, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <XCircle className="h-3 w-3 text-red-500" />
              <span className="text-muted-foreground">{path}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-semibold mb-3">Coverage Metrics</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Total Lines:</span>
            <span className="ml-2">245</span>
          </div>
          <div>
            <span className="text-muted-foreground">Covered:</span>
            <span className="ml-2">{Math.floor(245 * metrics.coverage / 100)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Missed:</span>
            <span className="ml-2">{Math.floor(245 * (100 - metrics.coverage) / 100)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Score:</span>
            <span className="ml-2 font-semibold">{metrics.coverage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
