import { useState, useEffect } from 'react';
import { X, Bell, Clock, Activity, AlertTriangle, CheckCircle, XCircle, Mail, MessageSquare, Zap, Webhook, Phone, Send, Plus, Trash2, Settings, Play, Pause, Eye, Calendar, TrendingUp, Database, CreditCard as Edit } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface MonitoringDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
}

interface Monitor {
  id: string;
  name: string;
  monitor_type: string;
  is_active: boolean;
  last_status: string;
  last_checked_at: string;
  check_interval: number;
}

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: string;
  is_active: boolean;
  config: any;
}

interface Alert {
  id: string;
  monitor_id: string;
  severity: string;
  message: string;
  is_acknowledged: boolean;
  created_at: string;
}

interface ScheduledQuery {
  id: string;
  name: string;
  schedule_cron: string;
  is_active: boolean;
  last_run_at: string;
  next_run_at: string;
  last_status: string;
}

type TabType = 'monitors' | 'alerts' | 'channels' | 'scheduled';

const channelIcons: Record<string, any> = {
  email: Mail,
  slack: MessageSquare,
  teams: MessageSquare,
  discord: MessageSquare,
  webhook: Webhook,
  sms: Phone,
  telegram: Send,
  pagerduty: Bell
};

export function MonitoringDashboard({ isOpen, onClose, connectionId }: MonitoringDashboardProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<TabType>('monitors');
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [scheduledQueries, setScheduledQueries] = useState<ScheduledQuery[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Monitor Modal State
  const [showCreateMonitor, setShowCreateMonitor] = useState(false);
  const [newMonitor, setNewMonitor] = useState({
    name: '',
    monitor_type: 'query',
    query: '',
    check_interval: 5,
    threshold_value: ''
  });

  // Create Channel Modal State
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: '',
    channel_type: 'email',
    config: {} as any
  });

  // Create Scheduled Query Modal State
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    query: '',
    schedule_cron: '0 9 * * *',
    output_format: 'json'
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (activeTab === 'monitors') {
        const { data } = await supabase
          .from('monitors')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (data) setMonitors(data);
      } else if (activeTab === 'channels') {
        const { data } = await supabase
          .from('notification_channels')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (data) setChannels(data);
      } else if (activeTab === 'alerts') {
        const { data } = await supabase
          .from('alert_history')
          .select('*, monitors(name)')
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) setAlerts(data);
      } else if (activeTab === 'scheduled') {
        const { data } = await supabase
          .from('scheduled_queries')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (data) setScheduledQueries(data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createMonitor = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('monitors')
      .insert({
        user_id: user.id,
        connection_id: connectionId,
        ...newMonitor
      });

    if (!error) {
      setShowCreateMonitor(false);
      setNewMonitor({ name: '', monitor_type: 'query', query: '', check_interval: 5, threshold_value: '' });
      loadData();
    }
  };

  const createChannel = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('notification_channels')
      .insert({
        user_id: user.id,
        ...newChannel
      });

    if (!error) {
      setShowCreateChannel(false);
      setNewChannel({ name: '', channel_type: 'email', config: {} });
      loadData();
    }
  };

  const createScheduledQuery = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('scheduled_queries')
      .insert({
        user_id: user.id,
        connection_id: connectionId,
        ...newSchedule
      });

    if (!error) {
      setShowCreateSchedule(false);
      setNewSchedule({ name: '', query: '', schedule_cron: '0 9 * * *', output_format: 'json' });
      loadData();
    }
  };

  const toggleMonitor = async (id: string, isActive: boolean) => {
    await supabase
      .from('monitors')
      .update({ is_active: !isActive })
      .eq('id', id);
    loadData();
  };

  const deleteMonitor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    await supabase.from('monitors').delete().eq('id', id);
    loadData();
  };

  const deleteChannel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    await supabase.from('notification_channels').delete().eq('id', id);
    loadData();
  };

  const acknowledgeAlert = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('alert_history')
      .update({
        is_acknowledged: true,
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', id);
    loadData();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'error': return '#f97316';
      case 'warning': return '#eab308';
      case 'info': return '#3b82f6';
      default: return theme.colors.textSecondary;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-7xl h-[90vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                {t('monitoring.title')}
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {t('monitoring.subtitle')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full glass-morphism hover-3d transition-all">
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 py-4 border-b overflow-x-auto" style={{ borderColor: theme.colors.border }}>
          {[
            { id: 'monitors', icon: Activity, label: t('monitoring.monitors'), count: monitors.length },
            { id: 'alerts', icon: Bell, label: t('monitoring.alerts'), count: alerts.filter(a => !a.is_acknowledged).length },
            { id: 'channels', icon: Send, label: t('monitoring.channels'), count: channels.length },
            { id: 'scheduled', icon: Clock, label: 'Scheduled', count: scheduledQueries.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isActive ? 'glass-morphism' : 'hover:bg-white/5'
                }`}
                style={{
                  color: isActive ? theme.colors.accent : theme.colors.textSecondary
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium whitespace-nowrap">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    backgroundColor: isActive ? `${theme.colors.accent}40` : `${theme.colors.textSecondary}20`,
                    color: isActive ? theme.colors.accent : theme.colors.textSecondary
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Monitors Tab */}
          {activeTab === 'monitors' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                    {t('monitoring.databaseMonitors')}
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Track queries, performance, and database health
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateMonitor(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  <Plus className="w-4 h-4" />
                  {t('monitoring.createMonitor')}
                </button>
              </div>

              <div className="grid gap-4">
                {monitors.map((monitor) => (
                  <div
                    key={monitor.id}
                    className="p-4 rounded-xl glass-card"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                            {monitor.name}
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            monitor.last_status === 'healthy' ? 'bg-green-500/20 text-green-500' :
                            monitor.last_status === 'warning' ? 'bg-yellow-500/20 text-yellow-500' :
                            monitor.last_status === 'critical' ? 'bg-red-500/20 text-red-500' :
                            'bg-gray-500/20 text-gray-500'
                          }`}>
                            {monitor.last_status || 'Unknown'}
                          </span>
                          <span className="text-xs px-2 py-1 rounded" style={{
                            backgroundColor: `${theme.colors.accent}20`,
                            color: theme.colors.accent
                          }}>
                            {monitor.monitor_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Every {monitor.check_interval} min
                          </span>
                          {monitor.last_checked_at && (
                            <span>Last checked: {new Date(monitor.last_checked_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleMonitor(monitor.id, monitor.is_active)}
                          className="p-2 rounded-lg glass-morphism"
                          title={monitor.is_active ? 'Pause' : 'Resume'}
                        >
                          {monitor.is_active ? (
                            <Pause className="w-4 h-4" style={{ color: theme.colors.text }} />
                          ) : (
                            <Play className="w-4 h-4" style={{ color: theme.colors.text }} />
                          )}
                        </button>
                        <button
                          className="p-2 rounded-lg glass-morphism"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" style={{ color: theme.colors.text }} />
                        </button>
                        <button
                          onClick={() => deleteMonitor(monitor.id)}
                          className="p-2 rounded-lg glass-morphism"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {monitors.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
                    <p className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                      No monitors yet
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      Create your first monitor to start tracking your database
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                  Alert History
                </h3>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Recent alerts and notifications
                </p>
              </div>

              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl glass-card ${alert.is_acknowledged ? 'opacity-60' : ''}`}
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${getSeverityColor(alert.severity)}20` }}
                      >
                        <AlertTriangle className="w-5 h-5" style={{ color: getSeverityColor(alert.severity) }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-1 rounded font-medium" style={{
                            backgroundColor: `${getSeverityColor(alert.severity)}20`,
                            color: getSeverityColor(alert.severity)
                          }}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            {new Date(alert.created_at).toLocaleString()}
                          </span>
                          {alert.is_acknowledged && (
                            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-500">
                              Acknowledged
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium mb-1" style={{ color: theme.colors.text }}>
                          {alert.message}
                        </p>
                      </div>
                      {!alert.is_acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold glass-morphism"
                          style={{ color: theme.colors.text }}
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {alerts.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#10b981' }} />
                    <p className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                      All clear!
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      No alerts at this time
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                    {t('monitoring.notificationChannels')}
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Configure where to send alerts
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateChannel(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  <Plus className="w-4 h-4" />
                  Add Channel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channels.map((channel) => {
                  const Icon = channelIcons[channel.channel_type] || Send;
                  return (
                    <div
                      key={channel.id}
                      className="p-4 rounded-xl glass-card"
                      style={{ backgroundColor: theme.colors.background }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${theme.colors.accent}20` }}
                          >
                            <Icon className="w-5 h-5" style={{ color: theme.colors.accent }} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                              {channel.name}
                            </h4>
                            <p className="text-xs capitalize" style={{ color: theme.colors.textSecondary }}>
                              {channel.channel_type}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteChannel(channel.id)}
                          className="p-1.5 rounded-lg glass-morphism"
                        >
                          <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded inline-block ${
                        channel.is_active ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                      }`}>
                        {channel.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  );
                })}

                {channels.length === 0 && !loading && (
                  <div className="col-span-full text-center py-12">
                    <Send className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
                    <p className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                      No channels configured
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      Add notification channels to receive alerts
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scheduled Queries Tab */}
          {activeTab === 'scheduled' && (
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                    Scheduled Queries
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Run queries automatically on a schedule
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateSchedule(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  <Plus className="w-4 h-4" />
                  Schedule Query
                </button>
              </div>

              <div className="grid gap-4">
                {scheduledQueries.map((query) => (
                  <div
                    key={query.id}
                    className="p-4 rounded-xl glass-card"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold" style={{ color: theme.colors.text }}>
                            {query.name}
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded ${
                            query.last_status === 'success' ? 'bg-green-500/20 text-green-500' :
                            query.last_status === 'failed' ? 'bg-red-500/20 text-red-500' :
                            'bg-gray-500/20 text-gray-500'
                          }`}>
                            {query.last_status || 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {query.schedule_cron}
                          </span>
                          {query.next_run_at && (
                            <span>Next: {new Date(query.next_run_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 rounded-lg glass-morphism" title="View History">
                          <Eye className="w-4 h-4" style={{ color: theme.colors.text }} />
                        </button>
                        <button className="p-2 rounded-lg glass-morphism" title="Edit">
                          <Edit className="w-4 h-4" style={{ color: theme.colors.text }} />
                        </button>
                        <button className="p-2 rounded-lg glass-morphism" title="Delete">
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {scheduledQueries.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
                    <p className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                      No scheduled queries
                    </p>
                    <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      Automate your database operations with scheduled queries
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Create Monitor Modal */}
        {showCreateMonitor && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: `${theme.colors.background}80` }}>
            <div className="w-full max-w-2xl glass-card rounded-2xl p-6 m-4" style={{ backgroundColor: theme.colors.foreground }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
                {t('monitoring.createMonitor')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    {t('monitoring.monitorName')}
                  </label>
                  <input
                    type="text"
                    value={newMonitor.name}
                    onChange={(e) => setNewMonitor({ ...newMonitor, name: e.target.value })}
                    placeholder="Database Health Check"
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    {t('monitoring.monitorType')}
                  </label>
                  <select
                    value={newMonitor.monitor_type}
                    onChange={(e) => setNewMonitor({ ...newMonitor, monitor_type: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  >
                    <option value="query">Query Result</option>
                    <option value="connection">Connection Status</option>
                    <option value="performance">Performance</option>
                    <option value="disk_space">Disk Space</option>
                    <option value="table_size">Table Size</option>
                    <option value="row_count">Row Count</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Query (optional)
                  </label>
                  <textarea
                    value={newMonitor.query}
                    onChange={(e) => setNewMonitor({ ...newMonitor, query: e.target.value })}
                    placeholder="SELECT COUNT(*) FROM users WHERE status = 'active'"
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg glass-card font-mono text-sm"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Check Interval (minutes)
                  </label>
                  <input
                    type="number"
                    value={newMonitor.check_interval}
                    onChange={(e) => setNewMonitor({ ...newMonitor, check_interval: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateMonitor(false)}
                  className="flex-1 px-4 py-2 rounded-lg glass-morphism font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  Cancel
                </button>
                <button
                  onClick={createMonitor}
                  disabled={!newMonitor.name}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  {t('monitoring.createMonitor')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Channel Modal */}
        {showCreateChannel && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: `${theme.colors.background}80` }}>
            <div className="w-full max-w-2xl glass-card rounded-2xl p-6 m-4" style={{ backgroundColor: theme.colors.foreground }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
                Add Notification Channel
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Channel Name
                  </label>
                  <input
                    type="text"
                    value={newChannel.name}
                    onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                    placeholder="Production Alerts"
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Channel Type
                  </label>
                  <select
                    value={newChannel.channel_type}
                    onChange={(e) => setNewChannel({ ...newChannel, channel_type: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  >
                    <option value="email">📧 Email</option>
                    <option value="slack">💬 Slack</option>
                    <option value="teams">👥 Microsoft Teams</option>
                    <option value="discord">🎮 Discord</option>
                    <option value="webhook">🔗 Webhook</option>
                    <option value="sms">📱 SMS</option>
                    <option value="telegram">✈️ Telegram</option>
                    <option value="pagerduty">🚨 PagerDuty</option>
                  </select>
                </div>
                {newChannel.channel_type === 'email' && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newChannel.config.email || ''}
                      onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, email: e.target.value } })}
                      placeholder="alerts@example.com"
                      className="w-full px-4 py-2 rounded-lg glass-card"
                      style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                    />
                  </div>
                )}
                {(newChannel.channel_type === 'slack' || newChannel.channel_type === 'teams' || newChannel.channel_type === 'discord') && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      value={newChannel.config.webhook_url || ''}
                      onChange={(e) => setNewChannel({ ...newChannel, config: { ...newChannel.config, webhook_url: e.target.value } })}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-4 py-2 rounded-lg glass-card"
                      style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateChannel(false)}
                  className="flex-1 px-4 py-2 rounded-lg glass-morphism font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  Cancel
                </button>
                <button
                  onClick={createChannel}
                  disabled={!newChannel.name}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  Add Channel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Scheduled Query Modal */}
        {showCreateSchedule && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: `${theme.colors.background}80` }}>
            <div className="w-full max-w-2xl glass-card rounded-2xl p-6 m-4" style={{ backgroundColor: theme.colors.foreground }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>
                Schedule Query
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Query Name
                  </label>
                  <input
                    type="text"
                    value={newSchedule.name}
                    onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                    placeholder="Daily User Report"
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    SQL Query
                  </label>
                  <textarea
                    value={newSchedule.query}
                    onChange={(e) => setNewSchedule({ ...newSchedule, query: e.target.value })}
                    placeholder="SELECT * FROM users WHERE created_at >= CURRENT_DATE"
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg glass-card font-mono text-sm"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Schedule (Cron Expression)
                  </label>
                  <select
                    value={newSchedule.schedule_cron}
                    onChange={(e) => setNewSchedule({ ...newSchedule, schedule_cron: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  >
                    <option value="*/5 * * * *">Every 5 minutes</option>
                    <option value="0 * * * *">Every hour</option>
                    <option value="0 9 * * *">Daily at 9 AM</option>
                    <option value="0 9 * * 1">Weekly on Monday at 9 AM</option>
                    <option value="0 9 1 * *">Monthly on 1st at 9 AM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                    Output Format
                  </label>
                  <select
                    value={newSchedule.output_format}
                    onChange={(e) => setNewSchedule({ ...newSchedule, output_format: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg glass-card"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  >
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateSchedule(false)}
                  className="flex-1 px-4 py-2 rounded-lg glass-morphism font-semibold"
                  style={{ color: theme.colors.text }}
                >
                  Cancel
                </button>
                <button
                  onClick={createScheduledQuery}
                  disabled={!newSchedule.name || !newSchedule.query}
                  className="flex-1 px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  Schedule Query
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
