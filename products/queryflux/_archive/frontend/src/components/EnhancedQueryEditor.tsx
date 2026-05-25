import React, { useState, useRef, useEffect } from 'react';
import { Play, Save, History, Download, Loader2, AlertCircle, Code } from 'lucide-react';
import { sqlAutocomplete, AutocompleteItem, Table } from '../utils/sqlAutocomplete';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { KeyboardShortcutManager, defaultShortcuts } from '../utils/keyboardShortcuts';

interface EnhancedQueryEditorProps {
  initialQuery?: string;
  onExecute?: (query: string) => Promise<void>;
  onSave?: (query: string) => Promise<void>;
  tables?: Table[];
  isExecuting?: boolean;
}

export function EnhancedQueryEditor({
  initialQuery = '',
  onExecute,
  onSave,
  tables = [],
  isExecuting = false,
}: EnhancedQueryEditorProps) {
  const [query, setQuery] = useState(initialQuery);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shortcutManager = useRef(new KeyboardShortcutManager());

  useEffect(() => {
    sqlAutocomplete.setTables(tables);
  }, [tables]);

  useEffect(() => {
    // Register keyboard shortcuts
    const manager = shortcutManager.current;

    manager.register({
      ...defaultShortcuts.EXECUTE_QUERY,
      action: handleExecute,
    });

    manager.register({
      ...defaultShortcuts.SAVE,
      action: handleSave,
    });

    manager.register({
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      action: () => console.log('Show shortcuts modal'),
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      manager.handleKeyDown(e);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      manager.clear();
    };
  }, [query]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuery = e.target.value;
    const newCursorPosition = e.target.selectionStart;

    setQuery(newQuery);
    setCursorPosition(newCursorPosition);

    // Trigger autocomplete
    const suggestions = sqlAutocomplete.getSuggestions(newQuery, newCursorPosition);

    if (suggestions.length > 0) {
      const position = getCursorPixelPosition();
      setAutocompletePosition(position);
      setAutocompleteItems(suggestions);
      setShowAutocomplete(true);
      setSelectedItemIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  };

  const getCursorPixelPosition = (): { top: number; left: number } => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };

    const textBeforeCursor = query.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines.length;
    const currentColumn = lines[lines.length - 1].length;

    const rect = textarea.getBoundingClientRect();
    const lineHeight = 24; // Approximate line height
    const charWidth = 8.4; // Approximate character width for monospace

    return {
      top: rect.top + currentLine * lineHeight + 30,
      left: rect.left + currentColumn * charWidth + 10,
    };
  };

  const handleAutocompleteSelect = (item: AutocompleteItem) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const textBefore = query.substring(0, cursorPosition);
    const textAfter = query.substring(cursorPosition);

    // Find the start of the current word
    const wordStart = textBefore.search(/[@\w]*$/);
    const newTextBefore = textBefore.substring(0, wordStart);

    const newQuery = newTextBefore + item.insertText + textAfter;
    const newCursorPosition = (newTextBefore + item.insertText).length;

    setQuery(newQuery);
    setShowAutocomplete(false);

    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
      setCursorPosition(newCursorPosition);
    }, 0);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedItemIndex((prev) =>
          prev < autocompleteItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedItemIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        if (showAutocomplete && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          handleAutocompleteSelect(autocompleteItems[selectedItemIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowAutocomplete(false);
        break;
      case 'Tab':
        if (autocompleteItems.length > 0) {
          e.preventDefault();
          handleAutocompleteSelect(autocompleteItems[selectedItemIndex]);
        }
        break;
    }
  };

  const handleExecute = async () => {
    if (!onExecute || isExecuting) return;

    const selectedText = window.getSelection()?.toString();
    const queryToExecute = selectedText || query;

    if (queryToExecute.trim()) {
      await onExecute(queryToExecute);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    await onSave(query);
  };

  const formatSQL = () => {
    // Basic SQL formatting
    let formatted = query
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bJOIN\b/gi, '\nJOIN')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bLIMIT\b/gi, '\nLIMIT');

    formatted = formatted.replace(/^\s+/, '').replace(/\n{3,}/g, '\n\n');
    setQuery(formatted);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExecute}
            disabled={isExecuting || !query.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExecuting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Run Query
            <kbd className="ml-2 px-2 py-0.5 text-xs bg-blue-700 rounded">Ctrl+Enter</kbd>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
            <kbd className="ml-1 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">Ctrl+S</kbd>
          </button>

          <button
            onClick={formatSQL}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            title="Format SQL (Ctrl+Shift+F)"
          >
            <Code className="w-4 h-4" />
            Format
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleTextareaKeyDown}
          placeholder="Type your SQL query here... Use @ to reference tables"
          className="w-full h-full p-4 font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none focus:outline-none"
          spellCheck={false}
        />

        {showAutocomplete && (
          <AutocompleteDropdown
            items={autocompleteItems}
            selectedIndex={selectedItemIndex}
            position={autocompletePosition}
            onSelect={handleAutocompleteSelect}
            onClose={() => setShowAutocomplete(false)}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            Line {query.substring(0, cursorPosition).split('\n').length}:{' '}
            {cursorPosition - query.lastIndexOf('\n', cursorPosition - 1)}
          </span>
          <span>{query.length} characters</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          <span>Press ? for keyboard shortcuts</span>
        </div>
      </div>
    </div>
  );
}
