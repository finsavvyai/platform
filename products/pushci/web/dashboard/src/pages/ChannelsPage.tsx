import { useState, useEffect } from 'react';
import { api } from '../hooks/useApi';
import type { ChannelConnectionSummary } from '../hooks/useApi';
import ConnectChannelModal from '../components/ConnectChannelModal';
import PageHeader from '../components/PageHeader';
import IntegrationIcon from '../components/IntegrationIcon';
import { useToast } from '../components/Toast';
import TestChannelButton from '../components/TestChannelButton';

const INTEGRATIONS = [
  { type: 'slack', name: 'Slack', desc: 'Get pipeline alerts in your Slack channels. React to fix.', icon: 'SL', color: 'from-purple-600 to-purple-800', category: 'messaging' },
  { type: 'discord', name: 'Discord', desc: 'CI status in your Discord server. Bot commands included.', icon: 'DC', color: 'from-indigo-500 to-indigo-700', category: 'messaging' },
  { type: 'email', name: 'Email', desc: 'Styled HTML email alerts on every run. Powered by Resend.', icon: '@', color: 'from-emerald-500 to-emerald-700', category: 'messaging' },
  { type: 'telegram', name: 'Telegram', desc: 'Instant pipeline notifications via Telegram bot.', icon: 'TG', color: 'from-blue-500 to-blue-700', category: 'messaging' },
  { type: 'whatsapp', name: 'WhatsApp', desc: 'Business API alerts. Talk to your CI from WhatsApp.', icon: 'WA', color: 'from-green-500 to-green-700', category: 'messaging' },
  { type: 'webhook', name: 'Custom Webhook', desc: 'Send run events to any URL. Build your own integration.', icon: '{>', color: 'from-zinc-500 to-zinc-700', category: 'developer' },
];

type Filter = 'all' | 'messaging' | 'developer' | 'connected';

export default function ChannelsPage() {
  const [connections, setConnections] = useState<ChannelConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [preselect, setPreselect] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setConnections((await api.getChannels()).connections); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const { toast, confirm: toastConfirm } = useToast();
  const connected = new Set<string>(connections.map(c => c.channel_type));
  const disconnect = async (id: string) => {
    const ok = await toastConfirm('Disconnect Channel', 'Are you sure you want to disconnect this channel?');
    if (!ok) return;
    try {
      await api.disconnectChannel(id);
      toast({ type: 'success', title: 'Channel disconnected' });
      load();
    } catch {
      toast({ type: 'error', title: 'Failed to disconnect channel' });
    }
  };

  const filtered = INTEGRATIONS.filter(i => {
    if (filter === 'connected') return connected.has(i.type);
    if (filter === 'all') return true;
    return i.category === filter;
  });

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect your favorite tools. Get notified everywhere."
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'messaging', 'developer', 'connected'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface-card border border-surface-border text-zinc-400 hover:text-zinc-200'
            }`}>
            {f === 'all' ? 'All' : f === 'connected' ? `Connected (${connections.length})` : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-xl shimmer" />)}
        </div>
      ) : (
        <>
          {/* Integration cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
            {filtered.map(integration => {
              const isConnected = connected.has(integration.type);
              const conn = connections.find(c => c.channel_type === integration.type);
              return (
                <div key={integration.type}
                  className="group relative rounded-xl border border-surface-border bg-surface-card overflow-hidden card-hover">
                  {/* Gradient header */}
                  <div className={`h-20 bg-gradient-to-br ${integration.color} flex items-center justify-between px-5 relative overflow-hidden`}>
                    <IntegrationIcon type={integration.type} size={36} />
                    {isConnected && (
                      <span className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] text-white font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 glow-dot" />
                        Connected
                      </span>
                    )}
                    {/* Decorative circles */}
                    <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/5" />
                    <div className="absolute -right-2 -bottom-6 w-14 h-14 rounded-full bg-white/5" />
                  </div>

                  <div className="p-5">
                    <h3 className="text-sm font-semibold text-zinc-100">{integration.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{integration.desc}</p>

                    {isConnected && conn ? (
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-xs text-zinc-500">
                          <span className="text-zinc-400">{conn.message_count}</span> messages
                        </div>
                        <div className="flex items-center gap-2">
                          <TestChannelButton channelId={conn.id} />
                          <button onClick={() => disconnect(conn.id)}
                            className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                            Disconnect
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setPreselect(integration.type); setShowModal(true); }}
                        className="mt-4 w-full rounded-lg border border-surface-border bg-surface-hover/50 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-accent/10 hover:border-accent/30 hover:text-accent transition-all">
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Connected channels detail */}
          {connections.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Active Connections</h2>
              <div className="space-y-2 stagger">
                {connections.map(ch => (
                  <div key={ch.id} className="flex items-center gap-4 p-3 bg-surface-card/50 border border-surface-border rounded-lg">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${INTEGRATIONS.find(i => i.type === ch.channel_type)?.color ?? 'from-zinc-600 to-zinc-800'} flex items-center justify-center p-1.5`}>
                      <IntegrationIcon type={ch.channel_type} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-200">{ch.label || ch.external_name || ch.channel_type}</span>
                      <div className="flex gap-3 text-xs text-zinc-500 mt-0.5">
                        <span>{ch.message_count} msgs</span>
                        {ch.last_message_at && <span>Last: {new Date(ch.last_message_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <TestChannelButton channelId={ch.id} />
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">{ch.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <ConnectChannelModal
          preselect={preselect || undefined}
          onClose={() => { setShowModal(false); setPreselect(null); }}
          onConnected={() => { setShowModal(false); setPreselect(null); load(); }}
        />
      )}
    </div>
  );
}
