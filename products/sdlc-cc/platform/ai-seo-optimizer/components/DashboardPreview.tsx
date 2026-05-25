import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus,
  Bot, Globe, FileText, BarChart3,
} from 'lucide-react';
import { ScoreRing } from './ScoreRing';

const metrics = [
  { label: 'AI Citations', value: '1,247', change: '+23%', trend: 'up' as const },
  { label: 'Agent Queries', value: '8,432', change: '+18%', trend: 'up' as const },
  { label: 'Avg Position', value: '#3', change: '-1', trend: 'down' as const },
  { label: 'Pages Optimized', value: '89', change: '0', trend: 'neutral' as const },
];

const trendIcons = { up: TrendingUp, down: TrendingDown, neutral: Minus };
const trendColors = {
  up: 'text-score-high bg-emerald-50',
  down: 'text-score-low bg-red-50',
  neutral: 'text-slate-500 bg-slate-50',
};

const topPages = [
  { url: '/guides/ai-compliance', score: 94, agent: 'ChatGPT', citations: 312 },
  { url: '/blog/data-security', score: 87, agent: 'Perplexity', citations: 198 },
  { url: '/docs/api-reference', score: 82, agent: 'Claude', citations: 156 },
  { url: '/pricing', score: 71, agent: 'Gemini', citations: 89 },
];

const DashboardPreview = () => {
  return (
    <section id="dashboard" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            Your AI command center
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            One dashboard to track how AI agents discover, cite,
            and rank your content across every platform.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-panel rounded-3xl p-6 md:p-8"
        >
          <DashboardMetrics />
          <div className="grid lg:grid-cols-5 gap-6 mt-6">
            <div className="lg:col-span-3">
              <DashboardTable pages={topPages} />
            </div>
            <div className="lg:col-span-2">
              <AgentBreakdown />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

function DashboardMetrics() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m, i) => {
        const TrendIcon = trendIcons[m.trend];
        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="metric-card"
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              {m.label}
            </p>
            <p className="text-2xl font-bold text-slate-900">{m.value}</p>
            <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md text-xs font-medium ${trendColors[m.trend]}`}>
              <TrendIcon className="h-3 w-3" />
              {m.change}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function DashboardTable({ pages }: { pages: typeof topPages }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-slate-800">Top Cited Pages</h3>
      </div>
      <div className="divide-y divide-slate-50">
        {pages.map((page) => (
          <div key={page.url} className="px-5 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate font-code">
                {page.url}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Top agent: {page.agent}
              </p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{page.citations}</p>
                <p className="text-[10px] text-slate-400 uppercase">citations</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white ${page.score >= 80 ? 'bg-score-high' : page.score >= 60 ? 'bg-score-medium' : 'bg-score-low'}`}>
                {page.score}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentBreakdown() {
  const agents = [
    { name: 'ChatGPT', pct: 38, color: '#10B981' },
    { name: 'Perplexity', pct: 28, color: '#8B5CF6' },
    { name: 'Claude', pct: 22, color: '#06B6D4' },
    { name: 'Gemini', pct: 12, color: '#F59E0B' },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-slate-800">
          Citations by Agent
        </h3>
      </div>
      <div className="flex justify-center mb-5">
        <ScoreRing score={78} size={100} label="Overall" />
      </div>
      <div className="space-y-3">
        {agents.map((a) => (
          <div key={a.name} className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
            <span className="text-sm text-slate-700 flex-1">{a.name}</span>
            <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: a.color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${a.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500 w-8 text-right">
              {a.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardPreview;
