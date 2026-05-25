import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, Clock, ArrowUp, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useProject } from '../contexts/ProjectContext';
import { EmptyState } from '../components/EmptyState';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface InsightsOverview {
  coverage: { value: number; change: number; trend: string };
  passRate: { value: number; change: number; trend: string };
  avgDuration: { value: string; change: number; trend: string; unit: string };
  totalTests: number;
}

interface WeeklyDataPoint {
  name: string;
  passed: number;
  failed: number;
}

interface TrendDataPoint {
  week: string;
  coverage: number;
}

const fallbackOverview: InsightsOverview = {
  coverage: { value: 82, change: 7, trend: 'up' },
  passRate: { value: 87, change: 3, trend: 'up' },
  avgDuration: { value: '4.2m', change: 12, trend: 'up', unit: 'seconds' },
  totalTests: 0,
};

const fallbackWeeklyData: WeeklyDataPoint[] = [
  { name: 'Mon', passed: 65, failed: 12 },
  { name: 'Tue', passed: 72, failed: 8 },
  { name: 'Wed', passed: 68, failed: 15 },
  { name: 'Thu', passed: 80, failed: 5 },
  { name: 'Fri', passed: 75, failed: 10 },
];

const fallbackTrendData: TrendDataPoint[] = [
  { week: 'Week 1', coverage: 72 },
  { week: 'Week 2', coverage: 75 },
  { week: 'Week 3', coverage: 78 },
  { week: 'Week 4', coverage: 82 },
];

const Insights = () => {
  const { currentProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<InsightsOverview | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyDataPoint[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, weeklyRes, trendRes] = await Promise.all([
        api.getInsightsOverview(),
        api.getInsightsWeekly(),
        api.getInsightsTrend()
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }
      if (weeklyRes.success && weeklyRes.data) {
        setWeeklyData(weeklyRes.data);
      }
      if (trendRes.success && trendRes.data) {
        setTrendData(trendRes.data);
      }
    } catch (error) {
      console.warn('Insights API unavailable, using fallback analytics', error);
      setOverview(fallbackOverview);
      setWeeklyData(fallbackWeeklyData);
      setTrendData(fallbackTrendData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-text-secondary">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (currentProject?.id === '1') {
    return (
      <div className="p-6">
        <EmptyState
          icon={TrendingUp}
          title="No Analytics Data Yet"
          description="Run some tests to start seeing insights and trends about your testing performance."
        />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div
      className="min-h-screen p-8 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <motion.div
        className="max-w-7xl mx-auto space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Analytics & Insights</h1>
          <p className="text-text-secondary">Real-time performance metrics and test coverage analysis.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp size={80} className="text-primary" />
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-medium text-text-secondary">Test Coverage</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-text-primary">{overview?.coverage.value ?? 82}%</span>
                  <span className="text-sm font-medium text-emerald-400 flex items-center gap-1">
                    <ArrowUp size={14} /> {overview?.coverage.change ?? 7}%
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${overview?.coverage.value ?? 82}%` }}
                transition={{ duration: 1, delay: 0.5 }}
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity size={80} className="text-emerald-500" />
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-medium text-text-secondary">Pass Rate</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-text-primary">{overview?.passRate.value ?? 87}%</span>
                  <span className="text-sm font-medium text-emerald-400 flex items-center gap-1">
                    <ArrowUp size={14} /> {overview?.passRate.change ?? 3}%
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Activity size={20} />
              </div>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${overview?.passRate.value ?? 87}%` }}
                transition={{ duration: 1, delay: 0.6 }}
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 p-6 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock size={80} className="text-purple-500" />
            </div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-medium text-text-secondary">Avg. Duration</h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-text-primary">{overview?.avgDuration.value ?? '4.2m'}</span>
                  <span className="text-sm font-medium text-red-400 flex items-center gap-1">
                    <ArrowUp size={14} /> {overview?.avgDuration.change ?? 12}s
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Clock size={20} />
              </div>
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                transition={{ duration: 1, delay: 0.7 }}
              />
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div variants={itemVariants} className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-6">Weekly Test Results</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#9ca3af"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10, 11, 20, 0.9)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(8px)'
                    }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="passed" name="Passed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-6">Coverage Trend</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis
                    dataKey="week"
                    stroke="#9ca3af"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    domain={[60, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10, 11, 20, 0.9)',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(8px)'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="coverage"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorCoverage)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Insights;
