// @ts-nocheck
/**
 * Canvas toolbar for the Visual Policy Builder
 */

'use client';

import React from 'react';
import { Panel } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Filter, Zap, Activity, CheckSquare, Trash2 } from 'lucide-react';

interface CanvasToolbarProps {
  onAddCondition: () => void;
  onAddAction: () => void;
  onAddDecision: () => void;
  onValidate: () => void;
  onClear: () => void;
}

export function CanvasToolbar({
  onAddCondition,
  onAddAction,
  onAddDecision,
  onValidate,
  onClear
}: CanvasToolbarProps) {
  return (
    <Panel position="top-right" className="bg-white border rounded-lg shadow-lg p-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onAddCondition} title="Add Condition Node">
          <Filter className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onAddAction} title="Add Action Node">
          <Zap className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onAddDecision} title="Add Decision Node">
          <Activity className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button size="sm" variant="ghost" onClick={onValidate} title="Validate Policy">
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear} title="Clear Canvas">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Panel>
  );
}
