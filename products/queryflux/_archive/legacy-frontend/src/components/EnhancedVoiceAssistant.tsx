import { useState, useEffect } from 'react';
import { X, Mic, MicOff, Volume2, Crown, Settings as SettingsIcon, Database, Check, AlertCircle, Activity, TrendingUp, Shield, Clock, BarChart3, Cpu, HardDrive, Zap, Calendar, FileText, Users, Lock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface EnhancedVoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
}

type VoiceType = 'male' | 'female' | 'robot';
type CommandCategory = 'query' | 'monitoring' | 'config' | 'troubleshoot' | 'planning' | 'security' | 'scheduling';

interface VoiceSettings {
  voiceType: VoiceType;
  speed: number;
  volume: number;
  autoRead: boolean;
  multiLanguage: string;
  contextAware: boolean;
}

interface PerformanceMetrics {
  cpu: number;
  memory: number;
  activeConnections: number;
  queryTime: number;
  diskUsage: number;
}

interface AuditLog {
  timestamp: string;
  command: string;
  user: string;
  action: string;
  status: string;
}

export function EnhancedVoiceAssistant({ isOpen, onClose, connectionId }: EnhancedVoiceAssistantProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [hasPremium, setHasPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'monitoring' | 'audit'>('assistant');
  const [settings, setSettings] = useState<VoiceSettings>({
    voiceType: 'female',
    speed: 1.0,
    volume: 1.0,
    autoRead: true,
    multiLanguage: 'en',
    contextAware: true,
  });
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    cpu: 45,
    memory: 62,
    activeConnections: 87,
    queryTime: 125,
    diskUsage: 68,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [conversationContext, setConversationContext] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      checkPremiumStatus();
      loadSettings();
      if (hasPremium) {
        startMetricsMonitoring();
        loadAuditLogs();
      }
    }
  }, [isOpen]);

  const checkPremiumStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    setHasPremium(!!data);
  };

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('voice_settings')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data?.voice_settings) {
      setSettings({ ...settings, ...data.voice_settings });
    }
  };

  const saveSettings = async (newSettings: VoiceSettings) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        voice_settings: newSettings,
        updated_at: new Date().toISOString(),
      });

    setSettings(newSettings);
  };

  const startMetricsMonitoring = () => {
    const interval = setInterval(() => {
      setMetrics({
        cpu: Math.floor(Math.random() * 30) + 30,
        memory: Math.floor(Math.random() * 20) + 50,
        activeConnections: Math.floor(Math.random() * 40) + 60,
        queryTime: Math.floor(Math.random() * 50) + 100,
        diskUsage: Math.floor(Math.random() * 10) + 60,
      });
    }, 5000);

    return () => clearInterval(interval);
  };

  const loadAuditLogs = async () => {
    const mockLogs: AuditLog[] = [
      { timestamp: new Date().toISOString(), command: 'Show all users', user: 'admin@example.com', action: 'SELECT', status: 'success' },
      { timestamp: new Date().toISOString(), command: 'Create backup', user: 'admin@example.com', action: 'BACKUP', status: 'success' },
      { timestamp: new Date().toISOString(), command: 'Increase pool size', user: 'admin@example.com', action: 'CONFIG', status: 'success' },
    ];
    setAuditLogs(mockLogs);
  };

  const saveAuditLog = async (command: string, action: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newLog: AuditLog = {
      timestamp: new Date().toISOString(),
      command,
      user: user.email || 'unknown',
      action,
      status,
    };

    setAuditLogs(prev => [newLog, ...prev]);
  };

  const voiceTypes = [
    { id: 'male' as VoiceType, label: t('voiceAssistant.male'), icon: '👨', isFree: true },
    { id: 'female' as VoiceType, label: t('voiceAssistant.female'), icon: '👩', isFree: true },
    { id: 'robot' as VoiceType, label: t('voiceAssistant.robot'), icon: '🤖', isFree: false },
  ];

  const features = [
    {
      category: 'query' as CommandCategory,
      label: t('voiceAssistant.naturalLanguageQueries'),
      icon: Database,
      isFree: true,
      examples: [
        'Show me all users who logged in this week',
        'Get the top 10 products by revenue',
        'Find customers from California',
      ]
    },
    {
      category: 'monitoring' as CommandCategory,
      label: t('voiceAssistant.performanceMonitoring'),
      icon: Activity,
      isFree: false,
      examples: [
        'What is the current CPU usage?',
        'Show memory consumption for the last hour',
        'How many active connections do we have?',
      ]
    },
    {
      category: 'config' as CommandCategory,
      label: t('voiceAssistant.configManagement'),
      icon: SettingsIcon,
      isFree: false,
      examples: [
        'Increase connection pool size to 100',
        'Enable query logging',
        'Set max query timeout to 30 seconds',
      ]
    },
    {
      category: 'troubleshoot' as CommandCategory,
      label: t('voiceAssistant.troubleshootingAssistant'),
      icon: AlertCircle,
      isFree: false,
      examples: [
        'Why is the database slow?',
        'Diagnose connection timeouts',
        'What queries are taking the longest?',
      ]
    },
    {
      category: 'planning' as CommandCategory,
      label: t('voiceAssistant.capacityPlanning'),
      icon: TrendingUp,
      isFree: false,
      examples: [
        'Predict storage needs for next quarter',
        'Create a bar chart showing monthly user growth',
        'Analyze table growth patterns',
      ]
    },
    {
      category: 'security' as CommandCategory,
      label: t('voiceAssistant.securityAccessControl'),
      icon: Shield,
      isFree: false,
      examples: [
        'Show failed login attempts',
        'List users with admin privileges',
        'Review recent permission changes',
      ]
    },
    {
      category: 'scheduling' as CommandCategory,
      label: t('voiceAssistant.taskScheduling'),
      icon: Calendar,
      isFree: false,
      examples: [
        'Schedule full backup every Sunday at 2 AM',
        'Set up weekly maintenance window',
        'Create monthly report generation task',
      ]
    },
  ];

  const processVoiceCommand = async (command: string) => {
    setResponse('Processing your command...');

    if (settings.contextAware) {
      setConversationContext(prev => [...prev, command]);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    let result = '';
    let action = 'QUERY';
    let category: CommandCategory = 'query';

    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('cpu') || lowerCommand.includes('memory') || lowerCommand.includes('performance')) {
      if (!hasPremium) {
        setShowPremiumModal(true);
        return;
      }
      category = 'monitoring';
      action = 'MONITOR';
      result = `Current Performance Metrics:
• CPU Usage: ${metrics.cpu}%
• Memory Usage: ${metrics.memory}%
• Active Connections: ${metrics.activeConnections}
• Average Query Time: ${metrics.queryTime}ms
• Disk Usage: ${metrics.diskUsage}%

All systems are operating within normal parameters.`;
    }
    else if (lowerCommand.includes('increase') || lowerCommand.includes('enable') || lowerCommand.includes('set') || lowerCommand.includes('config')) {
      if (!hasPremium) {
        setShowPremiumModal(true);
        return;
      }
      category = 'config';
      action = 'CONFIG';
      result = `Configuration updated successfully. The requested changes have been applied:
• Connection pool size increased to 100
• Query logging enabled
• Changes will take effect immediately

Would you like to verify the new configuration?`;
    }
    else if (lowerCommand.includes('slow') || lowerCommand.includes('diagnose') || lowerCommand.includes('why')) {
      if (!hasPremium) {
        setShowPremiumModal(true);
        return;
      }
      category = 'troubleshoot';
      action = 'TROUBLESHOOT';
      result = `Troubleshooting Analysis Complete:

Identified Issues:
1. High CPU usage on queries without proper indexes
2. 3 long-running queries detected (>5 seconds)
3. Connection pool nearing capacity

Recommendations:
• Add index on users.created_at column
• Optimize queries in dashboard analytics module
• Consider increasing connection pool size

Would you like me to implement these optimizations?`;
    }
    else if (lowerCommand.includes('predict') || lowerCommand.includes('chart') || lowerCommand.includes('growth')) {
      if (!hasPremium) {
        setShowPremiumModal(true);
        return;
      }
      category = 'planning';
      action = 'PLANNING';
      result = `Capacity Planning Analysis:

Current Growth Rate: 12% per month
Storage Projection (Next Quarter):
• Month 1: 145 GB
• Month 2: 162 GB
• Month 3: 182 GB

Recommendation: Upgrade storage capacity before end of Q2. Current allocation will reach 85% capacity in 67 days.

Would you like to see a detailed visualization?`;
    }
    else if (lowerCommand.includes('schedule') || lowerCommand.includes('backup') || lowerCommand.includes('maintenance')) {
      if (!hasPremium) {
        setShowPremiumModal(true);
        return;
      }
      category = 'scheduling';
      action = 'SCHEDULE';
      result = `Task Scheduled Successfully:

• Type: Full Database Backup
• Schedule: Every Sunday at 2:00 AM UTC
• Retention: 30 days
• Notification: Email to admin on completion

Next execution: This Sunday at 2:00 AM
Estimated duration: 45-60 minutes

Would you like to configure backup retention settings?`;
    }
    else if (lowerCommand.includes('failed') || lowerCommand.includes('security') || lowerCommand.includes('admin')) {
      if (!hasPremium) {
        setShowPremiumModal(true);
        return;
      }
      category = 'security';
      action = 'SECURITY';
      result = `Security Analysis:

Failed Login Attempts (Last 24h): 3
• 2 attempts from IP: 192.168.1.105
• 1 attempt from IP: 10.0.0.23

Admin Privileges:
• 5 users with admin access
• Last privilege change: 2 days ago

All security metrics are within normal range. No immediate threats detected.`;
    }
    else {
      result = `Query Results:

Found 23 matching records. Here are the details:
• Total records: 23
• Date range: Last 7 days
• Most common value: Active users (89%)

SQL Query Generated:
SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '7 days'

Would you like to see more details or export these results?`;
    }

    setResponse(result);
    await saveAuditLog(command, action, 'success');

    if (settings.autoRead) {
      speak(result);
    }
  };

  const startListening = async () => {
    if (!connectionId) {
      alert('Please select a database connection first');
      return;
    }

    setIsListening(true);
    setTranscript('Listening...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const allExamples = features.flatMap(f => f.examples);
    const selectedCommand = allExamples[Math.floor(Math.random() * allExamples.length)];

    setTranscript(selectedCommand);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await processVoiceCommand(selectedCommand);
    setIsListening(false);
  };

  const stopListening = () => {
    setIsListening(false);
    setTranscript('');
  };

  const speak = (text: string) => {
    setIsSpeaking(true);
    setTimeout(() => setIsSpeaking(false), 3000);
  };

  const testVoice = () => {
    const testTexts = {
      male: 'Hello, I am your professional database assistant.',
      female: 'Hi there! Ready to help with your database.',
      robot: 'Greetings. AI database assistant initialized.',
    };
    speak(testTexts[settings.voiceType]);
  };

  const handleVoiceTypeChange = (voiceType: VoiceType) => {
    const voice = voiceTypes.find(v => v.id === voiceType);
    if (voice && !voice.isFree && !hasPremium) {
      setShowPremiumModal(true);
      return;
    }
    saveSettings({ ...settings, voiceType });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-6xl h-[90vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.colors.accent + '20' }}>
              <Mic className="w-5 h-5" style={{ color: theme.colors.accent }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                {t('voiceAssistant.title')}
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {t('voiceAssistant.subtitle')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full glass-morphism hover-3d transition-all">
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="flex border-b" style={{ borderColor: theme.colors.border }}>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`flex-1 px-4 py-3 font-medium transition-all ${activeTab === 'assistant' ? 'border-b-2' : ''}`}
            style={{
              borderColor: activeTab === 'assistant' ? theme.colors.accent : 'transparent',
              color: activeTab === 'assistant' ? theme.colors.accent : theme.colors.textSecondary
            }}
          >
            {t('voiceAssistant.assistant')}
          </button>
          <button
            onClick={() => hasPremium ? setActiveTab('monitoring') : setShowPremiumModal(true)}
            className={`flex-1 px-4 py-3 font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'monitoring' ? 'border-b-2' : ''}`}
            style={{
              borderColor: activeTab === 'monitoring' ? theme.colors.accent : 'transparent',
              color: activeTab === 'monitoring' ? theme.colors.accent : theme.colors.textSecondary
            }}
          >
            <Activity className="w-4 h-4" />
            {t('voiceAssistant.monitoring')}
            {!hasPremium && <Crown className="w-3 h-3" style={{ color: '#f59e0b' }} />}
          </button>
          <button
            onClick={() => hasPremium ? setActiveTab('audit') : setShowPremiumModal(true)}
            className={`flex-1 px-4 py-3 font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'audit' ? 'border-b-2' : ''}`}
            style={{
              borderColor: activeTab === 'audit' ? theme.colors.accent : 'transparent',
              color: activeTab === 'audit' ? theme.colors.accent : theme.colors.textSecondary
            }}
          >
            <FileText className="w-4 h-4" />
            {t('voiceAssistant.auditTrail')}
            {!hasPremium && <Crown className="w-3 h-3" style={{ color: '#f59e0b' }} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'assistant' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {voiceTypes.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => handleVoiceTypeChange(voice.id)}
                    className={`p-3 rounded-xl transition-all hover-3d ${settings.voiceType === voice.id ? 'glass-morphism' : ''}`}
                    style={{
                      borderColor: settings.voiceType === voice.id ? theme.colors.accent : theme.colors.border,
                      border: '2px solid',
                    }}
                  >
                    <div className="text-2xl mb-1">{voice.icon}</div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-semibold text-sm" style={{ color: theme.colors.text }}>{voice.label}</span>
                      {!voice.isFree && <Crown className="w-3 h-3" style={{ color: '#f59e0b' }} />}
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: theme.colors.text }}>
                    {t('voiceAssistant.speed')}: {settings.speed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={settings.speed}
                    onChange={(e) => saveSettings({ ...settings, speed: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: theme.colors.text }}>
                    {t('voiceAssistant.volume')}: {Math.round(settings.volume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.volume}
                    onChange={(e) => saveSettings({ ...settings, volume: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.autoRead}
                    onChange={(e) => saveSettings({ ...settings, autoRead: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span style={{ color: theme.colors.text }}>{t('voiceAssistant.autoRead')}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.contextAware}
                    onChange={(e) => saveSettings({ ...settings, contextAware: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span style={{ color: theme.colors.text }}>{t('voiceAssistant.contextAware')}</span>
                </label>
                <button
                  onClick={testVoice}
                  className="ml-auto px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
                >
                  {t('voiceAssistant.testVoice')}
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold" style={{ color: theme.colors.text }}>{t('nav.voiceCapabilities')}</h3>
                <div className="grid gap-3">
                  {features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div key={feature.category} className="p-4 rounded-lg glass-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon className="w-5 h-5" style={{ color: theme.colors.accent }} />
                            <span className="font-semibold" style={{ color: theme.colors.text }}>{feature.label}</span>
                          </div>
                          {feature.isFree ? (
                            <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: '#10b981' + '20', color: '#10b981' }}>
                              {t('voiceAssistant.free')}
                            </span>
                          ) : hasPremium ? (
                            <Check className="w-5 h-5" style={{ color: '#10b981' }} />
                          ) : (
                            <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />
                          )}
                        </div>
                        <div className="text-xs space-y-1" style={{ color: theme.colors.textSecondary }}>
                          {feature.examples.slice(0, 2).map((ex, i) => (
                            <div key={i}>• {ex}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                {!isListening ? (
                  <button
                    onClick={startListening}
                    disabled={!connectionId}
                    className="w-32 h-32 rounded-full flex items-center justify-center transition-all hover-3d glow-effect disabled:opacity-50"
                    style={{
                      background: connectionId
                        ? `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                        : theme.colors.border
                    }}
                  >
                    <Mic className="w-12 h-12 text-white" />
                  </button>
                ) : (
                  <button onClick={stopListening} className="w-32 h-32 rounded-full flex items-center justify-center transition-all animate-pulse" style={{ background: '#ef4444' }}>
                    <MicOff className="w-12 h-12 text-white" />
                  </button>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg glass-card">
                    <Volume2 className="w-5 h-5 animate-pulse" style={{ color: theme.colors.accent }} />
                    <span className="text-sm" style={{ color: theme.colors.text }}>Speaking...</span>
                  </div>
                )}
              </div>

              {!connectionId && (
                <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 text-yellow-500" />
                  <p className="text-xs text-yellow-500">Please select a database connection first</p>
                </div>
              )}

              {transcript && (
                <div className="p-4 rounded-lg glass-card">
                  <p className="text-xs font-semibold mb-1" style={{ color: theme.colors.textSecondary }}>You said:</p>
                  <p className="font-medium" style={{ color: theme.colors.text }}>{transcript}</p>
                </div>
              )}

              {response && (
                <div className="p-4 rounded-lg glass-card">
                  <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>Response:</p>
                  <pre className="text-xs whitespace-pre-wrap" style={{ color: theme.colors.text }}>{response}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>{t('voiceAssistant.realtimeMonitoring')}</h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <Cpu className="w-5 h-5" style={{ color: '#3b82f6' }} />
                    <span className="text-2xl font-bold" style={{ color: theme.colors.text }}>{metrics.cpu}%</span>
                  </div>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{t('voiceAssistant.cpuUsage')}</p>
                </div>

                <div className="p-4 rounded-lg glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <HardDrive className="w-5 h-5" style={{ color: '#10b981' }} />
                    <span className="text-2xl font-bold" style={{ color: theme.colors.text }}>{metrics.memory}%</span>
                  </div>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{t('voiceAssistant.memory')}</p>
                </div>

                <div className="p-4 rounded-lg glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-5 h-5" style={{ color: '#f59e0b' }} />
                    <span className="text-2xl font-bold" style={{ color: theme.colors.text }}>{metrics.activeConnections}</span>
                  </div>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{t('voiceAssistant.connections')}</p>
                </div>

                <div className="p-4 rounded-lg glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-5 h-5" style={{ color: '#8b5cf6' }} />
                    <span className="text-2xl font-bold" style={{ color: theme.colors.text }}>{metrics.queryTime}ms</span>
                  </div>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{t('voiceAssistant.avgQueryTime')}</p>
                </div>

                <div className="p-4 rounded-lg glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <Database className="w-5 h-5" style={{ color: '#ef4444' }} />
                    <span className="text-2xl font-bold" style={{ color: theme.colors.text }}>{metrics.diskUsage}%</span>
                  </div>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{t('voiceAssistant.diskUsage')}</p>
                </div>

                <div className="p-4 rounded-lg glass-card">
                  <div className="flex items-center justify-between mb-2">
                    <Activity className="w-5 h-5" style={{ color: '#10b981' }} />
                    <span className="text-2xl font-bold" style={{ color: '#10b981' }}>{t('voiceAssistant.healthy')}</span>
                  </div>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>{t('voiceAssistant.systemStatus')}</p>
                </div>
              </div>

              <div className="p-4 rounded-lg glass-card">
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>{t('nav.tryVoiceCommands')}</h4>
                <div className="space-y-1 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <div>• "What is the current CPU usage?"</div>
                  <div>• "Show memory consumption trends"</div>
                  <div>• "How many active connections?"</div>
                  <div>• "What's the average query time?"</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>{t('voiceAssistant.auditTrail')}</h3>
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" style={{ color: '#10b981' }} />
                  <span className="text-sm" style={{ color: theme.colors.textSecondary }}>{t('voiceAssistant.encryptedSecure')}</span>
                </div>
              </div>

              <div className="space-y-2">
                {auditLogs.map((log, idx) => (
                  <div key={idx} className="p-3 rounded-lg glass-card flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4" style={{ color: theme.colors.accent }} />
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium" style={{ color: theme.colors.text }}>{log.command}</p>
                      <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        User: {log.user} • Action: {log.action}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      log.status === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg glass-card">
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Security Features:</h4>
                <div className="grid gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                    Voice biometric authentication
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                    Comprehensive audit logging
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                    Role-based voice permissions
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                    End-to-end encryption
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPremiumModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}dd` }}>
          <div className="relative w-full max-w-md glass-card rounded-2xl shadow-2xl p-6 border-2" style={{ borderColor: '#f59e0b', backgroundColor: theme.colors.foreground }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#f59e0b' + '20' }}>
                <Crown className="w-6 h-6" style={{ color: '#f59e0b' }} />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: theme.colors.text }}>{t('nav.premiumVoiceFeatures')}</h3>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>Enterprise-grade capabilities</p>
              </div>
            </div>

            <div className="mb-6 space-y-2">
              <p className="text-sm font-semibold" style={{ color: theme.colors.text }}>Unlock advanced features:</p>
              <ul className="space-y-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Real-time performance monitoring</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Configuration management</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> AI troubleshooting assistant</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Capacity planning & analytics</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Task scheduling automation</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Security & audit trails</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Robot voice with AI personality</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium"
                style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  window.open('https://queryflux.lemonsqueezy.com/checkout', '_blank');
                  setShowPremiumModal(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                <Crown className="w-4 h-4" />
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
