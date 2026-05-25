import { useState, useEffect } from 'react';
import { Play, Plus, X, AlertTriangle, Shield, Save } from 'lucide-react';
import { Connection, supabase } from '../lib/supabase';
import { DATABASE_CONFIGS } from '../types/database';
import { useTheme } from '../contexts/ThemeContext';
import { DatabaseExplorer } from './DatabaseExplorer';
import { NaturalLanguageSQL } from './NaturalLanguageSQL';

interface MultiTabQueryEditorProps {
  connection: Connection;
}

interface QueryTab {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
  orderIndex: number;
}

export function MultiTabQueryEditor({ connection }: MultiTabQueryEditorProps) {
  const { theme } = useTheme();
  const [tabs, setTabs] = useState<QueryTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');

  const config = DATABASE_CONFIGS[connection.database_type as keyof typeof DATABASE_CONFIGS];
  const isProduction = connection.environment === 'production';
  const requiresConfirmation = connection.requires_confirmation || isProduction;

  useEffect(() => {
    loadTabs();
  }, [connection.id]);

  const loadTabs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('connection_tabs')
      .select('*')
      .eq('connection_id', connection.id)
      .eq('user_id', user.id)
      .order('order_index', { ascending: true });

    if (data && data.length > 0) {
      setTabs(data.map(tab => ({
        id: tab.id,
        title: tab.title,
        content: tab.content,
        isActive: tab.is_active,
        orderIndex: tab.order_index,
      })));
      const active = data.find(t => t.is_active);
      setActiveTabId(active?.id || data[0].id);
    } else {
      createNewTab();
    }
  };

  const createNewTab = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newOrderIndex = tabs.length;
    const { data, error } = await supabase
      .from('connection_tabs')
      .insert({
        connection_id: connection.id,
        user_id: user.id,
        title: `Query ${tabs.length + 1}`,
        content: '',
        is_active: tabs.length === 0,
        order_index: newOrderIndex,
      })
      .select()
      .single();

    if (data && !error) {
      const newTab = {
        id: data.id,
        title: data.title,
        content: data.content,
        isActive: data.is_active,
        orderIndex: data.order_index,
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(data.id);
    }
  };

  const closeTab = async (tabId: string) => {
    if (tabs.length === 1) return;

    await supabase
      .from('connection_tabs')
      .delete()
      .eq('id', tabId);

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId && newTabs.length > 0) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const updateTabContent = async (tabId: string, content: string) => {
    setTabs(tabs.map(t => t.id === tabId ? { ...t, content } : t));

    await supabase
      .from('connection_tabs')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', tabId);
  };

  const updateTabTitle = async (tabId: string, title: string) => {
    setTabs(tabs.map(t => t.id === tabId ? { ...t, title } : t));

    await supabase
      .from('connection_tabs')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', tabId);
  };

  const switchTab = async (tabId: string) => {
    setActiveTabId(tabId);
    setResults(null);

    await supabase
      .from('connection_tabs')
      .update({ is_active: false })
      .eq('connection_id', connection.id);

    await supabase
      .from('connection_tabs')
      .update({ is_active: true })
      .eq('id', tabId);
  };

  const handleRun = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || !activeTab.content.trim()) return;

    const queryText = activeTab.content.trim().toLowerCase();
    const isWriteQuery = queryText.includes('insert') ||
                         queryText.includes('update') ||
                         queryText.includes('delete') ||
                         queryText.includes('drop') ||
                         queryText.includes('alter') ||
                         queryText.includes('create');

    if (requiresConfirmation && isWriteQuery) {
      setPendingQuery(activeTab.content);
      setShowConfirmation(true);
      return;
    }

    executeQuery(activeTab.content);
  };

  const executeQuery = async (query: string) => {
    setIsRunning(true);
    setShowConfirmation(false);

    await new Promise(resolve => setTimeout(resolve, 1000));

    setResults([
      { id: 1, name: 'Sample Data 1', value: 100 },
      { id: 2, name: 'Sample Data 2', value: 200 },
      { id: 3, name: 'Sample Data 3', value: 300 },
    ]);

    setIsRunning(false);
  };

  const handleSelectObject = (schema: string, objectType: string, objectName: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    let queryTemplate = '';
    if (objectType === 'table' || objectType === 'view') {
      queryTemplate = `SELECT * FROM ${schema}.${objectName} LIMIT 100;`;
    } else if (objectType === 'function' || objectType === 'procedure') {
      queryTemplate = `-- Call ${objectName}\nSELECT ${schema}.${objectName}();`;
    }

    updateTabContent(activeTab.id, activeTab.content + '\n' + queryTemplate);
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="flex-1 flex h-full">
      <DatabaseExplorer
        connectionId={connection.id}
        onSelectObject={handleSelectObject}
      />

      <div className="flex-1 flex flex-col">
        {isProduction && (
          <div
            className="flex items-center gap-2 px-4 py-2 border-b"
            style={{
              backgroundColor: '#dc262620',
              borderColor: '#dc2626',
              color: '#dc2626'
            }}
          >
            <Shield className="w-4 h-4" />
            <span className="text-xs font-semibold">
              PRODUCTION ENVIRONMENT - All write operations require confirmation
            </span>
          </div>
        )}

        <div className="flex items-center border-b overflow-x-auto" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.sidebar }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-4 py-2 border-r cursor-pointer transition-all group ${
                tab.id === activeTabId ? 'glass-morphism' : ''
              }`}
              style={{
                borderColor: theme.colors.border,
                borderBottom: tab.id === activeTabId ? `2px solid ${theme.colors.accent}` : 'none',
              }}
              onClick={() => switchTab(tab.id)}
            >
              <input
                type="text"
                value={tab.title}
                onChange={(e) => updateTabTitle(tab.id, e.target.value)}
                className="text-xs font-medium bg-transparent border-none outline-none w-24"
                style={{ color: theme.colors.text }}
                onClick={(e) => e.stopPropagation()}
              />
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" style={{ color: theme.colors.textSecondary }} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={createNewTab}
            className="px-3 py-2 transition-all hover:bg-white/5"
          >
            <Plus className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b glass-morphism" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: config?.color + '20' }}
            >
              <span className="text-xs font-bold" style={{ color: config?.color }}>
                {config?.name.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: theme.colors.text }}>
                {connection.name}
              </h3>
              <p className="text-xs flex items-center gap-2" style={{ color: theme.colors.textSecondary }}>
                {connection.environment}
                {isProduction && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#dc262620', color: '#dc2626' }}>
                    PRODUCTION
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRun}
              disabled={isRunning || !activeTab?.content.trim()}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              style={{ background: isRunning ? theme.colors.border : `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Query'}
            </button>
          </div>
        </div>

        <NaturalLanguageSQL
          onGenerateSQL={(sql) => {
            if (activeTab) {
              updateTabContent(activeTab.id, sql);
            }
          }}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4">
            <textarea
              value={activeTab?.content || ''}
              onChange={(e) => activeTab && updateTabContent(activeTab.id, e.target.value)}
              placeholder="Write your SQL query here..."
              className="w-full h-full p-4 rounded-xl glass-card border outline-none font-mono text-sm resize-none"
              style={{
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.editorBg,
                color: theme.colors.editorText,
              }}
            />
          </div>

          {results && (
            <div className="h-64 border-t overflow-auto p-4" style={{ borderColor: theme.colors.border }}>
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: theme.colors.sidebar }}>
                      {Object.keys(results[0] || {}).map((key) => (
                        <th key={key} className="px-4 py-2 text-left text-xs font-semibold" style={{ color: theme.colors.text }}>
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, idx) => (
                      <tr key={idx} className="border-t" style={{ borderColor: theme.colors.border }}>
                        {Object.values(row).map((value: any, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-2 text-xs" style={{ color: theme.colors.text }}>
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
          <div className="relative w-full max-w-md glass-card rounded-2xl shadow-2xl p-6" style={{ borderColor: '#dc2626', backgroundColor: theme.colors.foreground, border: '2px solid #dc2626' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dc262620' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: '#dc2626' }} />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: theme.colors.text }}>
                  Confirm Production Change
                </h3>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  This will modify production data
                </p>
              </div>
            </div>

            <div className="mb-4 p-3 rounded-lg glass-card">
              <pre className="text-xs font-mono whitespace-pre-wrap" style={{ color: theme.colors.text }}>
                {pendingQuery}
              </pre>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
              >
                Cancel
              </button>
              <button
                onClick={() => executeQuery(pendingQuery)}
                className="flex-1 px-4 py-2 rounded-lg font-medium text-white"
                style={{ backgroundColor: '#dc2626' }}
              >
                Execute Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
