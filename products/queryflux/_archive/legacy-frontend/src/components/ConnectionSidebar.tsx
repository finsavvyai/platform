import { useState, useEffect } from 'react';
import { Plus, Database, Folder, Settings, History, ChevronDown, ChevronRight, FolderOpen, Crown } from 'lucide-react';
import { Connection } from '../lib/supabase';
import { DATABASE_CONFIGS } from '../types/database';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface ConnectionSidebarProps {
  connections: Connection[];
  selectedConnectionId: string | null;
  onSelectConnection: (id: string) => void;
  onNewConnection: () => void;
  onManageProjects: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
  onShowSubscription: () => void;
}

interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface ConnectionGroup {
  projectId: string | null;
  projectName: string;
  projectColor: string;
  environments: {
    [environment: string]: Connection[];
  };
}

export function ConnectionSidebar({
  connections,
  selectedConnectionId,
  onSelectConnection,
  onNewConnection,
  onManageProjects,
  onShowHistory,
  onShowSettings,
  onShowSubscription,
}: ConnectionSidebarProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['ungrouped']));
  const [expandedEnvironments, setExpandedEnvironments] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('projects')
      .select('id, name, color, icon')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setProjects(data);
    }
  };

  const groupConnectionsByProject = (): ConnectionGroup[] => {
    const groups: { [key: string]: ConnectionGroup } = {};

    connections.forEach((conn) => {
      const projectId = conn.project_id || 'ungrouped';
      const project = projects.find((p) => p.id === projectId);
      const projectName = project?.name || 'Ungrouped';
      const projectColor = project?.color || theme.colors.textSecondary;

      if (!groups[projectId]) {
        groups[projectId] = {
          projectId: projectId === 'ungrouped' ? null : projectId,
          projectName,
          projectColor,
          environments: {},
        };
      }

      const env = conn.environment || 'development';
      if (!groups[projectId].environments[env]) {
        groups[projectId].environments[env] = [];
      }

      groups[projectId].environments[env].push(conn);
    });

    return Object.values(groups);
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleEnvironment = (key: string) => {
    const newExpanded = new Set(expandedEnvironments);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedEnvironments(newExpanded);
  };

  const groupedConnections = groupConnectionsByProject();

  return (
    <div
      className="w-64 border-r flex flex-col h-full glass-morphism-strong"
      style={{ borderColor: theme.colors.border }}
    >
      <div className="p-4 border-b shimmer space-y-2" style={{ borderColor: theme.colors.border }}>
        <button
          onClick={onNewConnection}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-semibold hover-3d glow-effect"
          style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
        >
          <Plus className="w-4 h-4" />
          {t('database.newConnection')}
        </button>
        <button
          onClick={onManageProjects}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all glass-morphism"
          style={{ color: theme.colors.text }}
        >
          <Folder className="w-4 h-4" />
          {t('database.manageProjects')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {groupedConnections.map((group) => {
          const projectKey = group.projectId || 'ungrouped';
          const isProjectExpanded = expandedProjects.has(projectKey);

          return (
            <div key={projectKey}>
              <button
                onClick={() => toggleProject(projectKey)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all hover:bg-white/5"
              >
                {isProjectExpanded ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                )}
                <div
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: group.projectColor }}
                >
                  {isProjectExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                </div>
                <span className="text-sm font-semibold truncate" style={{ color: theme.colors.text }}>
                  {group.projectName}
                </span>
                <span className="text-xs ml-auto" style={{ color: theme.colors.textSecondary }}>
                  {Object.values(group.environments).flat().length}
                </span>
              </button>

              {isProjectExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {Object.entries(group.environments).map(([env, conns]) => {
                    const envKey = `${projectKey}-${env}`;
                    const isEnvExpanded = expandedEnvironments.has(envKey);

                    return (
                      <div key={envKey}>
                        <button
                          onClick={() => toggleEnvironment(envKey)}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded-lg transition-all hover:bg-white/5"
                        >
                          {isEnvExpanded ? (
                            <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                          ) : (
                            <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                          )}
                          <span className="text-xs font-medium capitalize" style={{ color: theme.colors.textSecondary }}>
                            {env}
                          </span>
                          <span className="text-xs ml-auto" style={{ color: theme.colors.textSecondary }}>
                            {conns.length}
                          </span>
                        </button>

                        {isEnvExpanded && (
                          <div className="ml-5 mt-1 space-y-1">
                            {conns.map((conn) => {
                              const config = DATABASE_CONFIGS[conn.database_type as keyof typeof DATABASE_CONFIGS];
                              const isSelected = conn.id === selectedConnectionId;
                              const isProduction = conn.environment === 'production';

                              return (
                                <button
                                  key={conn.id}
                                  onClick={() => onSelectConnection(conn.id)}
                                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all border hover-3d ${
                                    isSelected ? 'glass-morphism shimmer glow-effect' : ''
                                  }`}
                                  style={{
                                    borderColor: isSelected
                                      ? (isProduction ? '#dc2626' : theme.colors.accent)
                                      : 'transparent',
                                    backgroundColor: isProduction && isSelected ? '#dc262610' : 'transparent',
                                  }}
                                >
                                  <div
                                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 relative"
                                    style={{
                                      backgroundColor: config?.color + '20' || '#e5e7eb',
                                      boxShadow: isSelected ? `0 0 10px ${config?.color}40` : 'none'
                                    }}
                                  >
                                    <Database className="w-3 h-3" style={{ color: config?.color || '#6b7280' }} />
                                    {conn.is_active && (
                                      <span
                                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                                        style={{ backgroundColor: '#10b981' }}
                                      />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-1">
                                      <p className="text-xs font-medium truncate" style={{ color: theme.colors.text }}>
                                        {conn.name}
                                      </p>
                                      {isProduction && (
                                        <span
                                          className="px-1 py-0.5 rounded text-[8px] font-bold"
                                          style={{ backgroundColor: '#dc262620', color: '#dc2626' }}
                                        >
                                          PROD
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] truncate" style={{ color: theme.colors.textSecondary }}>
                                      {config?.name || conn.database_type}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {connections.length === 0 && (
          <div className="text-center py-12 px-4">
            <Database className="w-12 h-12 mx-auto mb-3" style={{ color: theme.colors.border }} />
            <p className="text-sm mb-1" style={{ color: theme.colors.text }}>{t('database.noConnectionsYet')}</p>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{t('database.addFirstConnection')}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t space-y-1" style={{ borderColor: theme.colors.border }}>
        <button
          onClick={onShowSubscription}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:opacity-80"
          style={{ color: theme.colors.text }}
        >
          <Crown className="w-4 h-4" />
          <span className="text-sm font-medium">{t('database.subscription')}</span>
        </button>
        <button
          onClick={onShowHistory}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:opacity-80"
          style={{ color: theme.colors.text }}
        >
          <History className="w-4 h-4" />
          <span className="text-sm font-medium">{t('database.history')}</span>
        </button>
        <button
          onClick={onShowSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all hover:opacity-80"
          style={{ color: theme.colors.text }}
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm font-medium">{t('nav.settings')}</span>
        </button>
      </div>
    </div>
  );
}
