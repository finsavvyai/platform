// @ts-nocheck
/**
 * Rego Code Editor Component
 *
 * Enterprise-grade Rego code editor with syntax highlighting,
 * validation, auto-completion, and security features
 */

'use client';

import React, { useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ValidatePolicyResponse } from '@/types/policy-management';
import { useRegoEditor } from './use-rego-editor';
import { EditorToolbar } from './editor-toolbar';
import { FindReplaceBar } from './find-replace-bar';
import { ValidationPanel } from './validation-panel';

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

export default function RegoEditor({
  value, onChange, onBlur, onFocus,
  readOnly = false, theme = 'vs-dark', fontSize = 14,
  wordWrap = true, minimap = true, validation,
  onValidationChange, onSave, onTest, onFormat,
  height = '600px', showMiniMap = true, showGutter = true,
  showLineNumbers = true, autoSave = false, autoSaveDelay = 2000
}: RegoEditorProps) {
  const editor = useRegoEditor({
    value, onChange, readOnly, validation,
    onValidationChange, onSave, autoSave, autoSaveDelay
  });

  const handleEditorDidMount = useCallback(
    (editorInstance: monaco.editor.IStandaloneCodeEditor) => {
      editor.editorRef.current = editorInstance;
      editorInstance.updateOptions({
        fontSize, wordWrap: wordWrap ? 'on' : 'off',
        minimap: { enabled: minimap && showMiniMap },
        lineNumbers: showLineNumbers ? 'on' : 'off',
        glyphMargin: showGutter, folding: true,
        lineDecorationsWidth: 20, lineNumbersMinChars: 3,
        readOnly, scrollBeyondLastLine: false, automaticLayout: true,
        renderWhitespace: 'selection',
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        suggest: { showKeywords: true, showSnippets: true },
        quickSuggestions: { other: true, comments: false, strings: false }
      });
      if (validation) editor.updateDecorations(validation);
    },
    [fontSize, wordWrap, minimap, showMiniMap, showGutter, showLineNumbers, readOnly, validation]
  );

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar
        isValid={editor.isValid}
        isDirty={editor.isDirty}
        value={value}
        onValidate={editor.validateCode}
        onFormat={editor.formatCode}
        onToggleFindReplace={() => editor.setShowFindReplace(!editor.showFindReplace)}
        onTest={onTest}
        onSave={onSave}
      />

      {editor.showFindReplace && (
        <div className="border-b bg-gray-50 px-2 pb-2">
          <FindReplaceBar
            findText={editor.findText}
            replaceText={editor.replaceText}
            caseSensitive={editor.caseSensitive}
            useRegex={editor.useRegex}
            onFindTextChange={editor.setFindText}
            onReplaceTextChange={editor.setReplaceText}
            onCaseSensitiveChange={editor.setCaseSensitive}
            onUseRegexChange={editor.setUseRegex}
            onFind={editor.findInEditor}
            onReplace={editor.replaceInEditor}
            onReplaceAll={editor.replaceAllInEditor}
            onClose={() => editor.setShowFindReplace(false)}
          />
        </div>
      )}

      <div className="flex-1 flex">
        <div className="flex-1">
          <Editor
            height={height}
            language="rego"
            value={value}
            onChange={editor.handleEditorChange}
            onMount={handleEditorDidMount}
            theme={theme}
            options={{
              fontSize, wordWrap: wordWrap ? 'on' : 'off',
              minimap: { enabled: minimap && showMiniMap },
              lineNumbers: showLineNumbers ? 'on' : 'off',
              glyphMargin: showGutter, folding: true,
              lineDecorationsWidth: 20, lineNumbersMinChars: 3,
              readOnly, scrollBeyondLastLine: false, automaticLayout: true,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true }
            }}
            beforeMount={(monacoInstance) => {
              monacoInstance.editor.defineTheme('rego-dark', {
                base: 'vs-dark', inherit: true,
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
              monacoInstance.editor.setTheme('rego-dark');
            }}
          />
        </div>

        <ValidationPanel
          errors={editor.errors}
          warnings={editor.warnings}
          suggestions={editor.suggestions}
          editorRef={editor.editorRef}
          monacoRef={editor.monacoRef}
        />
      </div>

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
        .error-decoration { background-color: rgba(255, 68, 68, 0.2); border-left: 3px solid #ff4444; }
        .warning-decoration { background-color: rgba(255, 170, 0, 0.2); border-left: 3px solid #ffaa00; }
        .error-glyph { background-color: #ff4444; width: 3px !important; }
        .warning-glyph { background-color: #ffaa00; width: 3px !important; }
      `}</style>
    </div>
  );
}
