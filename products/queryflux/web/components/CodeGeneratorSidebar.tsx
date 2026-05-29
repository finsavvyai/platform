/**
 * Code Generator — sidebar configuration panel
 */

import { Play, Sparkles } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { SUPPORTED_LANGUAGES, SUPPORTED_TEMPLATES, Language, Template } from '../hooks/useCodeGeneration';

interface CodeGeneratorSidebarProps {
  selectedLanguage: Language;
  selectedTemplate: Template;
  useAI: boolean;
  aiPrompt: string;
  isGenerating: boolean;
  hasSchema: boolean;
  error: Error | null;
  onLanguageChange: (lang: Language) => void;
  onTemplateChange: (tmpl: Template) => void;
  onAIToggle: () => void;
  onAIPromptChange: (prompt: string) => void;
  onGenerate: () => void;
}

export function CodeGeneratorSidebar({
  selectedLanguage, selectedTemplate, useAI, aiPrompt,
  isGenerating, hasSchema, error,
  onLanguageChange, onTemplateChange, onAIToggle, onAIPromptChange, onGenerate,
}: CodeGeneratorSidebarProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="w-80 overflow-y-auto border-r p-4" style={{ borderColor: theme.colors.border }}>
      <div className="mb-6">
        <label className="mb-2 block text-sm font-semibold" style={{ color: theme.colors.text }}>
          {t('codegen.language')}
        </label>
        <select value={selectedLanguage} onChange={(e) => onLanguageChange(e.target.value as Language)}
          disabled={isGenerating} className="w-full rounded-lg px-3 py-2"
          style={{ backgroundColor: theme.colors.background, border: `1px solid ${theme.colors.border}`, color: theme.colors.text }}>
          {Object.entries(SUPPORTED_LANGUAGES).map(([key, lang]) => (
            <option key={key} value={key}>{lang.name}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="mb-2 block text-sm font-semibold" style={{ color: theme.colors.text }}>
          {t('codegen.template')}
        </label>
        <div className="space-y-2">
          {Object.entries(SUPPORTED_TEMPLATES).map(([key, tmpl]) => (
            <button key={key} onClick={() => onTemplateChange(key as Template)} disabled={isGenerating}
              className={`flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-all ${selectedTemplate === key ? 'border-opacity-100' : 'border-opacity-20'}`}
              style={{ backgroundColor: selectedTemplate === key ? `${theme.colors.accent}20` : theme.colors.background, borderColor: theme.colors.accent, color: theme.colors.text }}>
              <span className="text-2xl">{tmpl.icon}</span>
              <div>
                <p className="text-sm font-medium">{tmpl.name}</p>
                <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{tmpl.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.colors.text }}>
          <Sparkles size={16} style={{ color: theme.colors.accent }} />
          {t('codegen.aiPower')}
        </label>
        <button onClick={onAIToggle} disabled={isGenerating}
          className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition-all ${useAI ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
          {useAI ? t('codegen.aiEnabled') : t('codegen.aiDisabled')}
        </button>
        {useAI && (
          <textarea value={aiPrompt} onChange={(e) => onAIPromptChange(e.target.value)}
            placeholder={t('codegen.aiPromptPlaceholder')} disabled={isGenerating}
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text, minHeight: '100px' }} />
        )}
      </div>

      <button onClick={onGenerate} disabled={isGenerating || !hasSchema}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 font-medium text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
        {isGenerating ? (
          <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />{t('codegen.generating')}</>
        ) : (
          <><Play size={18} />{useAI ? t('codegen.generateWithAI') : t('codegen.generate')}</>
        )}
      </button>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500 bg-red-500 bg-opacity-10 p-3">
          <p className="text-sm text-red-500">{error.message}</p>
        </div>
      )}
    </div>
  );
}
