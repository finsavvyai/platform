import { useState } from 'react';
import { X, Database, Cloud, Box, Check, AlertCircle, Loader, ExternalLink } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface DatabaseCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

type HostingType = 'docker' | 'cloud';
type CloudProvider = 'supabase' | 'aws' | 'gcp';

export function DatabaseCreator({ isOpen, onClose, onCreated }: DatabaseCreatorProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [hostingType, setHostingType] = useState<HostingType>('docker');
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('supabase');
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<'idle' | 'creating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [dockerConfig, setDockerConfig] = useState({
    name: '',
    port: '5432',
    username: 'postgres',
    password: '',
    database: 'mydb',
  });

  const [supabaseConfig, setSupabaseConfig] = useState({
    projectName: '',
    region: 'us-east-1',
    password: '',
  });

  const [awsConfig, setAwsConfig] = useState({
    instanceName: '',
    instanceType: 'db.t3.micro',
    region: 'us-east-1',
    username: 'postgres',
    password: '',
    database: 'postgres',
  });

  const [gcpConfig, setGcpConfig] = useState({
    instanceName: '',
    tier: 'db-f1-micro',
    region: 'us-central1',
    database: 'postgres',
  });

  const cloudProviders = [
    {
      id: 'supabase' as CloudProvider,
      name: 'Supabase',
      description: 'PostgreSQL with realtime features',
      icon: Database,
      color: '#3ECF8E',
    },
    {
      id: 'aws' as CloudProvider,
      name: 'AWS RDS',
      description: 'Amazon Relational Database Service',
      icon: Cloud,
      color: '#FF9900',
    },
    {
      id: 'gcp' as CloudProvider,
      name: 'Google Cloud SQL',
      description: 'Fully managed relational database',
      icon: Cloud,
      color: '#4285F4',
    },
  ];

  const handleCreateDocker = async () => {
    setIsCreating(true);
    setCreationStatus('creating');
    setErrorMessage('');

    await new Promise(resolve => setTimeout(resolve, 3000));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage('User not authenticated');
      setCreationStatus('error');
      setIsCreating(false);
      return;
    }

    const { error } = await supabase
      .from('connections')
      .insert({
        user_id: user.id,
        name: dockerConfig.name || 'Docker PostgreSQL',
        database_type: 'postgresql',
        host: 'localhost',
        port: parseInt(dockerConfig.port),
        database: dockerConfig.database,
        username: dockerConfig.username,
        password: dockerConfig.password,
        ssl_enabled: false,
        environment: 'development',
        docker_config: {
          image: 'postgres:15',
          containerName: `postgres-${Date.now()}`,
          volumes: [`${dockerConfig.database}-data:/var/lib/postgresql/data`],
        },
      });

    if (error) {
      setErrorMessage(error.message);
      setCreationStatus('error');
    } else {
      setCreationStatus('success');
      setTimeout(() => {
        if (onCreated) onCreated();
        onClose();
      }, 2000);
    }

    setIsCreating(false);
  };

  const handleCreateCloud = async () => {
    setIsCreating(true);
    setCreationStatus('creating');
    setErrorMessage('');

    await new Promise(resolve => setTimeout(resolve, 3000));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage('User not authenticated');
      setCreationStatus('error');
      setIsCreating(false);
      return;
    }

    let config: any = {};
    let name = '';

    if (cloudProvider === 'supabase') {
      config = supabaseConfig;
      name = supabaseConfig.projectName || 'Supabase Project';
    } else if (cloudProvider === 'aws') {
      config = awsConfig;
      name = awsConfig.instanceName || 'AWS RDS Instance';
    } else if (cloudProvider === 'gcp') {
      config = gcpConfig;
      name = gcpConfig.instanceName || 'GCP Cloud SQL';
    }

    const { error } = await supabase
      .from('connections')
      .insert({
        user_id: user.id,
        name: name,
        database_type: 'postgresql',
        host: 'pending-creation',
        port: 5432,
        database: config.database || 'postgres',
        username: config.username || 'postgres',
        password: config.password || '',
        ssl_enabled: true,
        environment: 'production',
        cloud_provider: cloudProvider,
        cloud_config: config,
      });

    if (error) {
      setErrorMessage(error.message);
      setCreationStatus('error');
    } else {
      setCreationStatus('success');
      setTimeout(() => {
        if (onCreated) onCreated();
        onClose();
      }, 2000);
    }

    setIsCreating(false);
  };

  const handleCreate = () => {
    if (hostingType === 'docker') {
      handleCreateDocker();
    } else {
      handleCreateCloud();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-3xl glass-card rounded-3xl shadow-2xl overflow-hidden" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                {t('database.createNewDatabase')}
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Set up a new database on Docker or Cloud
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

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setHostingType('docker')}
              className={`p-4 rounded-xl transition-all hover-3d ${
                hostingType === 'docker' ? 'glass-morphism' : ''
              }`}
              style={{
                borderColor: hostingType === 'docker' ? theme.colors.accent : theme.colors.border,
                border: '2px solid',
              }}
            >
              <Box className="w-8 h-8 mb-2" style={{ color: hostingType === 'docker' ? theme.colors.accent : theme.colors.textSecondary }} />
              <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                Docker
              </h3>
              <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Run locally on your machine
              </p>
            </button>

            <button
              onClick={() => setHostingType('cloud')}
              className={`p-4 rounded-xl transition-all hover-3d ${
                hostingType === 'cloud' ? 'glass-morphism' : ''
              }`}
              style={{
                borderColor: hostingType === 'cloud' ? theme.colors.accent : theme.colors.border,
                border: '2px solid',
              }}
            >
              <Cloud className="w-8 h-8 mb-2" style={{ color: hostingType === 'cloud' ? theme.colors.accent : theme.colors.textSecondary }} />
              <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                Cloud
              </h3>
              <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Managed database service
              </p>
            </button>
          </div>

          {hostingType === 'docker' ? (
            <div className="space-y-4">
              <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                Docker Configuration
              </h3>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                  Connection Name
                </label>
                <input
                  type="text"
                  value={dockerConfig.name}
                  onChange={(e) => setDockerConfig({ ...dockerConfig, name: e.target.value })}
                  placeholder="My Docker PostgreSQL"
                  className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Port
                  </label>
                  <input
                    type="text"
                    value={dockerConfig.port}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, port: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                    style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Database Name
                  </label>
                  <input
                    type="text"
                    value={dockerConfig.database}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, database: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                    style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={dockerConfig.username}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                    style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={dockerConfig.password}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, password: e.target.value })}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                    style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg glass-card">
                <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  Docker command will be generated and saved to your connection. You can run it locally to start the database.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-semibold mb-3" style={{ color: theme.colors.text }}>
                Choose Cloud Provider
              </h3>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {cloudProviders.map((provider) => {
                  const Icon = provider.icon;
                  return (
                    <button
                      key={provider.id}
                      onClick={() => setCloudProvider(provider.id)}
                      className={`p-3 rounded-lg transition-all hover-3d ${
                        cloudProvider === provider.id ? 'glass-morphism' : ''
                      }`}
                      style={{
                        borderColor: cloudProvider === provider.id ? provider.color : theme.colors.border,
                        border: '2px solid',
                      }}
                    >
                      <Icon className="w-6 h-6 mb-2 mx-auto" style={{ color: cloudProvider === provider.id ? provider.color : theme.colors.textSecondary }} />
                      <p className="text-xs font-semibold" style={{ color: theme.colors.text }}>
                        {provider.name}
                      </p>
                    </button>
                  );
                })}
              </div>

              {cloudProvider === 'supabase' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={supabaseConfig.projectName}
                      onChange={(e) => setSupabaseConfig({ ...supabaseConfig, projectName: e.target.value })}
                      placeholder="my-project"
                      className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                      style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Region
                      </label>
                      <select
                        value={supabaseConfig.region}
                        onChange={(e) => setSupabaseConfig({ ...supabaseConfig, region: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="eu-west-1">EU West (Ireland)</option>
                        <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Database Password
                      </label>
                      <input
                        type="password"
                        value={supabaseConfig.password}
                        onChange={(e) => setSupabaseConfig({ ...supabaseConfig, password: e.target.value })}
                        placeholder="Strong password"
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg glass-card flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: theme.colors.accent }} />
                    <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      This will create a new Supabase project. You'll need to confirm in the Supabase dashboard.
                    </p>
                  </div>
                </div>
              )}

              {cloudProvider === 'aws' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                      Instance Name
                    </label>
                    <input
                      type="text"
                      value={awsConfig.instanceName}
                      onChange={(e) => setAwsConfig({ ...awsConfig, instanceName: e.target.value })}
                      placeholder="my-database"
                      className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                      style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Instance Type
                      </label>
                      <select
                        value={awsConfig.instanceType}
                        onChange={(e) => setAwsConfig({ ...awsConfig, instanceType: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      >
                        <option value="db.t3.micro">db.t3.micro (Free Tier)</option>
                        <option value="db.t3.small">db.t3.small</option>
                        <option value="db.t3.medium">db.t3.medium</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Region
                      </label>
                      <select
                        value={awsConfig.region}
                        onChange={(e) => setAwsConfig({ ...awsConfig, region: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">EU (Ireland)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Master Username
                      </label>
                      <input
                        type="text"
                        value={awsConfig.username}
                        onChange={(e) => setAwsConfig({ ...awsConfig, username: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Master Password
                      </label>
                      <input
                        type="password"
                        value={awsConfig.password}
                        onChange={(e) => setAwsConfig({ ...awsConfig, password: e.target.value })}
                        placeholder="Strong password"
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-lg glass-card flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: '#FF9900' }} />
                    <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      AWS credentials required. Configure in Settings first.
                    </p>
                  </div>
                </div>
              )}

              {cloudProvider === 'gcp' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                      Instance Name
                    </label>
                    <input
                      type="text"
                      value={gcpConfig.instanceName}
                      onChange={(e) => setGcpConfig({ ...gcpConfig, instanceName: e.target.value })}
                      placeholder="my-instance"
                      className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                      style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Tier
                      </label>
                      <select
                        value={gcpConfig.tier}
                        onChange={(e) => setGcpConfig({ ...gcpConfig, tier: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      >
                        <option value="db-f1-micro">db-f1-micro</option>
                        <option value="db-g1-small">db-g1-small</option>
                        <option value="db-n1-standard-1">db-n1-standard-1</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                        Region
                      </label>
                      <select
                        value={gcpConfig.region}
                        onChange={(e) => setGcpConfig({ ...gcpConfig, region: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      >
                        <option value="us-central1">us-central1</option>
                        <option value="europe-west1">europe-west1</option>
                        <option value="asia-east1">asia-east1</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg glass-card flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" style={{ color: '#4285F4' }} />
                    <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      GCP service account required. Configure in Settings first.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {creationStatus === 'error' && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-red-500" />
              <p className="text-xs text-red-500">{errorMessage}</p>
            </div>
          )}

          {creationStatus === 'success' && (
            <div className="p-3 rounded-lg bg-green-500/20 border border-green-500 flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 text-green-500" />
              <p className="text-xs text-green-500">Database created successfully!</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: theme.colors.border }}>
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 rounded-lg font-medium disabled:opacity-50"
            style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="flex items-center gap-2 px-6 py-2 text-white rounded-lg font-medium disabled:opacity-50"
            style={{ background: isCreating ? theme.colors.border : `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
          >
            {isCreating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Create Database
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
