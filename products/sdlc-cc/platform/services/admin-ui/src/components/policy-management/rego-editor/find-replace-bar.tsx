// @ts-nocheck
/**
 * Find and Replace bar for the Rego Editor
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Replace, XSquare } from 'lucide-react';

interface FindReplaceBarProps {
  findText: string;
  replaceText: string;
  caseSensitive: boolean;
  useRegex: boolean;
  onFindTextChange: (value: string) => void;
  onReplaceTextChange: (value: string) => void;
  onCaseSensitiveChange: (value: boolean) => void;
  onUseRegexChange: (value: boolean) => void;
  onFind: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export function FindReplaceBar({
  findText,
  replaceText,
  caseSensitive,
  useRegex,
  onFindTextChange,
  onReplaceTextChange,
  onCaseSensitiveChange,
  onUseRegexChange,
  onFind,
  onReplace,
  onReplaceAll,
  onClose
}: FindReplaceBarProps) {
  return (
    <div className="mt-2 p-2 bg-white border rounded-lg">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="find" className="text-xs">Find:</Label>
          <Input
            id="find"
            value={findText}
            onChange={(e) => onFindTextChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onFind(); }}
            className="w-48 h-8 text-sm"
            placeholder="Search..."
          />
          <Button size="sm" variant="outline" onClick={onFind}>
            <Search className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Label htmlFor="replace" className="text-xs">Replace:</Label>
          <Input
            id="replace"
            value={replaceText}
            onChange={(e) => onReplaceTextChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onReplace(); }}
            className="w-48 h-8 text-sm"
            placeholder="Replace with..."
          />
          <Button size="sm" variant="outline" onClick={onReplace}>
            <Replace className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={onReplaceAll}>
            All
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => onCaseSensitiveChange(e.target.checked)}
            />
            Case Sensitive
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => onUseRegexChange(e.target.checked)}
            />
            Regex
          </label>
        </div>

        <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">
          <XSquare className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
