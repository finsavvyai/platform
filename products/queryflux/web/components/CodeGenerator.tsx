/**
 * Code Generator Component
 *
 * UI for generating code from database schemas
 */

import { useState } from 'react';
import { Code, FileCode } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCodeGeneration, SUPPORTED_LANGUAGES, Language, Template, generateDefaultRequest, downloadFiles } from '../hooks/useCodeGeneration';
import { CodeGeneratorSidebar } from './CodeGeneratorSidebar';
import { CodeGeneratorResults } from './CodeGeneratorResults';
import { CodeGeneratorSchemaPanel } from './CodeGeneratorSchemaPanel';

interface CodeGeneratorProps {
  connectionId: string;
  onGenerated?: (result: any) => void;
}

export function CodeGenerator({ connectionId, onGenerated }: CodeGeneratorProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('typescript');
  const [selectedTemplate, setSelectedTemplate] = useState<Template>('orm_models');
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [useAI, setUseAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState(0);

  const { schema, introspectSchema, isIntrospecting, generateCode, generateWithAI, isGenerating, result, error, reset } = useCodeGeneration(connectionId);

  const handleOpen = async () => {
    setIsOpen(true);
    if (!schema) await introspectSchema(connectionId);
  };

  const handleGenerate = async () => {
    reset();
    if (!schema) return;
    try {
      let generationResult;
      if (useAI) {
        generationResult = await generateWithAI(aiPrompt, schema);
      } else {
        const request = generateDefaultRequest(schema, selectedLanguage, SUPPORTED_LANGUAGES[selectedLanguage].frameworks[0], selectedTemplate);
        request.tables = selectedTables.length > 0 ? selectedTables : request.tables;
        generationResult = await generateCode(request);
      }
      onGenerated?.(generationResult);
    } catch (err) { console.error('Code generation failed:', err); }
  };

  const handleDownload = () => { if (result) downloadFiles(result); };
  const toggleTable = (name: string) => setSelectedTables((prev) => prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]);
  const selectAllTables = () => { if (schema) setSelectedTables(schema.tables.map((t) => t.name)); };

  if (!isOpen) {
    return (
      <button onClick={handleOpen} className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all hover:scale-105" style={{ backgroundColor: theme.colors.accent, color: 'white' }}>
        <Code size={18} />{t('codegen.generate')}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="h-[90vh] w-full max-w-7xl overflow-hidden rounded-lg shadow-xl" style={{ backgroundColor: theme.colors.sidebar, border: `1px solid ${theme.colors.border}` }}>
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <FileCode size={24} style={{ color: theme.colors.accent }} />
            <div>
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>{t('codegen.title')}</h3>
              {schema && <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{schema.tables.length} tables</p>}
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-2 hover:bg-gray-700" style={{ color: theme.colors.text }}>✕</button>
        </div>

        <div className="flex h-[calc(100%-80px)]">
          <CodeGeneratorSidebar
            selectedLanguage={selectedLanguage}
            selectedTemplate={selectedTemplate}
            useAI={useAI}
            aiPrompt={aiPrompt}
            isGenerating={isGenerating}
            hasSchema={!!schema}
            error={error}
            onLanguageChange={setSelectedLanguage}
            onTemplateChange={setSelectedTemplate}
            onAIToggle={() => setUseAI(!useAI)}
            onAIPromptChange={setAiPrompt}
            onGenerate={handleGenerate}
          />

          <div className="flex-1 overflow-y-auto p-4">
            {result ? (
              <CodeGeneratorResults result={result} selectedFile={selectedFile} onSelectFile={setSelectedFile} onDownload={handleDownload} />
            ) : isIntrospecting ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
                  <p className="text-sm" style={{ color: theme.colors.text }}>{t('codegen.introspecting')}</p>
                </div>
              </div>
            ) : schema ? (
              <CodeGeneratorSchemaPanel schema={schema} selectedTables={selectedTables} onToggleTable={toggleTable} onSelectAll={selectAllTables} onClear={() => setSelectedTables([])} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
