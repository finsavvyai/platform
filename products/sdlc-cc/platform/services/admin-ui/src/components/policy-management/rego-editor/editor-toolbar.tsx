// @ts-nocheck
/**
 * Toolbar for the Rego Editor
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Code,
  Save,
  Search,
  CheckSquare,
  RefreshCw
} from 'lucide-react';

interface EditorToolbarProps {
  isValid: boolean | null;
  isDirty: boolean;
  value: string;
  onValidate: () => void;
  onFormat: () => void;
  onToggleFindReplace: () => void;
  onTest?: (code: string) => void;
  onSave?: () => void;
}

export function EditorToolbar({
  isValid,
  isDirty,
  value,
  onValidate,
  onFormat,
  onToggleFindReplace,
  onTest,
  onSave
}: EditorToolbarProps) {
  return (
    <div className="border-b bg-gray-50 p-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={isValid === true ? 'default' : isValid === false ? 'destructive' : 'secondary'}>
            {isValid === true ? (
              <CheckCircle className="h-3 w-3 mr-1" />
            ) : isValid === false ? (
              <XCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1" />
            )}
            {isValid === null ? 'Unvalidated' : isValid ? 'Valid' : 'Invalid'}
          </Badge>

          {isDirty && (
            <Badge variant="outline" className="text-orange-600">
              <RefreshCw className="h-3 w-3 mr-1" />
              Modified
            </Badge>
          )}

          <Separator orientation="vertical" className="h-6" />

          <Button size="sm" variant="outline" onClick={onValidate} title="Validate Code">
            <CheckSquare className="h-4 w-4 mr-1" />Validate
          </Button>
          <Button size="sm" variant="outline" onClick={onFormat} title="Format Code (Ctrl+Shift+F)">
            <Code className="h-4 w-4 mr-1" />Format
          </Button>
          <Button size="sm" variant="outline" onClick={onToggleFindReplace} title="Find and Replace (Ctrl+F)">
            <Search className="h-4 w-4 mr-1" />Find
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button size="sm" onClick={() => onTest && onTest(value)} title="Test Policy" disabled={!isValid}>
            <Play className="h-4 w-4 mr-1" />Test
          </Button>
          <Button size="sm" onClick={onSave} title="Save (Ctrl+S)" disabled={!isDirty}>
            <Save className="h-4 w-4 mr-1" />Save
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{value.split('\n').length} lines</span>
          <span className="text-xs text-muted-foreground">{value.length} characters</span>
        </div>
      </div>
    </div>
  );
}
