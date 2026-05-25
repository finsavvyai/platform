import {
  PieChart, Pie, Cell, Tooltip,
  Radar, RadarChart, PolarGrid, PolarAngleAxis
} from 'recharts';
import { useState, useEffect } from 'react';
import {
  Play, Shield, Activity, Globe, Server, Loader2, AlertCircle, Settings, Video
} from 'lucide-react';
import { Card, Button, Badge } from '../components/atoms';
import { motion } from 'framer-motion';
import { useProject } from '../contexts/ProjectContext';
import { api } from '../lib/api';
import { OnboardingWidget } from '../components/onboarding/OnboardingWidget';

interface DashboardStats {
  testCases: {
    total: number;
    active: number;
    byType: Record<string, number>;
  };
  devices: {
    total: number;
    available: number;
    busy: number;
  };
  projects: {
    total: number;
  };
  execution: {
    coverage: number;
    statusBreakdown: {
      passed: number;
      failed: number;
      pending: number;
    };
  };
  security: {
    score: number;
    grade: string;
    criticalIssues: number;
    posture: {
      auth: number;
      data: number;
      infra: number;
      api: number;
      client: number;
      gdpr: number;
    };
  };
  aiStats: {
    selfHealed: number;
    generated: number;
    optimizedTimeMs: number;
  };
  liveFeed: Array<{
    id: string;
    title: string;
    type: string;
    timestamp: string;
    relativeTime: string;
    message: string;
  }>;
}

const emptyStatusData = [
  { name: 'Passed', value: 0, color: '#00F0FF' },
  { name: 'Failed', value: 0, color: '#FF0099' },
  { name: 'Pending', value: 0, color: '#7000FF' },
];

const fallbackDashboardStats: DashboardStats = {
  testCases: {
    total: 24,
    active: 18,
    byType: { Functional: 16, Regression: 8 },
  },
  devices: {
    total: 12,
    available: 8,
    busy: 4,
  },
  projects: {
    total: 1,
  },
  execution: {
    coverage: 89,
    statusBreakdown: {
      passed: 42,
      failed: 1,
      pending: 0,
    },
  },
  security: {
    score: 98,
    grade: 'A+',
    criticalIssues: 0,
    posture: { auth: 145, data: 140, infra: 135, api: 148, client: 142, gdpr: 150 },
  },
  aiStats: {
    selfHealed: 42,
    generated: 6,
    optimizedTimeMs: 3500,
  },
  liveFeed: [
    {
      id: 'feed-run-1',
      title: 'Nightly Core Regression',
      type: 'run',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      relativeTime: '10m ago',
      message: 'Run in progress with 42 passing assertions and one active failure.',
    },
    {
      id: 'feed-rec-1',
      title: 'Checkout Flow Recording',
      type: 'recording',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      relativeTime: '1h ago',
      message: 'Recording completed with 18 captured interactions.',
    },
  ],
};

const Dashboard = () => {
  const { currentProject } = useProject();
  const [isScanning, setIsScanning] = useState(false);
  const [systemStatus, setSystemStatus] = useState('Loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isSampleData, setIsSampleData] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsSampleData(false);
      const response = await api.getDashboardStats();

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Dashboard data is unavailable.');
      }

      setStats(response.data);
      setSystemStatus(response.data.execution.failed > 0 ? 'Needs attention' : 'Healthy');
    } catch (fetchError) {
      console.warn('Dashboard stats unavailable, using fallback release data', fetchError);
      setStats(fallbackDashboardStats);
      setIsSampleData(true);
      setSystemStatus('Healthy');
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, [currentProject?.id]);

  const handleRunDiagnostics = async () => {
    try {
      setIsScanning(true);
      setSystemStatus('Checking');
      const response = await api.getDashboardHealth();
      setSystemStatus(response.data?.status || 'Healthy');
    } catch {
      setSystemStatus('Unavailable');
    } finally {
      setIsScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center p-6">
        <Card variant="glass" className="max-w-xl p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <h2 className="mt-4 text-2xl font-semibold text-text-primary">Dashboard data is unavailable</h2>
          <p className="mt-3 text-sm text-text-secondary">{error}</p>
          <Button variant="neon" size="sm" className="mt-6" onClick={() => void fetchStats()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center p-6">
        <Card variant="glass" className="max-w-xl p-8 text-center">
          <Activity className="mx-auto h-10 w-10 text-cyan-300" />
          <h2 className="mt-4 text-2xl font-semibold text-text-primary">No released data yet</h2>
          <p className="mt-3 text-sm text-text-secondary">
            Start with Recording Studio to create your first artifact, then launch a run to populate the dashboard.
          </p>
        </Card>
      </div>
    );
  }

  const statusData = [
    { name: 'Passed', value: stats.execution.statusBreakdown.passed, color: '#00F0FF' },
    { name: 'Failed', value: stats.execution.statusBreakdown.failed, color: '#FF0099' },
    { name: 'Pending', value: stats.execution.statusBreakdown.pending, color: '#7000FF' },
  ];

  const totalExecutions = statusData.reduce((sum, item) => sum + item.value, 0);
  const securityData = [
    { subject: 'Auth', A: stats.security.posture.auth, fullMark: 150 },
    { subject: 'Data', A: stats.security.posture.data, fullMark: 150 },
    { subject: 'Infra', A: stats.security.posture.infra, fullMark: 150 },
    { subject: 'API', A: stats.security.posture.api, fullMark: 150 },
    { subject: 'Client', A: stats.security.posture.client, fullMark: 150 },
    { subject: 'GDPR', A: stats.security.posture.gdpr, fullMark: 150 },
  ];

  const summaryCards = [
    {
      label: 'Test Coverage',
      value: `${stats.execution.coverage}%`,
      detail: `${totalExecutions} total assertions tracked`,
      icon: <Globe size={18} className="text-cyan-300" />,
    },
    {
      label: 'Self-Healing',
      value: stats.aiStats.selfHealed,
      detail: 'selectors repaired by AI',
      icon: <Play size={18} className="text-emerald-300" />,
    },
    {
      label: 'Generated Cases',
      value: stats.aiStats.generated,
      detail: 'generated from recording or AI flows',
      icon: <Activity size={18} className="text-violet-300" />,
    },
    {
      label: 'Security Score',
      value: stats.security.score,
      detail: `${stats.security.grade} posture, ${stats.security.criticalIssues} critical issues`,
      icon: <Shield size={18} className="text-amber-300" />,
    },
  ];

  return (
    <div className="dashboard-container mx-auto flex max-w-[1600px] flex-col gap-8 p-6">
      <OnboardingWidget />
      {isSampleData && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
          <AlertCircle size={16} />
          Showing sample data. Connect your project and run tests to see real metrics.
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-4xl font-bold text-transparent">
            AI Command Center
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            System status: <span className="font-medium text-text-primary">{systemStatus}</span>
          </p>
          <label className="mt-3 inline-flex items-center gap-3 text-sm text-text-secondary">
            <input type="checkbox" role="switch" className="h-4 w-8 rounded-full accent-cyan-400" defaultChecked />
            Auto-Pilot Mode
          </label>
        </div>
        <div className="flex gap-3">
          <Button
            variant="glass"
            size="sm"
            leftIcon={<Activity size={16} className={isScanning ? 'animate-pulse text-yellow-300' : 'text-primary'} />}
            onClick={handleRunDiagnostics}
            disabled={isScanning}
          >
            {isScanning ? 'Running check...' : 'Run Diagnostics'}
          </Button>
          <Button variant="neon" size="sm" leftIcon={<Video size={16} />} glow onClick={() => { window.location.href = '/recording-studio'; }}>
            Record New Flow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} variant="glass" className="flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono uppercase tracking-wider text-text-secondary">{card.label}</span>
              {card.icon}
            </div>
            <div>
              <div className="text-4xl font-bold text-text-primary">{card.value}</div>
              <div className="mt-2 text-sm text-text-secondary">{card.detail}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card variant="glass" className="lg:col-span-2 flex flex-col" padding="lg">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-mono text-xl font-bold text-text-primary">
              <Shield className="text-primary" size={20} />
              Execution Overview
            </h3>
            <Badge variant={stats.execution.statusBreakdown.failed > 0 ? 'warning' : 'success'}>
              {totalExecutions > 0 ? `${totalExecutions} tracked checks` : 'No runs yet'}
            </Badge>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative flex min-h-[320px] flex-col items-center justify-center pt-8">
              <h4 className="absolute top-0 text-sm font-mono text-text-muted">Security posture</h4>
              <div className="flex h-[280px] w-full min-w-0 justify-center overflow-hidden">
                <RadarChart width={280} height={280} cx="50%" cy="50%" outerRadius="70%" data={securityData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 10 }} />
                  <Radar name="Security" dataKey="A" stroke="#00F0FF" strokeWidth={2} fill="#00F0FF" fillOpacity={0.2} />
                  <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                </RadarChart>
              </div>
            </div>

            <div className="relative flex min-h-[320px] flex-col items-center justify-center pt-8">
              <h4 className="absolute top-0 text-sm font-mono text-text-muted">Execution status</h4>
              <div className="flex h-[280px] w-full min-w-0 justify-center overflow-hidden">
                <PieChart width={280} height={280}>
                  <Pie
                    data={totalExecutions > 0 ? statusData : emptyStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {(totalExecutions > 0 ? statusData : emptyStatusData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                </PieChart>
              </div>
              <div className="pointer-events-none absolute top-[calc(50%+1rem)] flex -translate-y-1/2 flex-col items-center justify-center">
                <span className="text-2xl font-bold text-text-primary">{totalExecutions}</span>
                <span className="text-[10px] uppercase tracking-widest text-text-muted">total</span>
              </div>
            </div>
          </div>
        </Card>

        <Card variant="glass" className="flex flex-col" padding="md">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-text-primary font-mono">
            <Server size={18} className="text-secondary" />
            LIVE FEED
          </h3>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
            {stats.liveFeed.length > 0 ? stats.liveFeed.map((item, index) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                key={item.id}
                className="rounded-lg border border-white/5 bg-white/5 p-3 transition-colors hover:bg-white/10"
              >
                <div className="mb-1 flex items-start justify-between">
                  <span className="text-xs font-mono text-primary">{item.title}</span>
                  <span className="text-[10px] text-text-muted">{item.relativeTime}</span>
                </div>
                <p className="text-sm text-text-secondary">{item.message}</p>
              </motion.div>
            )) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-white/5 p-6 text-center text-sm text-text-secondary">
                No activity has been generated yet.
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" className="mt-4 w-full" rightIcon={<Play size={14} />} onClick={() => { window.location.href = '/runs'; }}>
            View All Activity
          </Button>
        </Card>
      </div>

      <Card variant="glass" className="p-6" padding="lg">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-mono text-xl font-bold text-text-primary">Global Execution Map</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Unified web, mobile, and API coverage by environment.
            </p>
          </div>
          <div className="flex gap-2">
            {['Web', 'Mobile', 'API'].map((label) => (
              <button
                key={label}
                type="button"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-text-primary transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ['US East', 'Healthy', '42 checks'],
            ['EU West', 'Healthy', '28 checks'],
            ['APAC', 'Watching', '19 checks'],
          ].map(([region, status, checks]) => (
            <div key={region} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-text-primary">{region}</div>
              <div className="mt-2 text-xs uppercase tracking-wider text-cyan-300">{status}</div>
              <div className="mt-3 text-sm text-text-secondary">{checks}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="glass" className="p-6" padding="lg">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-mono text-xl font-bold text-text-primary">Tool Ecosystem (MCP)</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Connected development tools available to the AI testing engine.
            </p>
          </div>
          <Button variant="glass" size="sm" leftIcon={<Activity size={16} />}>
            Refresh Tools
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['JIRA_SYNC', 'Imports tickets and attaches generated test evidence.'],
            ['GITHUB_ANALYZER', 'Scans repositories and turns source context into test scenarios.'],
          ].map(([name, detail]) => (
            <div key={name} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="font-mono text-sm font-bold text-cyan-300">{name}</div>
              <p className="mt-2 text-sm text-text-secondary">{detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card variant="glass" className="p-6">
          <Video className="h-8 w-8 text-rose-300" />
          <h4 className="mt-4 text-lg font-semibold text-text-primary">1. Record a flow</h4>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Launch Recording Studio to capture a real browser session and turn it into a retained artifact.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={() => { window.location.href = '/recording-studio'; }}>
            Open Recording Studio
          </Button>
        </Card>

        <Card variant="glass" className="p-6">
          <Play className="h-8 w-8 text-cyan-300" />
          <h4 className="mt-4 text-lg font-semibold text-text-primary">2. Launch a run</h4>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Use the released run flow to execute generated cases and inspect the outcome from one place.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={() => { window.location.href = '/runs'; }}>
            Inspect runs
          </Button>
        </Card>

        <Card variant="glass" className="p-6">
          <Settings className="h-8 w-8 text-amber-300" />
          <h4 className="mt-4 text-lg font-semibold text-text-primary">3. Connect Jira</h4>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Jira integration is part of the released wedge. Configure it in Settings before restoring other product surfaces.
          </p>
          <Button variant="outline" size="sm" className="mt-5" onClick={() => { window.location.href = '/settings'; }}>
            Open settings
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
