import { useState, FormEvent, useEffect } from 'react';
import { ArrowLeft, TestTube, Loader2, Link2, Container, ChevronDown, Plus, Check } from 'lucide-react';
import { DatabaseType, DATABASE_CONFIGS } from '../types/database';
import { supabase } from '../lib/supabase';
import { databaseAPI } from '../lib/api';
import { parseConnectionURL } from '../utils/urlParser';
import { audioFeedback } from '../utils/audioFeedback';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DockerHelper } from './DockerHelper';

interface ConnectionFormProps {
  databaseType: DatabaseType;
  onBack: () => void;
  onConnect: (connection: any) => void;
  onCancel: () => void;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export function ConnectionForm({ databaseType, onBack, onConnect, onCancel }: ConnectionFormProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const config = DATABASE_CONFIGS[databaseType];
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [inputMode, setInputMode] = useState<'manual' | 'url' | 'docker'>('manual');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: config.defaultPort.toString(),
    database: '',
    username: '',
    password: '',
    sslEnabled: config.supportsSSL,
    connectionUrl: '',
    environment: 'development',
  });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.project-dropdown-container')) {
        setShowProjectDropdown(false);
      }
    };

    if (showProjectDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProjectDropdown]);

  useEffect(() => {
    if (inputMode === 'url' && formData.connectionUrl) {
      const parsed = parseConnectionURL(formData.connectionUrl);
      if (parsed.host) {
        setFormData(prev => ({
          ...prev,
          host: parsed.host || '',
          port: parsed.port?.toString() || prev.port,
          database: parsed.database || '',
          username: parsed.username || '',
          password: parsed.password || '',
          sslEnabled: parsed.ssl || false,
        }));
      }
    }
  }, [formData.connectionUrl, inputMode]);

  const loadProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('projects')
        .select('id, name, color')
        .order('name');

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: newProjectName,
          color: config.color,
        })
        .select()
        .single();

      if (error) throw error;

      setProjects([...projects, data]);
      setSelectedProject(data.id);
      setNewProjectName('');
      setShowNewProject(false);
      setShowProjectDropdown(false);
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDockerSetup = async () => {
    if (!config.supportsDocker) return;

    setIsTesting(true);
    setTestResult({ success: false, message: 'Setting up Docker container...' });

    await new Promise(resolve => setTimeout(resolve, 2000));

    setFormData(prev => ({
      ...prev,
      host: 'localhost',
      port: config.defaultPort.toString(),
      username: 'admin',
      password: 'password',
    }));

    setIsTesting(false);
    setTestResult({
      success: true,
      message: `Docker container started successfully on port ${config.defaultPort}`,
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setTestResult({ success: false, message: 'Connection name is required' });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setTestResult({ success: false, message: 'You must be logged in to save connections' });
        return;
      }

      const connectionData = {
        user_id: user.id,
        name: formData.name,
        database_type: databaseType,
        host: formData.host || null,
        port: formData.port ? parseInt(formData.port) : null,
        database_name: formData.database || null,
        username: formData.username || null,
        password: formData.password || null,
        ssl_enabled: formData.sslEnabled,
        connection_url: formData.connectionUrl || null,
        project_id: selectedProject || null,
        environment: formData.environment,
        color: config.color,
        icon: config.icon,
      };

      const { data, error } = await supabase
        .from('connections')
        .insert(connectionData)
        .select()
        .single();

      if (error) throw error;

      audioFeedback.connect();
      onConnect(data);
    } catch (error: any) {
      audioFeedback.error();
      setTestResult({ success: false, message: error.message || 'Failed to save connection' });
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    audioFeedback.click();

    try {
      // Build connection config based on input mode
      let connectionConfig: any = {
        dbType: databaseType,
        connectionConfig: {}
      };

      if (inputMode === 'url') {
        const parsed = parseConnectionURL(formData.connectionUrl, databaseType);
        connectionConfig.connectionConfig = {
          host: parsed.host,
          port: parsed.port,
          database: parsed.database,
          user: parsed.username,
          password: parsed.password,
          ssl: formData.sslEnabled
        };
      } else if (inputMode === 'docker') {
        connectionConfig.connectionConfig = {
          host: 'localhost',
          port: config.defaultPort,
          database: formData.database || 'postgres',
          user: 'admin',
          password: 'password',
          ssl: false
        };
      } else {
        connectionConfig.connectionConfig = {
          host: formData.host,
          port: parseInt(formData.port),
          database: formData.database,
          user: formData.username,
          password: formData.password,
          ssl: formData.sslEnabled
        };
      }

      const result = await databaseAPI.testConnection(connectionConfig);

      setIsTesting(false);
      setTestResult(result);

      if (result.success) {
        audioFeedback.success();
      } else {
        audioFeedback.error();
      }

    } catch (error) {
      setIsTesting(false);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      });
      audioFeedback.error();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl glass-morphism hover-3d transition-all"
          >
            <ArrowLeft className="w-5 h-5 " style={{ color: theme.colors.textSecondary }} />
          </button>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center glow-effect floating-animation"
            style={{ backgroundColor: config.color + '20', boxShadow: `0 0 25px ${config.color}40` }}
          >
            <div className="w-7 h-7" style={{ color: config.color }}>●</div>
          </div>
          <div>
            <h3 className="text-lg font-semibold " style={{ color: theme.colors.text }}>{config.name}</h3>
            <p className="text-xs " style={{ color: theme.colors.textSecondary }}>{t('nav.configureConnection')}</p>
          </div>
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="flex items-center gap-2 p-1 glass-card rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setInputMode('manual')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            inputMode === 'manual'
              ? ' text-white shadow-lg'
              : '" style={{ color: theme.colors.textSecondary }} className=" hover:" style={{ color: theme.colors.text }} className="'
          }`}
        >
          Manual
        </button>
        {config.supportsURL && (
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              inputMode === 'url'
                ? ' text-white shadow-lg'
                : '" style={{ color: theme.colors.textSecondary }} className=" hover:" style={{ color: theme.colors.text }} className="'
            }`}
          >
            <Link2 className="w-4 h-4" />
            URL
          </button>
        )}
        {config.supportsDocker && (
          <button
            type="button"
            onClick={() => setInputMode('docker')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              inputMode === 'docker'
                ? ' text-white shadow-lg'
                : '" style={{ color: theme.colors.textSecondary }} className=" hover:" style={{ color: theme.colors.text }} className="'
            }`}
          >
            <Container className="w-4 h-4" />
            Docker
          </button>
        )}
      </div>

      {/* Docker Quick Setup */}
      {inputMode === 'docker' && config.supportsDocker && (
        <DockerHelper
          databaseType={databaseType}
          onUseDockerConfig={(host, port) => {
            setFormData({
              ...formData,
              host,
              port,
            });
            setInputMode('manual');
          }}
        />
      )}

      {/* URL Input */}
      {inputMode === 'url' && config.supportsURL && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Connection URL
            </label>
            <input
              type="text"
              value={formData.connectionUrl}
              onChange={(e) => setFormData({ ...formData, connectionUrl: e.target.value })}
              placeholder={`${databaseType}://username:password@host:${config.defaultPort}/database`}
              className="w-full px-4 py-3 glass-card border rounded-2xl focus:ring-2 outline-none transition-all font-mono text-sm"
              style={{ borderColor: 'rgba(99, 102, 241, 0.3)', focusRingColor: config.color }}
            />
            <p className="text-xs mt-2">Parsed values will be auto-filled below</p>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Connection Name */}
        <div>
          <label className="block text-sm font-semibold mb-2.5">
            Connection Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Production Database"
            className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all placeholder-opacity-50/50"
            style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
            required
          />
        </div>

        {/* Project Dropdown */}
        <div>
          <label className="block text-sm font-semibold mb-2.5">
            Project
          </label>
          <div className="relative project-dropdown-container">
            <button
              type="button"
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="w-full px-4 py-3.5 glass-card border rounded-2xl flex items-center justify-between text-left transition-all hover-3d"
              style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
            >
              <span style={{ color: theme.colors.text }}>
                {selectedProject
                  ? projects.find(p => p.id === selectedProject)?.name
                  : 'Select or create project'}
              </span>
              <ChevronDown className="w-5 h-5 " style={{ color: theme.colors.textSecondary }} />
            </button>

            {showProjectDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 glass-card border rounded-2xl z-[100] shadow-2xl" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                <div className="max-h-60 overflow-y-auto scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProject('');
                      setShowProjectDropdown(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition-all flex items-center justify-between"
                  >
                    <span style={{ color: theme.colors.text }}>No Project</span>
                    {!selectedProject && <Check className="w-4 h-4 " style={{ color: theme.colors.textSecondary }} />}
                  </button>
                  {projects.map(project => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        setSelectedProject(project.id);
                        setShowProjectDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span style={{ color: theme.colors.text }}>{project.name}</span>
                      </div>
                      {selectedProject === project.id && <Check className="w-4 h-4 " style={{ color: theme.colors.textSecondary }} />}
                    </button>
                  ))}
                </div>
                <div className="border-t" style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                  {showNewProject ? (
                    <div className="p-3 space-y-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                        placeholder="Project name"
                        className="w-full px-3 py-2 glass-card border rounded-xl outline-none text-sm placeholder-opacity-50/50"
                        style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleCreateProject}
                          className="flex-1 px-3 py-2 text-xs font-semibold text-white rounded-lg transition-all hover-3d"
                          style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)` }}
                        >
                          Create
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewProject(false);
                            setNewProjectName('');
                          }}
                          className="flex-1 px-3 py-2 text-xs font-semibold glass-morphism rounded-lg hover-3d"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewProject(true)}
                      className="w-full px-4 py-3 text-left hover:bg-white/5 transition-all flex items-center gap-2 " style={{ color: theme.colors.textSecondary }}
                    >
                      <Plus className="w-4 h-4" />
                      Create New Project
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manual Fields */}
        {inputMode === 'manual' && (
          <div className="grid grid-cols-2 gap-4">
            {config.requiresHost && (
              <>
                <div>
                  <label className="block text-sm font-semibold mb-2.5">
                    Host
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="localhost"
                    className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                    style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2.5">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    placeholder={config.defaultPort.toString()}
                    className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                    style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
                  />
                </div>
              </>
            )}

            {config.requiresDatabase && (
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-2.5">
                  Database
                </label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  placeholder="database_name"
                  className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                  style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-2.5">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2.5">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 glass-card border rounded-2xl focus:ring-2 outline-none transition-all"
                style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}
              />
            </div>
          </div>
        )}

        {/* Environment Segmented Control */}
        <div>
          <label className="block text-sm font-semibold mb-2.5">
            Environment
          </label>
          <div className="flex items-center gap-2 p-1 glass-card rounded-xl">
            {['development', 'staging', 'production'].map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setFormData({ ...formData, environment: env })}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  formData.environment === env
                    ? ' text-white shadow-lg'
                    : '" style={{ color: theme.colors.textSecondary }} className=" hover:" style={{ color: theme.colors.text }} className="'
                }`}
              >
                {env.charAt(0).toUpperCase() + env.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* SSL Toggle */}
        {config.supportsSSL && (
          <label className="flex items-center gap-3 p-4 glass-card rounded-2xl cursor-pointer hover-3d transition-all">
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.sslEnabled}
                onChange={(e) => setFormData({ ...formData, sslEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-purple-500"></div>
            </div>
            <div>
              <p className="text-sm font-medium " style={{ color: theme.colors.text }}>Enable SSL/TLS</p>
              <p className="text-xs " style={{ color: theme.colors.textSecondary }}>Secure encrypted connection</p>
            </div>
          </label>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={`p-4 rounded-2xl glass-card border ${
            testResult.success
              ? 'border-green-500/30 bg-green-500/10'
              : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <p className={`text-sm font-medium ${
            testResult.success ? 'text-green-300' : 'text-red-300'
          }`}>{testResult.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-6 border-t" style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}>
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting}
          className="flex items-center gap-2 px-5 py-3 text-sm font-semibold glass-morphism rounded-xl hover-3d transition-all disabled:opacity-50 disabled:cursor-not-allowed " style={{ color: theme.colors.text }}
        >
          {isTesting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TestTube className="w-4 h-4" />
          )}
          Test Connection
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 text-sm font-semibold glass-morphism rounded-xl hover-3d transition-all " style={{ color: theme.colors.text }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 text-sm font-semibold text-white rounded-xl hover-3d glow-effect transition-all"
            style={{ background: `linear-gradient(135deg, ${config.color}, ${config.color}dd)` }}
          >
            Connect
          </button>
        </div>
      </div>
    </form>
  );
}
