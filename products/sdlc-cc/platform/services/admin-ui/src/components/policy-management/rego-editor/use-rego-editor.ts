// @ts-nocheck
/**
 * Hook for Rego Editor logic
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { ValidatePolicyResponse, ValidationError, ValidationWarning, ValidationSuggestion } from '@/types/policy-management';
import { regoLanguage } from './rego-language';
import {
  registerCompletionProvider,
  registerHoverProvider,
  registerSignatureHelpProvider
} from './monaco-providers';

interface UseRegoEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  validation?: ValidatePolicyResponse;
  onValidationChange?: (validation: ValidatePolicyResponse) => void;
  onSave?: () => void;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export function useRegoEditor({
  value, onChange, readOnly, validation,
  onValidationChange, onSave, autoSave, autoSaveDelay = 2000
}: UseRegoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [suggestions, setSuggestions] = useState<ValidationSuggestion[]>([]);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    import('monaco-editor').then(monacoInstance => {
      monacoRef.current = monacoInstance;
      monacoInstance.languages.register({ id: 'rego' });
      monacoInstance.languages.setLanguageConfiguration('rego', {
        comments: { lineComment: '#' },
        brackets: [['{', '}'], ['[', ']'], ['(', ')']],
        autoClosingPairs: [
          { open: '{', close: '}' }, { open: '[', close: ']' },
          { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '{', close: '}' }, { open: '[', close: ']' },
          { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }
        ]
      });
      monacoInstance.languages.setMonarchTokensProvider('rego', regoLanguage);
      registerCompletionProvider(monacoInstance);
      registerHoverProvider(monacoInstance);
      registerSignatureHelpProvider(monacoInstance);
    });
  }, []);

  const updateDecorations = useCallback((validation: ValidatePolicyResponse) => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const m = monacoRef.current;
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    validation.errors?.forEach(error => {
      decorations.push({
        range: new m.Range(error.line || 1, error.column || 1, error.line || 1, error.column || 1),
        options: {
          className: 'error-decoration', glyphMarginClassName: 'error-glyph',
          hoverMessage: { value: error.message }, isWholeLine: false,
          minimap: { color: '#ff4444', position: m.editor.MinimapPosition.Inline }
        }
      });
    });
    validation.warnings?.forEach(warning => {
      decorations.push({
        range: new m.Range(warning.line || 1, warning.column || 1, warning.line || 1, warning.column || 1),
        options: {
          className: 'warning-decoration', glyphMarginClassName: 'warning-glyph',
          hoverMessage: { value: warning.message }, isWholeLine: false,
          minimap: { color: '#ffaa00', position: m.editor.MinimapPosition.Inline }
        }
      });
    });
    editor.deltaDecorations([], decorations);
  }, []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
      setIsDirty(true);
      if (autoSave && autoSaveDelay) {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        const timer = setTimeout(() => { if (onSave) onSave(); setIsDirty(false); }, autoSaveDelay);
        setAutoSaveTimer(timer);
      }
    }
  }, [onChange, autoSave, autoSaveDelay, onSave]);

  const validateCode = useCallback(async () => {
    if (!onValidationChange) return;
    try {
      const validation: ValidatePolicyResponse = {
        valid: true, errors: [], warnings: [], suggestions: [],
        metrics: { complexity: 5, maintainability: 85, testability: 90, security: 95, performance: 88 }
      };
      setErrors(validation.errors); setWarnings(validation.warnings);
      setSuggestions(validation.suggestions); setIsValid(validation.valid);
      onValidationChange(validation); updateDecorations(validation);
    } catch (error) { console.error('Validation failed:', error); }
  }, [onValidationChange, updateDecorations]);

  const formatCode = useCallback(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const lines = model.getValue().split('\n');
    const formatted: string[] = [];
    let indentLevel = 0;
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('}') && indentLevel > 0) indentLevel--;
      formatted.push(trimmed ? '    '.repeat(indentLevel) + trimmed : '');
      if (trimmed.endsWith('{')) indentLevel++;
    });
    model.setValue(formatted.join('\n'));
  }, []);

  const findInEditor = useCallback(() => {
    if (!editorRef.current || !findText) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const matches = model.findMatches(findText, true, useRegex, caseSensitive, null, true);
    if (matches.length > 0) {
      editorRef.current.setSelection(matches[0].range);
      editorRef.current.revealLineInCenter(matches[0].range.startLineNumber);
    }
  }, [findText, caseSensitive, useRegex]);

  const replaceInEditor = useCallback(() => {
    if (!editorRef.current || !findText) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const selection = editorRef.current.getSelection();
    if (selection.isEmpty()) { findInEditor(); }
    else { model.pushEditOperations([], [{ range: selection, text: replaceText }], () => null); }
  }, [findText, replaceText, findInEditor]);

  const replaceAllInEditor = useCallback(() => {
    if (!editorRef.current || !findText) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const matches = model.findMatches(findText, true, useRegex, caseSensitive, null, false);
    const edits = matches.map(match => ({ range: match.range, text: replaceText }));
    model.pushEditOperations([], edits, () => null);
  }, [findText, replaceText, caseSensitive, useRegex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editorRef.current) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (onSave) onSave(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') { e.preventDefault(); formatCode(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowFindReplace(true); }
      if (e.key === 'Escape' && showFindReplace) setShowFindReplace(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, formatCode, showFindReplace]);

  useEffect(() => {
    if (validation) {
      setErrors(validation.errors || []); setWarnings(validation.warnings || []);
      setSuggestions(validation.suggestions || []); setIsValid(validation.valid);
      updateDecorations(validation);
    }
  }, [validation, updateDecorations]);

  useEffect(() => { return () => { if (autoSaveTimer) clearTimeout(autoSaveTimer); }; }, [autoSaveTimer]);

  return {
    editorRef, monacoRef, errors, warnings, suggestions, isValid, isDirty,
    showFindReplace, setShowFindReplace, findText, setFindText,
    replaceText, setReplaceText, caseSensitive, setCaseSensitive,
    useRegex, setUseRegex, handleEditorChange, validateCode, formatCode,
    findInEditor, replaceInEditor, replaceAllInEditor, updateDecorations
  };
}
