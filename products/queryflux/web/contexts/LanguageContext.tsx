import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type LanguageCode = 'en';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
}

const englishTranslations: Record<string, string> = {
  'codegen.aiDisabled': 'AI disabled',
  'codegen.aiEnabled': 'AI enabled',
  'codegen.aiPower': 'AI generation',
  'codegen.aiPromptPlaceholder': 'Describe the code you want to generate...',
  'codegen.clear': 'Clear',
  'codegen.download': 'Download',
  'codegen.generate': 'Generate code',
  'codegen.generateWithAI': 'Generate with AI',
  'codegen.generating': 'Generating...',
  'codegen.introspecting': 'Inspecting schema...',
  'codegen.language': 'Language',
  'codegen.selectAll': 'Select all',
  'codegen.selectTables': 'Select tables',
  'codegen.template': 'Template',
  'codegen.title': 'Code Generator',
  'voice.assistant': 'Voice Assistant',
  'voice.clear': 'Clear',
  'voice.commands.createAlert': 'Create an alert for high CPU usage',
  'voice.commands.executeQuery': 'Run a query against the current database',
  'voice.commands.showMetrics': 'Show database metrics',
  'voice.commands.testConnection': 'Test the current connection',
  'voice.listeningPrompt': 'Listening for a command...',
  'voice.startListening': 'Start listening',
  'voice.stopListening': 'Stop listening',
  'voice.trySaying': 'Try saying',
};

const defaultValue: LanguageContextValue = {
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => fallback ?? englishTranslations[key] ?? key,
};

const LanguageContext = createContext<LanguageContextValue>(defaultValue);

interface LanguageProviderProps {
  children: ReactNode;
  initialLanguage?: LanguageCode;
}

export function LanguageProvider({
  children,
  initialLanguage = 'en',
}: LanguageProviderProps) {
  const [language, setLanguage] = useState<LanguageCode>(initialLanguage);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, fallback) => fallback ?? englishTranslations[key] ?? key,
    }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
