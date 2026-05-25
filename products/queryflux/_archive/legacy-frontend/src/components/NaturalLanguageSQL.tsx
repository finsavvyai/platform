import { useState } from 'react';
import { Mic, MicOff, Sparkles, ArrowRight, Copy, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { voiceControl } from '../utils/voiceControl';

interface NaturalLanguageSQLProps {
  onGenerateSQL: (sql: string) => void;
}

export function NaturalLanguageSQL({ onGenerateSQL }: NaturalLanguageSQLProps) {
  const { theme } = useTheme();
  const [input, setInput] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleVoiceInput = () => {
    if (!voiceControl.isSupported()) {
      alert('Voice recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      voiceControl.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      voiceControl.start(
        (transcript, confidence) => {
          setInput(transcript);
          setIsListening(false);
        },
        (error) => {
          console.error('Voice error:', error);
          setIsListening(false);
        }
      );
    }
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;

    setIsGenerating(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const sql = convertNaturalLanguageToSQL(input);
    setGeneratedSQL(sql);
    setIsGenerating(false);
  };

  const convertNaturalLanguageToSQL = (text: string): string => {
    const lower = text.toLowerCase();

    if (lower.includes('show') || lower.includes('get') || lower.includes('find') || lower.includes('list')) {
      let table = 'users';
      let condition = '';

      if (lower.includes('user')) table = 'users';
      else if (lower.includes('order')) table = 'orders';
      else if (lower.includes('product')) table = 'products';
      else if (lower.includes('customer')) table = 'customers';

      if (lower.includes('where')) {
        const whereIndex = lower.indexOf('where');
        condition = ' WHERE ' + text.substring(whereIndex + 5).trim();
      } else if (lower.includes('with')) {
        const withIndex = lower.indexOf('with');
        const withClause = text.substring(withIndex + 4).trim();
        condition = ` WHERE ${withClause}`;
      }

      if (lower.includes('last') || lower.includes('recent')) {
        return `SELECT * FROM ${table}${condition} ORDER BY created_at DESC LIMIT 10;`;
      }

      if (lower.includes('count') || lower.includes('how many')) {
        return `SELECT COUNT(*) FROM ${table}${condition};`;
      }

      return `SELECT * FROM ${table}${condition} LIMIT 100;`;
    }

    if (lower.includes('update') || lower.includes('change') || lower.includes('modify')) {
      let table = 'users';
      if (lower.includes('user')) table = 'users';
      else if (lower.includes('order')) table = 'orders';
      else if (lower.includes('product')) table = 'products';

      return `UPDATE ${table} SET column_name = 'value' WHERE id = 1;`;
    }

    if (lower.includes('delete') || lower.includes('remove')) {
      let table = 'users';
      if (lower.includes('user')) table = 'users';
      else if (lower.includes('order')) table = 'orders';
      else if (lower.includes('product')) table = 'products';

      return `DELETE FROM ${table} WHERE id = 1;`;
    }

    if (lower.includes('create') || lower.includes('insert') || lower.includes('add')) {
      let table = 'users';
      if (lower.includes('user')) table = 'users';
      else if (lower.includes('order')) table = 'orders';
      else if (lower.includes('product')) table = 'products';

      return `INSERT INTO ${table} (column1, column2) VALUES ('value1', 'value2');`;
    }

    return `-- AI-generated SQL for: "${text}"\nSELECT * FROM table_name LIMIT 100;`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedSQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseSQL = () => {
    onGenerateSQL(generatedSQL);
  };

  return (
    <div className="p-4 border-b space-y-3" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4" style={{ color: theme.colors.accent }} />
        <h3 className="text-sm font-semibold" style={{ color: theme.colors.text }}>
          {t('naturalLanguage.title')}
        </h3>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder={t('naturalLanguage.placeholder')}
            className="w-full px-3 py-2 pr-10 rounded-lg glass-card border outline-none text-sm"
            style={{ borderColor: theme.colors.border, color: theme.colors.text }}
          />
          <button
            onClick={handleVoiceInput}
            className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg transition-all ${
              isListening ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: isListening ? theme.colors.accent : 'transparent' }}
            title={t('naturalLanguage.voiceInput')}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
            )}
          </button>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!input.trim() || isGenerating}
          className="px-4 py-2 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
          style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
        >
          {isGenerating ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              {t('naturalLanguage.generating')}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {t('naturalLanguage.generate')}
            </>
          )}
        </button>
      </div>

      {isListening && (
        <div className="text-xs flex items-center gap-2" style={{ color: theme.colors.accent }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.colors.accent }} />
          {t('naturalLanguage.listening')}
        </div>
      )}

      {generatedSQL && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: theme.colors.text }}>
              {t('naturalLanguage.generatedSQL')}
            </span>
            <div className="flex gap-1">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg glass-morphism hover-3d transition-all"
                title="Copy SQL"
              >
                {copied ? (
                  <Check className="w-3 h-3" style={{ color: theme.colors.accent }} />
                ) : (
                  <Copy className="w-3 h-3" style={{ color: theme.colors.textSecondary }} />
                )}
              </button>
              <button
                onClick={handleUseSQL}
                className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`, color: 'white' }}
              >
                {t('naturalLanguage.useSQL')}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg glass-card">
            <code className="text-xs font-mono whitespace-pre-wrap" style={{ color: theme.colors.text }}>
              {generatedSQL}
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
