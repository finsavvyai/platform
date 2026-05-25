// CycleDetail - Detailed view of a single test cycle
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, CheckCircle, XCircle, AlertCircle, Clock, Edit, Trash2, Play } from 'lucide-react';
import { api } from '../lib/api';

interface Cycle {
    id: string;
    name: string;
    description?: string;
    status: 'planned' | 'active' | 'completed';
    environment: string;
    startDate: number;
    endDate: number;
    progress: {
        total: number;
        passed: number;
        failed: number;
        blocked: number;
        notRun: number;
    };
    testCases?: Array<{
        id: string;
        name: string;
        status: string;
        priority: string;
    }>;
}

export default function CycleDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [cycle, setCycle] = useState<Cycle | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'tests' | 'activity'>('overview');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    const fetchCycle = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getCycle(id!);
            setCycle(data.cycle);
        } catch (error) {
            console.error('Error fetching cycle:', error);
            setCycle(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const handleEdit = useCallback(() => {
        if (!cycle) return;
        // Edit modal isn't implemented yet; route to /cycles for now so the
        // user lands somewhere usable. Dedicated /cycles/:id/edit route can
        // replace this once the edit UI ships.
        // TODO(pass-4): build CycleEditModal — see CLAUDE.md Future Scope.
        alert(`Edit "${cycle.name}" — editor coming soon.`);
    }, [cycle]);

    const handleDelete = useCallback(async () => {
        if (!cycle) return;
        const confirmed = window.confirm(
            `Delete cycle "${cycle.name}"? This cannot be undone.`
        );
        if (!confirmed) return;
        setIsDeleting(true);
        try {
            await api.deleteCycle(cycle.id);
            navigate('/cycles');
        } catch (error) {
            console.error('Delete cycle failed:', error);
            alert('Could not delete cycle. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    }, [cycle, navigate]);

    const handleRunTests = useCallback(async () => {
        if (!cycle) return;
        setIsRunning(true);
        try {
            await api.createAutomationRun({
                name: `${cycle.name} — cycle run`,
                projectId: cycle.id,
                userId: 'current-user',
                testCases: cycle.testCases ?? [],
                config: {
                    parallel: false,
                    environment: cycle.environment,
                    captureScreenshots: true,
                },
                metadata: { cycleId: cycle.id, source: 'cycle-detail' },
            });
            navigate('/runs');
        } catch (error) {
            console.error('Run cycle tests failed:', error);
            alert('Could not start the cycle run. Please try again.');
        } finally {
            setIsRunning(false);
        }
    }, [cycle, navigate]);

    useEffect(() => {
        if (id) {
            fetchCycle();
        }
    }, [id, fetchCycle]);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-blue-500';
            case 'completed':
                return 'bg-green-500';
            default:
                return 'bg-gray-500';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-400">Loading cycle...</p>
                </div>
            </div>
        );
    }

    if (!cycle) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-xl text-gray-400">Cycle not found</p>
                    <button
                        onClick={() => navigate('/cycles')}
                        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                    >
                        Back to Cycles
                    </button>
                </div>
            </div>
        );
    }

    const progressPercentage = cycle.progress.total > 0
        ? Math.round(((cycle.progress.passed + cycle.progress.failed + cycle.progress.blocked) / cycle.progress.total) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <button
                        onClick={() => navigate('/cycles')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Cycles
                    </button>

                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold">{cycle.name}</h1>
                                <div className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(cycle.status)}`}>
                                    {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                                </div>
                            </div>
                            {cycle.description && (
                                <p className="text-gray-400">{cycle.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                        {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
                                    </span>
                                </div>
                                <div className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded">
                                    {cycle.environment.charAt(0).toUpperCase() + cycle.environment.slice(1)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleEdit}
                                aria-label="Edit cycle"
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                            >
                                <Edit className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                aria-label="Delete cycle"
                                className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleRunTests}
                                disabled={isRunning}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Play className="w-5 h-5" />
                                {isRunning ? 'Starting…' : 'Run Tests'}
                            </button>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-6 bg-gray-700/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Overall Progress</span>
                            <span className="text-lg font-bold">{progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-3 mb-4">
                            <div
                                className="bg-blue-500 h-3 rounded-full transition-all"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span>{cycle.progress.passed} Passed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-400" />
                                <span>{cycle.progress.failed} Failed</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-yellow-400" />
                                <span>{cycle.progress.blocked} Blocked</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span>{cycle.progress.notRun} Not Run</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 mt-6">
                        {['overview', 'tests', 'activity'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as typeof activeTab)}
                                className={`pb-2 border-b-2 transition ${activeTab === tab
                                    ? 'border-blue-500 text-white'
                                    : 'border-transparent text-gray-400 hover:text-white'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'overview' && (
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Cycle Overview</h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-gray-400 text-sm mb-1">Total Test Cases</p>
                                <p className="text-2xl font-bold">{cycle.progress.total}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm mb-1">Success Rate</p>
                                <p className="text-2xl font-bold text-green-400">
                                    {cycle.progress.total > 0
                                        ? Math.round((cycle.progress.passed / cycle.progress.total) * 100)
                                        : 0}%
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'tests' && (
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Test Cases</h2>
                        <p className="text-gray-400">Test case table coming soon...</p>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="bg-gray-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
                        <p className="text-gray-400">Activity timeline coming soon...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
