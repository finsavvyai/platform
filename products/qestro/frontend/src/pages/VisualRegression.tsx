import { useState, useMemo, useCallback, useEffect } from 'react';
import { Eye, Filter, Check, AlertTriangle, Plus, Loader2, Play } from 'lucide-react';
import { Card } from '../components/atoms';
import { motion, AnimatePresence } from 'framer-motion';
import { ComparisonView } from '../components/visual-regression/ComparisonView';
import { api } from '../lib/api';
import { useProject } from '../contexts/ProjectContext';

interface RegressionResult {
  id: string;
  testName: string;
  projectName: string;
  baseline: string;
  current: string;
  diff: string;
  status: 'pass' | 'fail' | 'new';
  mismatchPercentage: number;
  timestamp: string;
}

type FilterStatus = 'all' | 'pass' | 'fail' | 'new';

function mapApiStatus(s: string): 'pass' | 'fail' | 'new' {
  if (s === 'passed') return 'pass';
  if (s === 'baseline-created') return 'new';
  return 'fail';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function VisualRegression() {
  const { currentProject } = useProject();
  const [results, setResults] = useState<RegressionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<RegressionResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [runUrl, setRunUrl] = useState('');
  const [runName, setRunName] = useState('');
  const [running, setRunning] = useState(false);

  const projectId = currentProject?.id || '';

  const loadResults = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getBaselines(projectId);
      if (data.success && data.baselines) {
        setResults(data.baselines.map((b: any) => ({
          id: b.name,
          testName: b.name,
          projectName: currentProject?.name || '',
          baseline: `/api/visual/baselines/${projectId}/${b.name}/image`,
          current: '',
          diff: '',
          status: 'pass' as const,
          mismatchPercentage: 0,
          timestamp: timeAgo(b.updatedAt || b.createdAt),
        })));
      }
    } catch {
      // Backend not available — keep existing results
    } finally {
      setLoading(false);
    }
  }, [projectId, currentProject?.name]);

  useEffect(() => { loadResults(); }, [loadResults]);

  const handleRunTest = async () => {
    if (!runUrl || !runName || !projectId) return;
    setRunning(true);
    try {
      const data = await api.runVisualTest({
        projectId,
        url: runUrl,
        baselineName: runName,
        createIfMissing: true,
      });
      if (data.success && data.result) {
        const r = data.result;
        const images = api.getVisualImageUrls(r.id);
        const newResult: RegressionResult = {
          id: r.id,
          testName: r.testName,
          projectName: currentProject?.name || '',
          baseline: images.baseline,
          current: images.current,
          diff: images.diff,
          status: mapApiStatus(r.status),
          mismatchPercentage: r.mismatchPercentage,
          timestamp: 'just now',
        };
        setResults((prev) => [newResult, ...prev]);
        setSelectedResult(newResult);
        setRunUrl('');
        setRunName('');
      }
    } catch (err) {
      console.error('Visual test failed:', err);
    } finally {
      setRunning(false);
    }
  };

  const handleApprove = async (resultId: string) => {
    if (!projectId) return;
    try {
      await api.approveBaseline(projectId, resultId);
      setResults((prev) =>
        prev.map((r) =>
          r.id === resultId ? { ...r, status: 'pass' as const, mismatchPercentage: 0 } : r,
        ),
      );
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const filteredResults = useMemo(() => {
    return results.filter((r) => filterStatus === 'all' || r.status === filterStatus);
  }, [results, filterStatus]);

  const statusIcon = (status: string) => {
    if (status === 'pass') return <Check className="h-4 w-4 text-green-400" />;
    if (status === 'fail') return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
    return <Plus className="h-4 w-4 text-blue-400" />;
  };

  const statusColor = (status: string) => {
    if (status === 'pass') return 'bg-green-900/20 border-green-700 text-green-300';
    if (status === 'fail') return 'bg-yellow-900/20 border-yellow-700 text-yellow-300';
    if (status === 'new') return 'bg-blue-900/20 border-blue-700 text-blue-300';
    return 'bg-slate-800 border-slate-700 text-slate-300';
  };

  const filterCounts = useMemo(() => ({
    all: results.length,
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    new: results.filter((r) => r.status === 'new').length,
  }), [results]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="h-8 w-8 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">Visual Regression</h1>
          </div>
          <p className="text-slate-300">Compare baseline vs current screenshots and approve changes</p>
        </motion.div>

        {/* Quick Run Form */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
          <Card className="p-4 border border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-xs text-slate-400 mb-1">URL to capture</label>
                <input
                  type="url"
                  placeholder="https://your-app.com/page"
                  value={runUrl}
                  onChange={(e) => setRunUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="sm:w-48">
                <label className="block text-xs text-slate-400 mb-1">Baseline name</label>
                <input
                  type="text"
                  placeholder="e.g. dashboard-header"
                  value={runName}
                  onChange={(e) => setRunName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleRunTest}
                disabled={running || !runUrl || !runName}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run Test
              </button>
            </div>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1">
            <Card className="p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-5 w-5 text-slate-300" />
                <h2 className="font-semibold text-white">Results</h2>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {(['all', 'pass', 'fail', 'new'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {s === 'all' ? 'All Results' : s === 'pass' ? 'Passed' : s === 'fail' ? 'Failed' : 'New'}
                    <span className="ml-2 text-xs">({filterCounts[s]})</span>
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                <AnimatePresence>
                  {filteredResults.map((result, idx) => (
                    <motion.button
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedResult(result)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedResult?.id === result.id ? 'bg-slate-700 border-blue-500' : statusColor(result.status)
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        {statusIcon(result.status)}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{result.testName}</p>
                          <p className="text-xs opacity-75">{result.projectName}</p>
                        </div>
                      </div>
                      {result.mismatchPercentage > 0 && (
                        <p className="text-xs text-yellow-400 mt-1">{result.mismatchPercentage.toFixed(1)}% mismatch</p>
                      )}
                      <p className="text-xs opacity-60">{result.timestamp}</p>
                    </motion.button>
                  ))}
                </AnimatePresence>
                {filteredResults.length === 0 && !loading && (
                  <p className="text-slate-500 text-sm text-center py-4">No results yet. Run a visual test above.</p>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Main comparison view */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-3">
            {selectedResult ? (
              <Card className="p-6 border border-slate-700">
                <ComparisonView
                  baseline={selectedResult.baseline}
                  current={selectedResult.current}
                  diff={selectedResult.diff}
                  status={selectedResult.status}
                  mismatchPercentage={selectedResult.mismatchPercentage}
                  testName={selectedResult.testName}
                  onApprove={selectedResult.status === 'fail' ? () => handleApprove(selectedResult.id) : undefined}
                />
              </Card>
            ) : (
              <Card className="p-12 border border-slate-700 flex items-center justify-center">
                <div className="text-center">
                  <Eye className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">Select a result or run a visual test</p>
                  <p className="text-slate-500 text-sm mt-2">Paste a URL above and click "Run Test" to capture your first screenshot</p>
                </div>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
