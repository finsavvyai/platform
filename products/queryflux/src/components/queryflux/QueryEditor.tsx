import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Play, Save, Download, Upload, FileCode } from 'lucide-react';
import { Button } from '../ui/Button';

interface QueryEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onExecute?: (query: string) => void;
  onSave?: (query: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function QueryEditor({
  value = '',
  onChange,
  onExecute,
  onSave,
  readOnly = false,
  className,
}: QueryEditorProps) {
  const [query, setQuery] = useState(value);
  const [selectedText, setSelectedText] = useState('');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setQuery(newValue);
      onChange?.(newValue);
    },
    [onChange]
  );

  const handleExecute = useCallback(() => {
    const queryToExecute = selectedText || query;
    if (queryToExecute.trim()) {
      onExecute?.(queryToExecute.trim());
    }
  }, [query, selectedText, onExecute]);

  const handleSave = useCallback(() => {
    if (query.trim()) {
      onSave?.(query.trim());
    }
  }, [query, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Execute on Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
      // Save on Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Tab support
      if (e.key === 'Tab') {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue = query.substring(0, start) + '  ' + query.substring(end);
        setQuery(newValue);
        onChange?.(newValue);
        // Set cursor position after the inserted tab
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 2;
        }, 0);
      }
    },
    [query, handleExecute, handleSave, onChange]
  );

  return (
    <div className={cn('flex h-full flex-col overflow-hidden rounded-2xl bg-background/45', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card/45 p-3">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleExecute} disabled={!query.trim()}>
            <Play className="w-4 h-4 mr-2" />
            Execute
          </Button>
          <Button size="sm" variant="outline" onClick={handleSave} disabled={!query.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost">
            <Upload className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost">
            <Download className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost">
            <FileCode className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative flex-1 overflow-hidden">
        <textarea
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={(e) => {
            const target = e.target as HTMLTextAreaElement;
            const selected = target.value.substring(
              target.selectionStart,
              target.selectionEnd
            );
            setSelectedText(selected);
          }}
          readOnly={readOnly}
          className={cn(
            'h-full w-full resize-none bg-transparent py-5 pl-16 pr-5 text-foreground',
            'font-mono text-sm leading-relaxed',
            'focus:outline-none focus:ring-0',
            'placeholder:text-muted-foreground'
          )}
          placeholder="-- Enter your SQL query here&#10;-- Press Ctrl+Enter to execute&#10;-- Press Ctrl+S to save"
          spellCheck={false}
        />

        {/* Line Numbers (optional enhancement) */}
        <div className="pointer-events-none absolute left-0 top-0 select-none border-r border-border/60 bg-card/25 px-4 py-5 font-mono text-sm text-muted-foreground/50">
          {query.split('\n').map((_, i) => (
            <div key={i} className="leading-relaxed">
              {i + 1}
            </div>
          ))}
        </div>

        <div className="pl-10 pr-4">
          {/* This creates space for line numbers */}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-border/70 bg-card/45 px-4 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Lines: {query.split('\n').length}</span>
          <span>Chars: {query.length}</span>
          {selectedText && <span>Selected: {selectedText.length}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>SQL</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
