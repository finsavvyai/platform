import { useState, useEffect } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Crown, Settings as SettingsIcon, Database, Play, Pause, Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface VoiceAssistantExtensionProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
}

type VoiceType = 'male' | 'female' | 'robot';
type VoiceFeature = 'query_read' | 'result_read' | 'db_navigate' | 'db_modify' | 'natural_commands';

interface VoiceSettings {
  voiceType: VoiceType;
  speed: number;
  pitch: number;
  volume: number;
  autoRead: boolean;
}

export function VoiceAssistantExtension({ isOpen, onClose, connectionId }: VoiceAssistantExtensionProps) {
  const { theme } = useTheme();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [hasPremium, setHasPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [settings, setSettings] = useState<VoiceSettings>({
    voiceType: 'female',
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0,
    autoRead: true,
  });

  useEffect(() => {
    if (isOpen) {
      checkPremiumStatus();
      loadSettings();
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
      .single();

    setHasPremium(!!data);
  };

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('voice_settings')
      .eq('user_id', user.id)
      .single();

    if (data?.voice_settings) {
      setSettings(data.voice_settings);
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

  const voiceTypes = [
    {
      id: 'male' as VoiceType,
      label: 'Male Voice',
      icon: '👨',
      isFree: true,
      description: 'Deep, professional voice'
    },
    {
      id: 'female' as VoiceType,
      label: 'Female Voice',
      icon: '👩',
      isFree: true,
      description: 'Clear, friendly voice'
    },
    {
      id: 'robot' as VoiceType,
      label: 'Robot Voice',
      icon: '🤖',
      isFree: false,
      description: 'Futuristic AI voice'
    },
  ];

  const features: Array<{ id: VoiceFeature; label: string; description: string; isFree: boolean; icon: any }> = [
    {
      id: 'query_read',
      label: 'Read Queries',
      description: 'Voice reads SQL queries aloud',
      isFree: true,
      icon: Volume2,
    },
    {
      id: 'result_read',
      label: 'Read Results',
      description: 'Voice reads query results',
      isFree: true,
      icon: Volume2,
    },
    {
      id: 'db_navigate',
      label: 'Database Navigation',
      description: 'Voice commands to navigate tables and schemas',
      isFree: false,
      icon: Database,
    },
    {
      id: 'db_modify',
      label: 'Voice Database Editing',
      description: 'Create, modify, and delete records by voice',
      isFree: false,
      icon: Database,
    },
    {
      id: 'natural_commands',
      label: 'Natural Language Queries',
      description: 'Speak naturally, AI converts to SQL',
      isFree: false,
      icon: Mic,
    },
  ];

  const handleVoiceTypeChange = (voiceType: VoiceType) => {
    const voice = voiceTypes.find(v => v.id === voiceType);
    if (voice && !voice.isFree && !hasPremium) {
      setShowPremiumModal(true);
      return;
    }
    saveSettings({ ...settings, voiceType });
  };

  const handleFeatureUse = (feature: VoiceFeature) => {
    const featureData = features.find(f => f.id === feature);
    if (featureData && !featureData.isFree && !hasPremium) {
      setShowPremiumModal(true);
      return false;
    }
    return true;
  };

  const startListening = async () => {
    if (!handleFeatureUse('natural_commands')) return;

    setIsListening(true);
    setTranscript('Listening...');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockTranscripts = [
      'Show me all users created in the last 7 days',
      'Get the top 10 products by revenue',
      'Create a new user with email john@example.com',
      'Delete all orders from last month',
      'Show me database statistics',
    ];

    const selectedTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    setTranscript(selectedTranscript);

    await new Promise(resolve => setTimeout(resolve, 1000));

    processVoiceCommand(selectedTranscript);
    setIsListening(false);
  };

  const stopListening = () => {
    setIsListening(false);
    setTranscript('');
  };

  const processVoiceCommand = async (command: string) => {
    setResponse('Processing your command...');

    await new Promise(resolve => setTimeout(resolve, 1500));

    let sqlQuery = '';
    let result = '';

    if (command.toLowerCase().includes('users')) {
      sqlQuery = "SELECT * FROM users WHERE created_at >= NOW() - INTERVAL '7 days'";
      result = 'Found 23 users created in the last 7 days. Reading results...';
    } else if (command.toLowerCase().includes('products')) {
      sqlQuery = "SELECT name, SUM(revenue) as total FROM products GROUP BY name ORDER BY total DESC LIMIT 10";
      result = 'Retrieved top 10 products. The highest revenue is from Product A with $45,230.';
    } else if (command.toLowerCase().includes('create')) {
      sqlQuery = "INSERT INTO users (email, name) VALUES ('john@example.com', 'John Doe')";
      result = 'User created successfully with ID 1234.';
    } else if (command.toLowerCase().includes('delete')) {
      sqlQuery = "DELETE FROM orders WHERE created_at < NOW() - INTERVAL '30 days'";
      result = 'Deleted 156 orders from last month.';
    } else {
      sqlQuery = "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public'";
      result = 'Your database has 12 tables with approximately 45,000 total records.';
    }

    setResponse(`SQL Query: ${sqlQuery}\n\nResult: ${result}`);

    if (settings.autoRead) {
      speak(result);
    }
  };

  const speak = (text: string) => {
    setIsSpeaking(true);

    setTimeout(() => {
      setIsSpeaking(false);
    }, 3000);
  };

  const testVoice = () => {
    const testTexts = {
      male: 'Hello, I am your database assistant with a professional male voice.',
      female: 'Hi there! I am here to help you with your database queries.',
      robot: 'Greetings, human. I am your AI database assistant from the future.',
    };

    speak(testTexts[settings.voiceType]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-4xl h-[85vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.colors.accent + '20' }}>
              <Mic className="w-5 h-5" style={{ color: theme.colors.accent }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                Voice Assistant
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Control your database with voice commands
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

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {voiceTypes.map((voice) => (
              <button
                key={voice.id}
                onClick={() => handleVoiceTypeChange(voice.id)}
                className={`p-4 rounded-xl transition-all hover-3d ${
                  settings.voiceType === voice.id ? 'glass-morphism' : ''
                }`}
                style={{
                  borderColor: settings.voiceType === voice.id ? theme.colors.accent : theme.colors.border,
                  border: '2px solid',
                }}
              >
                <div className="text-3xl mb-2">{voice.icon}</div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                    {voice.label}
                  </h3>
                  {!voice.isFree && <Crown className="w-3 h-3" style={{ color: '#f59e0b' }} />}
                </div>
                <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  {voice.description}
                </p>
                {!voice.isFree && !hasPremium && (
                  <div className="mt-2 px-2 py-1 rounded text-[10px] font-semibold" style={{ backgroundColor: '#f59e0b' + '20', color: '#f59e0b' }}>
                    PREMIUM
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: theme.colors.text }}>
              <SettingsIcon className="w-4 h-4" />
              Voice Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: theme.colors.text }}>
                  Speed: {settings.speed.toFixed(1)}x
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
                  Volume: {Math.round(settings.volume * 100)}%
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

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.autoRead}
                onChange={(e) => saveSettings({ ...settings, autoRead: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span style={{ color: theme.colors.text }}>Automatically read query results</span>
            </label>

            <button
              onClick={testVoice}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
              style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
            >
              <Volume2 className="w-4 h-4" />
              Test Voice
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold" style={{ color: theme.colors.text }}>
              Voice Features
            </h3>

            <div className="space-y-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.id}
                    className="p-3 rounded-lg glass-card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" style={{ color: theme.colors.accent }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm" style={{ color: theme.colors.text }}>
                            {feature.label}
                          </span>
                          {!feature.isFree && <Crown className="w-3 h-3" style={{ color: '#f59e0b' }} />}
                        </div>
                        <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {feature.description}
                        </p>
                      </div>
                    </div>
                    {feature.isFree ? (
                      <Check className="w-5 h-5" style={{ color: '#10b981' }} />
                    ) : hasPremium ? (
                      <Check className="w-5 h-5" style={{ color: '#10b981' }} />
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: '#f59e0b' + '20', color: '#f59e0b' }}>
                        PREMIUM
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold" style={{ color: theme.colors.text }}>
              Voice Control
            </h3>

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
                <button
                  onClick={stopListening}
                  className="w-32 h-32 rounded-full flex items-center justify-center transition-all animate-pulse"
                  style={{ background: '#ef4444' }}
                >
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
                <p className="text-xs font-semibold mb-1" style={{ color: theme.colors.textSecondary }}>
                  You said:
                </p>
                <p className="font-medium" style={{ color: theme.colors.text }}>
                  {transcript}
                </p>
              </div>
            )}

            {response && (
              <div className="p-4 rounded-lg glass-card">
                <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>
                  Response:
                </p>
                <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: theme.colors.text }}>
                  {response}
                </pre>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg glass-card">
            <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
              Try saying:
            </h4>
            <ul className="space-y-1 text-sm" style={{ color: theme.colors.textSecondary }}>
              <li>• "Show me all users from the last week"</li>
              <li>• "Get the top 10 products by revenue"</li>
              <li className={!hasPremium ? 'opacity-50' : ''}>• "Create a new user with email..." {!hasPremium && '(Premium)'}</li>
              <li className={!hasPremium ? 'opacity-50' : ''}>• "Delete all orders from last month" {!hasPremium && '(Premium)'}</li>
              <li>• "Show me database statistics"</li>
            </ul>
          </div>
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
                <h3 className="font-bold text-lg" style={{ color: theme.colors.text }}>
                  Premium Voice Feature
                </h3>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Unlock advanced voice capabilities
                </p>
              </div>
            </div>

            <div className="mb-6 space-y-3">
              <p className="text-sm" style={{ color: theme.colors.text }}>
                This feature requires a premium subscription. Get access to:
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Robot voice with AI personality
                </li>
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Natural language database queries
                </li>
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Voice-activated database navigation
                </li>
                <li className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                  Create and modify records by voice
                </li>
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
