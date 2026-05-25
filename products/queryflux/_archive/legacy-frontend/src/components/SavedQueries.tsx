import { useState } from 'react';
import { Bookmark, Play, CreditCard as Edit2, Trash2, Search, Plus } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description?: string;
  tags: string[];
  createdAt: Date;
  lastUsed?: Date;
}

interface SavedQueriesProps {
  onSelectQuery: (query: string) => void;
}

export function SavedQueries({ onSelectQuery }: SavedQueriesProps) {
  const { theme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  const sampleQueries: SavedQuery[] = [
    {
      id: '1',
      name: 'Active Users This Week',
      query: 'SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL \'7 days\'',
      description: 'Get count of users who logged in within the past week',
      tags: ['users', 'analytics'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    },
    {
      id: '2',
      name: 'Top Products by Revenue',
      query: 'SELECT p.name, SUM(oi.quantity * p.price) as revenue FROM products p JOIN order_items oi ON p.id = oi.product_id GROUP BY p.id ORDER BY revenue DESC LIMIT 10',
      description: 'Top 10 products by total revenue',
      tags: ['products', 'sales', 'analytics'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    },
    {
      id: '3',
      name: 'Pending Orders',
      query: 'SELECT * FROM orders WHERE status = \'pending\' ORDER BY created_at DESC',
      description: 'List all pending orders, newest first',
      tags: ['orders'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    },
  ];

  const filteredQueries = sampleQueries.filter(
    (q) =>
      q.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b space-y-3" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5" style={{ color: theme.colors.accent }} />
            <h3 className="font-semibold" style={{ color: theme.colors.text }}>Saved Queries</h3>
          </div>
          <button
            className="p-2 rounded-lg glass-morphism hover-3d"
            title="New saved query"
          >
            <Plus className="w-4 h-4" style={{ color: theme.colors.text }} />
          </button>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
            style={{ color: theme.colors.textSecondary }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search queries..."
            className="w-full pl-10 pr-4 py-2 rounded-lg glass-card border outline-none text-sm"
            style={{
              color: theme.colors.text,
              borderColor: theme.colors.border,
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredQueries.map((query) => (
          <div
            key={query.id}
            className="glass-card p-4 rounded-xl hover-3d cursor-pointer transition-all"
            onClick={() => onSelectQuery(query.query)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                  {query.name}
                </h4>
                {query.description && (
                  <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                    {query.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectQuery(query.query);
                  }}
                  className="p-1.5 rounded-lg glass-morphism hover-3d"
                  title="Run query"
                >
                  <Play className="w-3 h-3" style={{ color: theme.colors.textSecondary }} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="p-1.5 rounded-lg glass-morphism hover-3d"
                  title="Edit"
                >
                  <Edit2 className="w-3 h-3" style={{ color: theme.colors.textSecondary }} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="p-1.5 rounded-lg glass-morphism hover-3d"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" style={{ color: theme.colors.textSecondary }} />
                </button>
              </div>
            </div>

            <code
              className="text-xs font-mono block mb-2 line-clamp-2"
              style={{ color: theme.colors.text }}
            >
              {query.query}
            </code>

            <div className="flex items-center gap-2 flex-wrap">
              {query.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs rounded-full"
                  style={{
                    backgroundColor: theme.colors.accent + '20',
                    color: theme.colors.accent,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}

        {filteredQueries.length === 0 && (
          <div className="text-center py-12">
            <Bookmark className="w-12 h-12 mx-auto mb-3" style={{ color: theme.colors.textSecondary }} />
            <p className="font-medium mb-1" style={{ color: theme.colors.text }}>
              No queries found
            </p>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              {searchTerm ? 'Try a different search term' : 'Save your first query to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
