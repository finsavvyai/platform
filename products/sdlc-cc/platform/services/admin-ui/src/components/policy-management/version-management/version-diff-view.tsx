// @ts-nocheck
/**
 * Version Diff View component
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

import { VersionComparison } from './types';

interface VersionDiffViewProps {
  comparison: VersionComparison;
  onClose: () => void;
}

export function VersionDiffView({ comparison, onClose }: VersionDiffViewProps) {
  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge>v{comparison.version1.version}</Badge>
              <ChevronRight className="h-4 w-4" />
              <Badge>v{comparison.version2.version}</Badge>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500" />
                Added: {comparison.summary.added}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500" />
                Removed: {comparison.summary.removed}
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500" />
                Modified: {comparison.summary.modified}
              </span>
            </div>
          </div>

          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-2">
          {comparison.differences.map((diff, index) => (
            <div
              key={index}
              className={`p-3 rounded font-mono text-sm ${
                diff.type === 'added' ? 'bg-green-50 border-l-4 border-green-500' :
                diff.type === 'removed' ? 'bg-red-50 border-l-4 border-red-500' :
                'bg-yellow-50 border-l-4 border-yellow-500'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  Line {diff.lineNumber}
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    diff.impact === 'critical' ? 'border-red-500 text-red-600' :
                    diff.impact === 'high' ? 'border-orange-500 text-orange-600' :
                    diff.impact === 'medium' ? 'border-yellow-500 text-yellow-600' :
                    'border-gray-500'
                  }`}
                >
                  {diff.impact}
                </Badge>
              </div>

              {diff.type === 'added' && (
                <div className="text-green-700">+ {diff.newValue}</div>
              )}
              {diff.type === 'removed' && (
                <div className="text-red-700">- {diff.oldValue}</div>
              )}
              {diff.type === 'modified' && (
                <div className="space-y-1">
                  <div className="text-red-700">- {diff.oldValue}</div>
                  <div className="text-green-700">+ {diff.newValue}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
