import { useState } from 'react';
import { Play, Save, Download, Upload, Trash2, Bot, Shield, Zap, Network, Clock, Bookmark } from 'lucide-react';
import { Connection } from '../lib/supabase';
import { DATABASE_CONFIGS } from '../types/database';
import { useTheme } from '../contexts/ThemeContext';
import { AIAssistant } from './AIAssistant';
import { SchemaVisualizer } from './SchemaVisualizer';
import { QueryHistory } from './QueryHistory';
import { SavedQueries } from './SavedQueries';
import { audioFeedback } from '../utils/audioFeedback';

interface QueryEditorProps {
  connection: Connection;
}

export function QueryEditor({ connection }: QueryEditorProps) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const config = DATABASE_CONFIGS[connection.database_type as keyof typeof DATABASE_CONFIGS];

  const handleRun = async () => {
    if (!query.trim()) return;

    setIsRunning(true);
    audioFeedback.queryExecute();

    await new Promise(resolve => setTimeout(resolve, 1000));

    setResults([
      { id: 1, name: 'Sample Data 1', value: 100 },
      { id: 2, name: 'Sample Data 2', value: 200 },
      { id: 3, name: 'Sample Data 3', value: 300 },
    ]);

    audioFeedback.success();
    setIsRunning(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full glass-morphism" style={{ backgroundColor: 'transparent' }}>
      <div
        className="flex items-center justify-between px-6 py-4 border-b shimmer glass-morphism-strong"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center glow-effect floating-animation"
            style={{
              backgroundColor: config?.color + '20' || '#e5e7eb',
              boxShadow: `0 0 20px ${config?.color}40`
            }}
          >
            <div className="w-6 h-6 flex items-center justify-center" style={{ color: config?.color || '#6b7280' }}>
              ●
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: theme.colors.text }}>{connection.name}</h2>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              {config?.name || connection.database_type} • {connection.environment}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className={`p-2 rounded-lg transition-all hover-3d ${showSaved ? 'glass-morphism-strong glow-effect' : 'glass-morphism'}`}
            title="Saved Queries"
          >
            <Bookmark className="w-4 h-4" style={{ color: showSaved ? theme.colors.accent : theme.colors.text }} />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg transition-all hover-3d ${showHistory ? 'glass-morphism-strong glow-effect' : 'glass-morphism'}`}
            title="Query History"
          >
            <Clock className="w-4 h-4" style={{ color: showHistory ? theme.colors.accent : theme.colors.text }} />
          </button>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className={`p-2 rounded-lg transition-all hover-3d ${showSchema ? 'glass-morphism-strong glow-effect' : 'glass-morphism'}`}
            title="Schema Visualization"
          >
            <Network className="w-4 h-4" style={{ color: showSchema ? theme.colors.accent : theme.colors.text }} />
          </button>
          <button
            onClick={() => setShowAI(!showAI)}
            className={`p-2 rounded-lg transition-all hover-3d ${showAI ? 'glass-morphism-strong glow-effect' : 'glass-morphism'}`}
            title="AI Assistant"
          >
            <Bot className="w-4 h-4" style={{ color: showAI ? theme.colors.accent : theme.colors.text }} />
          </button>
          <div className="w-px h-6 bg-white/10" />
          <button className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism" style={{ color: theme.colors.text }} title="Save Query">
            <Save className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism" style={{ color: theme.colors.text }} title="Import">
            <Upload className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism" style={{ color: theme.colors.text }} title="Export">
            <Download className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg transition-all hover:opacity-70 glass-morphism" style={{ color: theme.colors.text }} title="Clear">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AIAssistant connection={connection} isOpen={showAI} onClose={() => setShowAI(false)} />

      {showSaved ? (
        <SavedQueries onSelectQuery={setQuery} />
      ) : showHistory ? (
        <QueryHistory onSelectQuery={setQuery} />
      ) : showSchema ? (
        <SchemaVisualizer databaseName={connection.name} />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className="flex items-center justify-between px-6 py-3 border-b glass-morphism-strong shimmer"
            style={{ borderColor: theme.colors.border }}
          >
            <h3 className="text-sm font-semibold" style={{ color: theme.colors.text }}>Query Editor</h3>
            <button
              onClick={handleRun}
              disabled={isRunning || !query.trim()}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover-3d glow-effect"
              style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Query'}
            </button>
          </div>

          <div className="flex-1 p-4 overflow-auto" style={{ backgroundColor: 'transparent' }}>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Enter your ${config?.name || 'database'} query here...\n\nExample:\nSELECT * FROM users WHERE id = 1;`}
              className="w-full h-full p-4 font-mono text-sm border rounded-2xl focus:ring-2 outline-none resize-none glass-card"
              style={{
                color: theme.colors.editorText,
                borderColor: theme.colors.border,
              }}
            />
          </div>
        </div>

        {results && (
          <div className="flex-1 flex flex-col min-h-0 border-t" style={{ borderColor: theme.colors.border }}>
            <div
              className="px-6 py-3 border-b glass-morphism-strong shimmer"
              style={{ borderColor: theme.colors.border }}
            >
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                Results ({results.length} rows)
              </h3>
            </div>

            <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: 'transparent' }}>
              <div className="overflow-x-auto glass-card rounded-2xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="border-b glass-morphism"
                      style={{ borderColor: theme.colors.border }}
                    >
                      {Object.keys(results[0] || {}).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                          style={{ color: theme.colors.text }}
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b transition-all hover:opacity-80 hover-3d"
                        style={{ borderColor: theme.colors.border }}
                      >
                        {Object.values(row).map((value: any, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-3 whitespace-nowrap" style={{ color: theme.colors.text }}>
                            {value?.toString()}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
