import { useState } from 'react';
import { api } from '../hooks/useApi';
import { friendlyError } from '../utils/errorMessages';

interface Props {
  onClose: () => void;
  onConnected: () => void;
  preselect?: string;
}

interface ChannelDef {
  type: string; name: string; icon: string; color: string;
  fields: Array<{ key: string; label: string }>;
  guide: string;
}

const CHANNELS: ChannelDef[] = [
  { type: 'whatsapp', name: 'WhatsApp', icon: 'WA', color: 'bg-green-600',
    fields: [{ key: 'accessToken', label: 'Access Token' }, { key: 'phoneNumberId', label: 'Phone Number ID' }],
    guide: '1. Go to developers.facebook.com > My Apps\n2. Create a Business app > Add WhatsApp product\n3. In WhatsApp > API Setup, copy the Temporary Access Token\n4. Copy the Phone Number ID from the same page\n5. In Webhooks, set the callback URL to the webhook URL PushCI gives you',
  },
  { type: 'slack', name: 'Slack', icon: 'SL', color: 'bg-purple-600',
    fields: [{ key: 'accessToken', label: 'Bot Token (xoxb-...)' }, { key: 'teamId', label: 'Team ID (T...)' }],
    guide: '1. Go to api.slack.com/apps > Create New App\n2. Choose "From scratch", name it "PushCI", select workspace\n3. Go to OAuth & Permissions > Add scopes: chat:write, channels:read\n4. Install to Workspace > Copy the Bot User OAuth Token (xoxb-...)\n5. Team ID is in your Slack URL: yourteam.slack.com or in Workspace Settings',
  },
  { type: 'discord', name: 'Discord', icon: 'DC', color: 'bg-indigo-600',
    fields: [{ key: 'accessToken', label: 'Bot Token' }, { key: 'guildId', label: 'Server ID' }],
    guide: '1. Go to discord.com/developers/applications > New Application\n2. Go to Bot > Add Bot > Copy the Token\n3. In OAuth2 > URL Generator, select bot scope + Send Messages permission\n4. Use the generated URL to invite bot to your server\n5. Right-click your server name > Copy Server ID (enable Developer Mode in Settings first)',
  },
  { type: 'telegram', name: 'Telegram', icon: 'TG', color: 'bg-blue-500',
    fields: [{ key: 'accessToken', label: 'Bot Token' }, { key: 'botUsername', label: 'Bot Username' }],
    guide: '1. Open Telegram, search @BotFather\n2. Send /newbot, choose a name and username\n3. BotFather gives you an HTTP API token — copy it\n4. The bot username is what you chose (without @)',
  },
  { type: 'webhook', name: 'Webhook', icon: 'WH', color: 'bg-zinc-600',
    fields: [{ key: 'callbackUrl', label: 'Callback URL' }],
    guide: 'Enter the URL where PushCI should POST run events. The payload includes: status, repo, branch, sha, duration, checks.',
  },
  { type: 'email', name: 'Email', icon: '@', color: 'bg-emerald-600',
    fields: [{ key: 'to', label: 'Recipient Email' }, { key: 'from', label: 'From (optional)' }],
    guide: 'Enter the email address for build notifications. PushCI sends styled HTML emails via Resend on every pipeline run.',
  },
];

export default function ConnectChannelModal({ onClose, onConnected, preselect }: Props) {
  const preselected = preselect ? CHANNELS.find(c => c.type === preselect) : null;
  const [step, setStep] = useState<'pick' | 'config' | 'done'>(preselected ? 'config' : 'pick');
  const [selected, setSelected] = useState(preselected || CHANNELS[0]);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [result, setResult] = useState<{ webhookUrl: string; nextSteps: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.connectChannel({ channelType: selected.type, label: label || undefined, credentials: creds });
      setResult({ webhookUrl: res.webhookUrl, nextSteps: res.nextSteps });
      setStep('done');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        {step === 'pick' && (
          <>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">Connect a Channel</h2>
            <div className="space-y-2">
              {CHANNELS.map((ch) => (
                <button key={ch.type}
                  onClick={() => { setSelected(ch); setStep('config'); setShowGuide(true); }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors text-left">
                  <div className={`w-9 h-9 rounded-lg ${ch.color} flex items-center justify-center text-xs font-bold text-white`}>{ch.icon}</div>
                  <span className="text-sm font-medium text-zinc-200">{ch.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'config' && (
          <>
            <h2 className="text-lg font-semibold text-zinc-100 mb-1">Connect {selected.name}</h2>

            {/* Setup guide */}
            {showGuide && selected.guide && (
              <div className="mb-4 rounded-lg border border-blue-800/30 bg-blue-950/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-400">Setup Guide</span>
                  <button onClick={() => setShowGuide(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Hide</button>
                </div>
                <div className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{selected.guide}</div>
              </div>
            )}
            {!showGuide && (
              <button onClick={() => setShowGuide(true)} className="text-xs text-blue-400 hover:text-blue-300 mb-3 block">Show setup guide</button>
            )}

            {error && <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">{error}</div>}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Label (optional)</label>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My workspace"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-emerald-500" />
              </div>
              {selected.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-zinc-400 mb-1 block">{f.label}</label>
                  <input value={creds[f.key] ?? ''} onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                    type={f.key.toLowerCase().includes('token') ? 'password' : 'text'}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-emerald-500" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setStep('pick'); setShowGuide(true); }} className="flex-1 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Back</button>
              <button onClick={submit} disabled={saving}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <>
            <h2 className="text-lg font-semibold text-emerald-400 mb-3">Connected!</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Webhook URL</label>
                <code className="block p-2 bg-zinc-900 rounded text-xs text-zinc-300 break-all">{result.webhookUrl}</code>
              </div>
              <div>
                <label className="text-xs text-zinc-500 block mb-1">Next Steps</label>
                <p className="text-xs text-zinc-400">{result.nextSteps}</p>
              </div>
            </div>
            <button onClick={onConnected}
              className="w-full mt-5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors">
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
