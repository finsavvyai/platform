import { useState, useEffect, useCallback } from 'react';
import { Check, X, ExternalLink, RefreshCw, Palette, Globe, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/atoms';

interface JiraStatus {
  connected: boolean;
  jiraUrl?: string;
  connectedAt?: number;
}

export default function Settings() {
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraUrl, setJiraUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const { currentTheme, changeTheme, availableThemes } = useTheme();

  const isRecoverableJiraError = (message: string) =>
    message.includes('Not Found') ||
    message.includes('API Error: 404') ||
    message.includes('Connection failed');

  const checkJiraConnection = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStatusNotice(null);
      const data = await api.getJiraConnectionStatus() as JiraStatus;
      setJiraConnected(Boolean(data.connected));
      setJiraUrl(data.jiraUrl || '');
    } catch (connectionError) {
      console.warn('Jira connection status is unavailable:', connectionError);
      setJiraConnected(false);
      setJiraUrl('');
      const message = connectionError instanceof Error ? connectionError.message : 'Unable to load Jira status.';
      if (isRecoverableJiraError(message)) {
        setError(null);
        setStatusNotice('Jira is not configured in this environment yet. The released workflow still works without a live Jira connection.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkJiraConnection();
  }, [checkJiraConnection]);

  const connectJira = async () => {
    try {
      setConnecting(true);
      setError(null);
      setStatusNotice(null);
      const data = await api.getJiraAuthURL() as { url?: string };

      if (!data.url) {
        setStatusNotice('Jira OAuth is not configured for this environment yet.');
        return;
      }

      window.location.href = data.url;
    } catch (connectionError) {
      const message = connectionError instanceof Error ? connectionError.message : 'Unable to start Jira OAuth.';
      if (isRecoverableJiraError(message)) {
        setStatusNotice('Jira OAuth is not configured for this environment yet.');
      } else {
        console.error('Error connecting to Jira:', connectionError);
        setError(message);
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnectJira = async () => {
    if (!confirm('Disconnect Jira for this workspace? Existing imported data will stay in Qestro.')) {
      return;
    }

    try {
      setError(null);
      setStatusNotice(null);
      await api.disconnectJira();
      setJiraConnected(false);
      setJiraUrl('');
    } catch (disconnectError) {
      const message = disconnectError instanceof Error ? disconnectError.message : 'Unable to disconnect Jira.';
      if (isRecoverableJiraError(message)) {
        setJiraConnected(false);
        setJiraUrl('');
        setStatusNotice('There is no live Jira connection configured for this environment.');
      } else {
        console.error('Error disconnecting Jira:', disconnectError);
        setError(message);
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="py-6">
      <motion.div
        className="mx-auto max-w-5xl space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Settings</h1>
          <p className="text-text-muted">Workspace basics, Jira connection status, and appearance.</p>
        </div>

        {error && (
          <motion.div variants={itemVariants} className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {statusNotice && (
          <motion.div variants={itemVariants} className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            <Globe className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{statusNotice}</span>
          </motion.div>
        )}

        <motion.div variants={itemVariants} className="rounded-xl border border-border bg-bg-secondary/50 p-8 backdrop-blur-md transition-all duration-300 hover:border-primary/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#0052CC]/20 bg-[#0052CC]/10">
              <svg className="h-6 w-6 text-[#0052CC]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.757a1 1 0 0 0-1-1zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1a1 1 0 0 0-.987-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Jira Integration</h2>
              <p className="text-sm text-text-muted">Real connection status only. No demo or local fallback state is shown here.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-black/20 py-12">
              <RefreshCw className="mb-4 h-8 w-8 animate-spin text-primary" />
              <p className="font-medium text-text-muted">Checking Jira connection status...</p>
            </div>
          ) : jiraConnected ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-emerald-400">Connected to Jira</p>
                  <p className="mt-0.5 text-sm text-emerald-500/80">{jiraUrl || 'Connection active'}</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-black/20 p-5">
                  <div className="text-sm font-medium text-text-primary">Ready for the released workflow</div>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Imported issues can now be linked from Test Cases without falling back to placeholder links.
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-5">
                  <div className="text-sm font-medium text-text-primary">Next product surface</div>
                  <p className="mt-2 text-sm leading-6 text-text-muted">
                    Recording artifacts and run outcomes can be attached to the imported Jira work once those pages are populated.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={disconnectJira}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  leftIcon={<X className="h-4 w-4" />}
                >
                  Disconnect
                </Button>
                <Button onClick={() => void checkJiraConnection()} variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" />}>
                  Refresh status
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                  <X className="h-5 w-5 text-text-muted" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-text-primary">Not connected</p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    Jira must be connected before Qestro can attach real issue metadata to the released test-case workflow.
                  </p>
                </div>
              </div>

              <Button
                onClick={connectJira}
                disabled={connecting}
                variant="primary"
                glow
                className="w-full sm:w-auto"
                leftIcon={<ExternalLink className="h-4 w-4" />}
              >
                {connecting ? 'Opening Jira OAuth...' : 'Connect Jira'}
              </Button>
            </div>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-border bg-bg-secondary/50 p-8 backdrop-blur-md transition-all duration-300 hover:border-primary/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
              <Globe className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Notification Toggles</h2>
              <p className="text-sm text-text-muted">Choose which workflow signals Qestro should send to your team.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Run failures', 'Alert when a test run fails or becomes flaky.'],
              ['AI recommendations', 'Send summaries when the AI engine finds coverage gaps.'],
              ['Jira sync', 'Notify when imported issues gain generated test evidence.'],
              ['Weekly digest', 'Send product and quality trends at the end of each week.'],
            ].map(([label, description], index) => (
              <label key={label} className="flex items-start gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                  defaultChecked={index < 3}
                  style={{ accentColor: '#22d3ee' }}
                />
                <span>
                  <span className="block text-sm font-semibold text-text-primary">{label}</span>
                  <span className="mt-1 block text-sm leading-6 text-text-muted">{description}</span>
                </span>
              </label>
            ))}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-border bg-bg-secondary/50 p-8 backdrop-blur-md transition-all duration-300 hover:border-primary/30">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-pink-500/20 bg-pink-500/10">
              <Palette className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Appearance</h2>
              <p className="text-sm text-text-muted">Theme selection is a real client-side preference and stays available in the phased release.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            {availableThemes.map((themeOption) => {
              const isActive = currentTheme.id === themeOption.id;
              const previewGradient = `linear-gradient(135deg, ${themeOption.colors.bgSecondary} 0%, ${themeOption.colors.bgTertiary} 100%)`;

              return (
                <button
                  key={themeOption.id}
                  onClick={() => changeTheme(themeOption.id)}
                  className={`group relative rounded-xl border p-3 text-left transition-all duration-300 ${isActive
                    ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'
                    }`}
                >
                  <div
                    className="relative mb-3 aspect-video overflow-hidden rounded-lg border border-white/10 shadow-inner transition-transform duration-300 group-hover:scale-[1.02]"
                    style={{ background: previewGradient }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-50" />
                    <div className="absolute left-2 right-2 top-2 h-2 rounded-full bg-white/20 backdrop-blur-sm" />
                    <div className="absolute left-2 top-6 h-1.5 w-1/3 rounded-full bg-white/10 backdrop-blur-sm" />
                    <div
                      className="absolute bottom-2 right-2 h-3 w-3 rounded-full ring-2 ring-black/20"
                      style={{ backgroundColor: themeOption.colors.brandPrimary }}
                    />
                  </div>

                  <div className={`mb-0.5 text-sm font-semibold transition-colors ${isActive ? 'text-primary' : 'text-text-primary group-hover:text-white'}`}>
                    {themeOption.name}
                  </div>

                  {isActive && (
                    <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-bg-secondary/50 p-8 backdrop-blur-md transition-all duration-300 hover:border-primary/30">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10">
                <Globe className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary">General</h2>
                <p className="text-sm text-text-muted">Workspace configuration that is safe to expose in the Phase 1 release.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">Workspace name</label>
                <input
                  type="text"
                  defaultValue="Qestro"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-text-primary placeholder:text-text-muted/50 transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-secondary">Default environment</label>
                <select className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-text-primary transition-all focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50">
                  <option value="dev">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-secondary/50 p-8 backdrop-blur-md transition-all duration-300 hover:border-primary/30">
            <h2 className="text-xl font-semibold text-text-primary">Release policy</h2>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              Non-core surfaces are hidden until they have a working backend contract, no production fallback data, and a clean happy path.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-text-muted">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-400" /> Dashboard now depends on real API responses.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-400" /> Jira no longer simulates connection state in local storage.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-emerald-400" /> Hidden routes resolve to an explicit release gate page instead of a broken shell.</li>
            </ul>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
