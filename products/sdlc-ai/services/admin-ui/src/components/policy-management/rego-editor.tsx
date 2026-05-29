/**
 * Rego Code Editor Component
 *
 * Enterprise-grade Rego code editor with syntax highlighting,
 * validation, auto-completion, and security features
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  Code,
  FileText,
  Bug,
  Shield,
  Zap,
  Save,
  Copy,
  Download,
  Upload,
  Search,
  Replace,
  Settings,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  RefreshCw,
  Terminal,
  Database,
  GitBranch,
  CheckSquare,
  XSquare
} from 'lucide-react';

import {
  ValidatePolicyResponse,
  ValidationError,
  ValidationWarning,
  ValidationSuggestion,
  PolicyTestResult
} from '@/types/policy-management';

interface RegoEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  readOnly?: boolean;
  theme?: 'light' | 'dark' | 'vs-dark' | 'vs';
  fontSize?: number;
  wordWrap?: boolean;
  minimap?: boolean;
  validation?: ValidatePolicyResponse;
  onValidationChange?: (validation: ValidatePolicyResponse) => void;
  onSave?: () => void;
  onTest?: (code: string) => void;
  onFormat?: () => void;
  height?: string;
  showMiniMap?: boolean;
  showGutter?: boolean;
  showLineNumbers?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

// Rego language definition for Monaco
const regoLanguage = {
  // Default tokens
  tokenizer: {
    root: [
      // Comments
      [/#.*$/, 'comment'],

      // Keywords
      [/\b(package|import|default|allow|deny|with|as|not|every|some|in|if|else|contains|contains_prefix|contains_suffix|ends_with|equals|equal|greater_than|greater_than_or_equal_to|less_than|less_than_or_equal_to|plus|minus|multiply|divide|mod|and|or|is_set|is_number|is_string|is_boolean|is_array|is_object|is_null|count|sum|product|max|min|sort|sort_by|reverse|array_concat|array_slice|to_number|to_string|round|ceil|floor|abs|sqrt|rand_intn|now|time_ns|parse_int|parse_float|parse_json|parse_xml|format_int|format_float|http_send|opa_runtime|trace|print)\b/, 'keyword'],

      // Built-in functions
      [/\b(rego_metadata_version|trace|print)\b/, 'function'],

      // Strings
      [/"/, 'string', '@string_double'],
      [/'/, 'string', '@string_single'],

      // Numbers
      [/\b\d+(\.\d+)?\b/, 'number'],

      // Boolean
      [/\b(true|false)\b/, 'boolean'],

      // Null
      [/\b(null)\b/, 'keyword'],

      // Identifiers
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],

      // Operators
      [/[+\-*/%&|^~=!<>?]/, 'operator'],

      // Punctuation
      [/[{}()\[\];,\.]/, 'delimiter'],

      // Whitespace
      [/\s+/, 'white']
    ],

    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop']
    ],

    string_single: [
      [/[^\\']+/, 'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop']
    ]
  }
};

// Security rule snippets
const securitySnippets = [
  {
    label: 'Authentication Check',
    insertText: `package authz

default allow = false

allow {
    input.user.authenticated
    input.user.mfa_verified
    time.now_ns() - input.user.last_login < 86400000000000
}`,
    documentation: 'Basic authentication check with MFA requirement'
  },
  {
    label: 'Role-Based Access Control',
    insertText: `package rbac

default allow = false

allow {
    user_roles := data.roles[input.user.id]
    required_roles := data.resources[input.resource.id].roles
    count(user_roles & required_roles) > 0
}`,
    documentation: 'RBAC implementation with role checking'
  },
  {
    label: 'Data Access Control',
    insertText: `package data_access

default allow = false

allow {
    input.user.clearance >= input.data.classification
    data.purpose_allowed[input.context.purpose]
    not data.restricted_data[input.data.type]
}`,
    documentation: 'Data access control with clearance levels'
  },
  {
    label: 'API Rate Limiting',
    insertText: `package rate_limit

default allow = true

deny {
    count(requests[input.user.id][time.now_ns() // 1000000000]) > 100
}

requests[user_id][t] := req {
    req := input.requests[_]
    req.user.id == user_id
    req.timestamp // 1000000000 == t
}`,
    documentation: 'API rate limiting implementation'
  },
  {
    label: 'Compliance Check',
    insertText: `package compliance

default compliant = false

compliant {
    data.controls.gdpr.data_protection.enabled
    data.controls.sox.access_logs.enabled
    data.controls.pci.encryption_enabled
}`,
    documentation: 'Multi-framework compliance check'
  }
];

export default function RegoEditor({
  value,
  onChange,
  onBlur,
  onFocus,
  readOnly = false,
  theme = 'vs-dark',
  fontSize = 14,
  wordWrap = true,
  minimap = true,
  validation,
  onValidationChange,
  onSave,
  onTest,
  onFormat,
  height = '600px',
  showMiniMap = true,
  showGutter = true,
  showLineNumbers = true,
  autoSave = false,
  autoSaveDelay = 2000
}: RegoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [suggestions, setSuggestions] = useState<ValidationSuggestion[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Register Rego language
  useEffect(() => {
    import('monaco-editor').then(monacoInstance => {
      monacoRef.current = monacoInstance;

      // Register Rego language
      monacoInstance.languages.register({ id: 'rego' });

      // Set language configuration
      monacoInstance.languages.setLanguageConfiguration('rego', {
        comments: {
          lineComment: '#',
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ]
      });

      // Set language tokens provider
      monacoInstance.languages.setMonarchTokensProvider('rego', regoLanguage);

      // Register completion provider
      monacoInstance.languages.registerCompletionItemProvider('rego', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };

          const suggestions = [
            // Keywords
            ...['package', 'import', 'default', 'allow', 'deny', 'with', 'as', 'not', 'every', 'some', 'in', 'if', 'else'].map(keyword => ({
              label: keyword,
              kind: monacoInstance.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              range,
              detail: 'Rego keyword'
            })),

            // Built-in functions
            ...['contains', 'contains_prefix', 'contains_suffix', 'ends_with', 'equals', 'equal', 'greater_than', 'greater_than_or_equal_to', 'less_than', 'less_than_or_equal_to', 'plus', 'minus', 'multiply', 'divide', 'mod', 'and', 'or', 'is_set', 'is_number', 'is_string', 'is_boolean', 'is_array', 'is_object', 'is_null', 'count', 'sum', 'product', 'max', 'min', 'sort', 'sort_by', 'reverse', 'array_concat', 'array_slice', 'to_number', 'to_string', 'round', 'ceil', 'floor', 'abs', 'sqrt', 'rand_intn', 'now', 'time_ns', 'parse_int', 'parse_float', 'parse_json', 'parse_xml', 'format_int', 'format_float', 'http_send', 'opa_runtime'].map(func => ({
              label: func,
              kind: monacoInstance.languages.CompletionItemKind.Function,
              insertText: func + '()',
              range,
              detail: 'Built-in function'
            })),

            // Security snippets
            ...securitySnippets.map(snippet => ({
              label: snippet.label,
              kind: monacoInstance.languages.CompletionItemKind.Snippet,
              insertText: snippet.insertText,
              range,
              documentation: snippet.documentation,
              insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet
            }))
          ];

          return { suggestions };
        }
      });

      // Register hover provider
      monacoInstance.languages.registerHoverProvider('rego', {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (!word) return;

          // Provide hover information for built-in functions
          const functionDoc: Record<string, string> = {
            'contains': 'contains(array, element) - Check if array contains element',
            'count': 'count(collection) - Return number of items in collection',
            'sum': 'sum(collection) - Return sum of numeric values',
            'max': 'max(collection) - Return maximum value',
            'min': 'min(collection) - Return minimum value',
            'now': 'now() - Return current time in nanoseconds',
            'time_ns': 'time_ns() - Return current time in nanoseconds (deprecated)',
            'parse_json': 'parse_json(string) - Parse JSON string',
            'format_int': 'format_int(number) - Format number as integer string',
            'and': 'Logical AND operator',
            'or': 'Logical OR operator',
            'not': 'Logical NOT operator',
            'every': 'every variable in collection { rule } - Universal quantifier',
            'some': 'some variable in collection { rule } - Existential quantifier'
          };

          if (functionDoc[word.word]) {
            return {
              range: new monacoInstance.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
              ),
              contents: [
                { value: `**${word.word}**` },
                { value: functionDoc[word.word] }
              ]
            };
          }
        }
      });

      // Register signature help provider
      monacoInstance.languages.registerSignatureHelpProvider('rego', {
        signatureHelpTriggerCharacters: ['(', ','],
        provideSignatureHelp: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column
          });

          // Check if we're in a function call
          const functionMatch = textUntilPosition.match(/(\w+)\([^)]*$/);
          if (functionMatch) {
            const functionName = functionMatch[1];

            const signatures: Record<string, monacoInstance.languages.SignatureInformation> = {
              'contains': {
                label: 'contains(collection, element)',
                documentation: 'Check if collection contains element',
                parameters: [
                  { label: 'collection', documentation: 'Array or set to search' },
                  { label: 'element', documentation: 'Element to find' }
                ]
              },
              'count': {
                label: 'count(collection)',
                documentation: 'Count items in collection',
                parameters: [
                  { label: 'collection', documentation: 'Array, set, or object to count' }
                ]
              },
              'sum': {
                label: 'sum(collection)',
                documentation: 'Sum numeric values in collection',
                parameters: [
                  { label: 'collection', documentation: 'Collection of numbers' }
                ]
              }
            };

            if (signatures[functionName]) {
              return {
                value: signatures[functionName],
                activeParameter: 0
              };
            }
          }
        }
      });
    });
  }, []);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof monaco) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      fontSize,
      wordWrap: wordWrap ? 'on' : 'off',
      minimap: { enabled: minimap && showMiniMap },
      lineNumbers: showLineNumbers ? 'on' : 'off',
      glyphMargin: showGutter,
      folding: true,
      lineDecorationsWidth: 20,
      lineNumbersMinChars: 3,
      readOnly,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true
      },
      suggest: {
        showKeywords: true,
        showSnippets: true
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false
      }
    });

    // Add validation decorations
    if (validation) {
      updateDecorations(validation);
    }
  }, [fontSize, wordWrap, minimap, showMiniMap, showGutter, showLineNumbers, readOnly, validation]);

  // Update decorations based on validation
  const updateDecorations = useCallback((validation: ValidatePolicyResponse) => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    // Add error decorations
    validation.errors?.forEach(error => {
      decorations.push({
        range: new monaco.Range(
          error.line || 1,
          error.column || 1,
          error.line || 1,
          error.column || 1
        ),
        options: {
          className: 'error-decoration',
          glyphMarginClassName: 'error-glyph',
          hoverMessage: { value: error.message },
          isWholeLine: false,
          minimap: {
            color: '#ff4444',
            position: monaco.editor.MinimapPosition.Inline
          }
        }
      });
    });

    // Add warning decorations
    validation.warnings?.forEach(warning => {
      decorations.push({
        range: new monaco.Range(
          warning.line || 1,
          warning.column || 1,
          warning.line || 1,
          warning.column || 1
        ),
        options: {
          className: 'warning-decoration',
          glyphMarginClassName: 'warning-glyph',
          hoverMessage: { value: warning.message },
          isWholeLine: false,
          minimap: {
            color: '#ffaa00',
            position: monaco.editor.MinimapPosition.Inline
          }
        }
      });
    });

    editor.deltaDecorations([], decorations);
  }, []);

  // Handle value change
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
      setIsDirty(true);

      // Auto-save if enabled
      if (autoSave && autoSaveDelay) {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        const timer = setTimeout(() => {
          if (onSave) onSave();
          setIsDirty(false);
        }, autoSaveDelay);
        setAutoSaveTimer(timer);
      }
    }
  }, [onChange, autoSave, autoSaveDelay, onSave]);

  // Validate code
  const validateCode = useCallback(async () => {
    if (!onValidationChange) return;

    try {
      // Mock validation - in real implementation, call API
      const validation: ValidatePolicyResponse = {
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        metrics: {
          complexity: 5,
          maintainability: 85,
          testability: 90,
          security: 95,
          performance: 88
        }
      };

      setErrors(validation.errors);
      setWarnings(validation.warnings);
      setSuggestions(validation.suggestions);
      setIsValid(validation.valid);
      onValidationChange(validation);
      updateDecorations(validation);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  }, [onValidationChange, updateDecorations]);

  // Format code
  const formatCode = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const model = editor.getModel();
    if (!model) return;

    // Basic formatting - could be enhanced with a proper formatter
    const value = model.getValue();
    const lines = value.split('\n');
    const formatted: string[] = [];
    let indentLevel = 0;

    lines.forEach(line => {
      const trimmed = line.trim();

      // Adjust indent for closing braces
      if (trimmed.startsWith('}') && indentLevel > 0) {
        indentLevel--;
      }

      // Add line with proper indentation
      if (trimmed) {
        formatted.push('    '.repeat(indentLevel) + trimmed);
      } else {
        formatted.push('');
      }

      // Adjust indent for opening braces
      if (trimmed.endsWith('{')) {
        indentLevel++;
      } else if (trimmed.startsWith('default') || trimmed.startsWith('package')) {
        // Package and default rules don't increase indent
      } else if (trimmed && !trimmed.startsWith('#') && !trimmed.includes('}')) {
        // Regular rule body - increase indent
        if (!trimmed.includes('{') && !trimmed.includes('}')) {
          const nextLine = lines[lines.indexOf(line) + 1];
          if (nextLine && nextLine.trim().startsWith('{')) {
            indentLevel++;
          }
        }
      }
    });

    model.setValue(formatted.join('\n'));
  }, []);

  // Find and replace functionality
  const findInEditor = useCallback(() => {
    if (!editorRef.current || !findText) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const matches = model.findMatches(
      findText,
      true,
      useRegex,
      caseSensitive,
      null,
      true
    );

    if (matches.length > 0) {
      editor.setSelection(matches[0].range);
      editor.revealLineInCenter(matches[0].range.startLineNumber);
    }
  }, [findText, caseSensitive, useRegex]);

  const replaceInEditor = useCallback(() => {
    if (!editorRef.current || !findText) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const selection = editor.getSelection();
    if (selection.isEmpty()) {
      findInEditor();
    } else {
      model.pushEditOperations(
        [],
        [{ range: selection, text: replaceText }],
        () => null
      );
    }
  }, [findText, replaceText, findInEditor]);

  const replaceAllInEditor = useCallback(() => {
    if (!editorRef.current || !findText) return;

    const editor = editorRef.current;
    const model = editor.getModel();
    if (!model) return;

    const matches = model.findMatches(
      findText,
      true,
      useRegex,
      caseSensitive,
      null,
      false
    );

    const edits = matches.map(match => ({
      range: match.range,
      text: replaceText
    }));

    model.pushEditOperations([], edits, () => null);
  }, [findText, replaceText, caseSensitive, useRegex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editorRef.current) return;

      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (onSave) onSave();
      }

      // Ctrl/Cmd + Shift + F: Format
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        formatCode();
      }

      // Ctrl/Cmd + F: Find
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
      }

      // Escape: Close find/replace
      if (e.key === 'Escape' && showFindReplace) {
        setShowFindReplace(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, formatCode, showFindReplace]);

  // Update validation when prop changes
  useEffect(() => {
    if (validation) {
      setErrors(validation.errors || []);
      setWarnings(validation.warnings || []);
      setSuggestions(validation.suggestions || []);
      setIsValid(validation.valid);
      updateDecorations(validation);
    }
  }, [validation, updateDecorations]);

  // Auto-save cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
    };
  }, [autoSaveTimer]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
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

            <Button
              size="sm"
              variant="outline"
              onClick={validateCode}
              title="Validate Code"
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              Validate
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={formatCode}
              title="Format Code (Ctrl+Shift+F)"
            >
              <Code className="h-4 w-4 mr-1" />
              Format
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowFindReplace(!showFindReplace)}
              title="Find and Replace (Ctrl+F)"
            >
              <Search className="h-4 w-4 mr-1" />
              Find
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <Button
              size="sm"
              onClick={() => onTest && onTest(value)}
              title="Test Policy"
              disabled={!isValid}
            >
              <Play className="h-4 w-4 mr-1" />
              Test
            </Button>

            <Button
              size="sm"
              onClick={onSave}
              title="Save (Ctrl+S)"
              disabled={!isDirty}
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {value.split('\n').length} lines
            </span>
            <span className="text-xs text-muted-foreground">
              {value.length} characters
            </span>
          </div>
        </div>

        {/* Find and Replace Bar */}
        {showFindReplace && (
          <div className="mt-2 p-2 bg-white border rounded-lg">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="find" className="text-xs">Find:</Label>
                <Input
                  id="find"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') findInEditor();
                  }}
                  className="w-48 h-8 text-sm"
                  placeholder="Search..."
                />
                <Button size="sm" variant="outline" onClick={findInEditor}>
                  <Search className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <Label htmlFor="replace" className="text-xs">Replace:</Label>
                <Input
                  id="replace"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') replaceInEditor();
                  }}
                  className="w-48 h-8 text-sm"
                  placeholder="Replace with..."
                />
                <Button size="sm" variant="outline" onClick={replaceInEditor}>
                  <Replace className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={replaceAllInEditor}>
                  All
                </Button>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={(e) => setCaseSensitive(e.target.checked)}
                  />
                  Case Sensitive
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={useRegex}
                    onChange={(e) => setUseRegex(e.target.checked)}
                  />
                  Regex
                </label>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFindReplace(false)}
                className="ml-auto"
              >
                <XSquare className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Editor */}
        <div className="flex-1">
          <Editor
            height={height}
            language="rego"
            value={value}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            theme={theme}
            options={{
              fontSize,
              wordWrap: wordWrap ? 'on' : 'off',
              minimap: { enabled: minimap && showMiniMap },
              lineNumbers: showLineNumbers ? 'on' : 'off',
              glyphMargin: showGutter,
              folding: true,
              lineDecorationsWidth: 20,
              lineNumbersMinChars: 3,
              readOnly,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true
              }
            }}
            beforeMount={(monaco) => {
              // Add custom CSS for decorations
              monaco.editor.defineTheme('rego-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                  { token: 'keyword', foreground: 'C586C0' },
                  { token: 'function', foreground: 'DCDCAA' },
                  { token: 'string', foreground: 'CE9178' },
                  { token: 'number', foreground: 'B5CEA8' },
                  { token: 'boolean', foreground: '569CD6' },
                  { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                  { token: 'operator', foreground: 'D4D4D4' },
                  { token: 'delimiter', foreground: 'FFD700' },
                  { token: 'identifier', foreground: '9CDCFE' }
                ],
                colors: {
                  'editor.background': '#1E1E1E',
                  'editor.foreground': '#D4D4D4',
                  'editor.lineHighlightBackground': '#2D2D30',
                  'editorCursor.foreground': '#AEAFAD',
                  'editorWhitespace.foreground': '#404040'
                }
              });

              // Apply the theme
              monaco.editor.setTheme('rego-dark');
            }}
          />
        </div>

        {/* Side Panel */}
        <div className="w-80 border-l bg-gray-50 overflow-y-auto">
          <Tabs defaultValue="errors" className="h-full">
            <TabsList className="grid w-full grid-cols-3 m-2">
              <TabsTrigger value="errors" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Errors ({errors.length})
              </TabsTrigger>
              <TabsTrigger value="warnings" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Warnings ({warnings.length})
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="text-xs">
                <Lightbulb className="h-3 w-3 mr-1" />
                Tips ({suggestions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="errors" className="p-2">
              <ScrollArea className="h-[calc(100%-40px)]">
                {errors.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">No errors found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {errors.map((error, index) => (
                      <Card key={index} className="border-red-200 bg-red-50">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-800">
                                {error.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-red-600">
                                  Line {error.line}, Column {error.column}
                                </span>
                                <Badge variant="outline" className="text-xs border-red-300 text-red-700">
                                  {error.type}
                                </Badge>
                              </div>
                              {error.fix && (
                                <p className="text-xs text-red-600 mt-1">
                                  Fix: {error.fix}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="warnings" className="p-2">
              <ScrollArea className="h-[calc(100%-40px)]">
                {warnings.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p className="text-sm">No warnings</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {warnings.map((warning, index) => (
                      <Card key={index} className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-yellow-800">
                                {warning.message}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-yellow-600">
                                  Line {warning.line}, Column {warning.column}
                                </span>
                                <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">
                                  {warning.type}
                                </Badge>
                              </div>
                              {warning.suggestion && (
                                <p className="text-xs text-yellow-600 mt-1">
                                  Suggestion: {warning.suggestion}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="suggestions" className="p-2">
              <ScrollArea className="h-[calc(100%-40px)]">
                {suggestions.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No suggestions available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <Card key={index} className="border-blue-200 bg-blue-50">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-blue-800">
                                {suggestion.message}
                              </p>
                              <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 mt-1">
                                {suggestion.type}
                              </Badge>
                              <p className="text-xs text-blue-600 mt-2">
                                {suggestion.description}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 text-xs"
                                onClick={() => {
                                  if (editorRef.current) {
                                    const model = editorRef.current.getModel();
                                    if (model) {
                                      const position = editorRef.current.getPosition();
                                      if (position) {
                                        model.pushEditOperations(
                                          [],
                                          [{
                                            range: new monacoRef.current!.Range(
                                              position.lineNumber,
                                              position.column,
                                              position.lineNumber,
                                              position.column
                                            ),
                                            text: suggestion.code
                                          }],
                                          () => null
                                        );
                                      }
                                    }
                                  }
                                }}
                              >
                                Apply Suggestion
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t bg-gray-50 px-4 py-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Rego</span>
            <span>UTF-8</span>
            {validation?.metrics && (
              <>
                <span>Complexity: {validation.metrics.complexity}</span>
                <span>Security: {validation.metrics.security}%</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {validation?.metrics && (
              <>
                <span>Performance: {validation.metrics.performance}%</span>
                <span>Maintainability: {validation.metrics.maintainability}%</span>
                <span>Testability: {validation.metrics.testability}%</span>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .error-decoration {
          background-color: rgba(255, 68, 68, 0.2);
          border-left: 3px solid #ff4444;
        }

        .warning-decoration {
          background-color: rgba(255, 170, 0, 0.2);
          border-left: 3px solid #ffaa00;
        }

        .error-glyph {
          background-color: #ff4444;
          width: 3px !important;
        }

        .warning-glyph {
          background-color: #ffaa00;
          width: 3px !important;
        }
      `}</style>
    </div>
  );
}
