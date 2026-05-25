// @ts-nocheck
/**
 * Policy navigation breadcrumb bar
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  FileText,
  GitBranch,
  Code,
  TestTube,
  Rocket,
  BarChart3,
  History,
  ChevronRight,
} from 'lucide-react';

import { Policy } from '@/types/policy-management';

interface PolicyNavBreadcrumbProps {
  selectedPolicy: Policy | null;
  activeView: string;
  onViewChange: (view: string) => void;
}

export function PolicyNavBreadcrumb({
  selectedPolicy,
  activeView,
  onViewChange,
}: PolicyNavBreadcrumbProps) {
  return (
    <div className="border-b bg-white px-4 py-2">
      <div className="flex items-center gap-2 text-sm">
        <Button variant="ghost" size="sm" onClick={() => onViewChange('list')}
          className={activeView === 'list' ? 'bg-gray-100' : ''}>
          <FileText className="h-3 w-3 mr-1" />Policies
        </Button>

        {selectedPolicy && (
          <>
            <ChevronRight className="h-3 w-3 text-gray-400" />
            <span className="font-medium">{selectedPolicy.name}</span>
            <ChevronRight className="h-3 w-3 text-gray-400" />

            <Button variant="ghost" size="sm" onClick={() => onViewChange('builder')}
              className={activeView === 'builder' ? 'bg-gray-100' : ''}>
              <GitBranch className="h-3 w-3 mr-1" />Visual Builder
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onViewChange('code')}
              className={activeView === 'code' ? 'bg-gray-100' : ''}>
              <Code className="h-3 w-3 mr-1" />Code Editor
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onViewChange('test')}
              className={activeView === 'test' ? 'bg-gray-100' : ''}>
              <TestTube className="h-3 w-3 mr-1" />Test
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onViewChange('deploy')}
              className={activeView === 'deploy' ? 'bg-gray-100' : ''}>
              <Rocket className="h-3 w-3 mr-1" />Deploy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onViewChange('impact')}
              className={activeView === 'impact' ? 'bg-gray-100' : ''}>
              <BarChart3 className="h-3 w-3 mr-1" />Impact
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onViewChange('versions')}
              className={activeView === 'versions' ? 'bg-gray-100' : ''}>
              <History className="h-3 w-3 mr-1" />Versions
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
