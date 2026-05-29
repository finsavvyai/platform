/**
 * Code Generator — results panel (file browser + preview + validation)
 */

import { Download } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CodeGenerationResult } from '../hooks/useCodeGeneration';
import { formatFileSize, getFileIcon } from '../hooks/codeGenUtils';

interface CodeGeneratorResultsProps {
  result: CodeGenerationResult;
  selectedFile: number;
  onSelectFile: (index: number) => void;
  onDownload: () => void;
}

export function CodeGeneratorResults({ result, selectedFile, onSelectFile, onDownload }: CodeGeneratorResultsProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const currentFile = result.files[selectedFile];

  return (
    <>
      <div className="mb-4 rounded-lg border p-4" style={{ borderColor: theme.colors.border }}>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-bold" style={{ color: theme.colors.accent }}>{result.totalFiles}</p>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>Files Generated</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: theme.colors.accent }}>{result.totalLines}</p>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>Total Lines</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: theme.colors.accent }}>{result.language}</p>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>Language</p>
          </div>
          <div>
            <button onClick={onDownload}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:scale-105"
              style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
              <Download size={16} />{t('codegen.download')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-64 rounded-lg border" style={{ borderColor: theme.colors.border }}>
          <div className="border-b p-2" style={{ borderColor: theme.colors.border }}>
            <p className="text-sm font-semibold" style={{ color: theme.colors.text }}>Generated Files</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {result.files.map((file, index) => (
              <button key={index} onClick={() => onSelectFile(index)}
                className={`flex w-full items-center gap-2 border-b p-2 text-left transition-all ${selectedFile === index ? 'bg-blue-500 bg-opacity-10' : ''}`}
                style={{ borderColor: theme.colors.border, color: theme.colors.text }}>
                <span className="text-lg">{getFileIcon(file.path)}</span>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-xs font-medium">{file.path}</p>
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{formatFileSize(file.size)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 rounded-lg border" style={{ borderColor: theme.colors.border }}>
          {currentFile && (
            <>
              <div className="flex items-center justify-between border-b p-2" style={{ borderColor: theme.colors.border }}>
                <p className="text-sm font-semibold" style={{ color: theme.colors.text }}>{currentFile.path}</p>
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>{formatFileSize(currentFile.size)}</span>
              </div>
              <pre className="h-96 overflow-auto p-4 text-xs">
                <code style={{ color: theme.colors.text }}>{currentFile.content}</code>
              </pre>
            </>
          )}
        </div>
      </div>

      {result.validation && (
        <div className="mt-4 rounded-lg border p-4" style={{ borderColor: theme.colors.border }}>
          <p className="mb-2 text-sm font-semibold" style={{ color: theme.colors.text }}>Validation Results</p>
          {result.validation.valid ? (
            <p className="text-sm text-green-500">✓ Code is valid</p>
          ) : (
            <p className="text-sm text-red-500">✗ Validation failed</p>
          )}
          {result.validation.warnings && result.validation.warnings.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-yellow-500">Warnings:</p>
              <ul className="ml-4 list-disc text-xs text-yellow-400">
                {result.validation.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
