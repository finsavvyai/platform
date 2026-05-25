import { useState, useEffect } from 'react';
import { Clock, Play, Trash2, Copy, Check, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface QueryHistoryItem {
  id: string;
  query_text: string;
  executed_at: string;
  execution_time_ms: number;
  rows_affected: number;
  status: 'success' | 'error';
  error_message?: string;
}

interface QueryHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (query: string) => void;
}

export function QueryHistory({ isOpen, onClose, onSelectQuery }: QueryHistoryProps) {
  const { theme } = useTheme();
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('query_executions')
      .select('*')
      .eq('user_id', user.id)
      .order('executed_at', { ascending: false })
      .limit(50);

    if (data) {
      setHistory(data);
    }
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    await supabase
      .from('query_executions')
      .delete()
      .eq('id', id);

    setHistory(history.filter(h => h.id !== id));
  };

  const handleCopy = (id: string, query: string) => {
    navigator.clipboard.writeText(query);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-3xl h-[80vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                Query History
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Recent query executions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full glass-morphism hover-3d transition-all"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Loading history...
              </p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 mx-auto mb-3 opacity-50" style={{ color: theme.colors.textSecondary }} />
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                No query history yet
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="glass-card p-4 rounded-xl hover-3d cursor-pointer transition-all"
                onClick={() => {
                  onSelectQuery(item.query_text);
                  onClose();
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${item.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                    <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      {formatTime(item.executed_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item.id, item.query_text);
                      }}
                      className="p-1.5 rounded-lg glass-morphism hover-3d"
                      title="Copy query"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3" style={{ color: theme.colors.accent }} />
                      ) : (
                        <Copy className="w-3 h-3" style={{ color: theme.colors.textSecondary }} />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectQuery(item.query_text);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg glass-morphism hover-3d"
                      title="Run query"
                    >
                      <Play className="w-3 h-3" style={{ color: theme.colors.textSecondary }} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="p-1.5 rounded-lg glass-morphism hover-3d"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>

                <code
                  className="text-xs font-mono block mb-2 line-clamp-2"
                  style={{ color: theme.colors.text }}
                >
                  {item.query_text}
                </code>

                {item.error_message && (
                  <p className="text-xs mb-2 px-2 py-1 rounded" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
                    {item.error_message}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
                  <span>{item.execution_time_ms}ms</span>
                  <span>•</span>
                  <span>{item.rows_affected || 0} rows</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
