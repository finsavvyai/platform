import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Target, Globe, Github, Send,
    Cpu, Shield, Search, FileText, Trash2, Eye, Loader2
} from 'lucide-react';
import { Button } from '../components/atoms';
import { Badge } from '../components/atoms/Badge/Badge';
import LiveFeed from '../components/agents/LiveFeed';
import { api } from '../lib/api';

// Types for Mission Control
type MissionType = 'TICKET' | 'SCOUT' | 'CONCIERGE';

interface Mission {
    id: string;
    type: MissionType;
    title: string;
    input: string;
    status: 'QUEUED' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
    agent: string;
    progress: number;
    startTime: string;
    createdAt: Date;
}

type ApiMission = Omit<Mission, 'createdAt'> & { createdAt: string };

const fallbackMissions: Mission[] = [
    {
        id: 'mission-ticket-1',
        type: 'TICKET',
        title: 'Checkout flow regression audit',
        input: 'Verify that retry and recovery paths preserve cart integrity.',
        status: 'ACTIVE',
        agent: 'Architect',
        progress: 68,
        startTime: '09:15',
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
    },
    {
        id: 'mission-scout-1',
        type: 'SCOUT',
        title: 'Staging exploratory scan',
        input: 'https://staging.qestro.app',
        status: 'COMPLETED',
        agent: 'Scout',
        progress: 100,
        startTime: '08:40',
        createdAt: new Date(Date.now() - 90 * 60 * 1000),
    },
];

const MissionControl = () => {
    const [activeTab, setActiveTab] = useState<MissionType>('TICKET');
    const [inputVal, setInputVal] = useState('');
    const [inputError, setInputError] = useState<string | null>(null);
    const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [usingFallbackData, setUsingFallbackData] = useState(false);

    // Missions state
    const [missions, setMissions] = useState<Mission[]>([]);

    const buildLocalMission = useCallback((type: MissionType, input: string): Mission => {
        const createdAt = new Date();
        const title = type === 'TICKET'
            ? input.slice(0, 50) + (input.length > 50 ? '...' : '')
            : type === 'SCOUT'
                ? (() => {
                    try {
                        return `Explore ${new URL(input).hostname}`;
                    } catch {
                        return `Explore ${input.slice(0, 30)}`;
                    }
                })()
                : `Onboard ${input.split('/').pop() || input.slice(0, 30)}`;

        const agent = type === 'TICKET'
            ? 'Architect'
            : type === 'SCOUT'
                ? 'Scout'
                : 'Concierge';

        return {
            id: `mission-local-${crypto.randomUUID().slice(0, 8)}`,
            type,
            title,
            input,
            status: 'ACTIVE',
            agent,
            progress: 12,
            startTime: 'Just now',
            createdAt,
        };
    }, []);

    // Fetch missions from API
    const fetchMissions = useCallback(async (options?: { silent?: boolean }) => {
        try {
            const response = await api.getMissions();
            if (response.success && response.data) {
                const transformedMissions: Mission[] = (response.data as ApiMission[]).map((m) => ({
                    ...m,
                    createdAt: new Date(m.createdAt)
                }));
                setMissions(transformedMissions);
                setUsingFallbackData(false);
            }
        } catch (error) {
            if (!options?.silent) {
                console.warn('Mission API unavailable, using fallback mandates', error);
            }
            setMissions(fallbackMissions);
            setUsingFallbackData(true);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        void fetchMissions();
    }, [fetchMissions]);

    // Poll for updates
    useEffect(() => {
        if (usingFallbackData) {
            return;
        }

        const interval = setInterval(() => {
            void fetchMissions({ silent: true });
        }, 3000);

        return () => clearInterval(interval);
    }, [fetchMissions, usingFallbackData]);

    const validateInput = (): boolean => {
        if (!inputVal.trim()) {
            setInputError('Please enter a value');
            return false;
        }

        if (activeTab === 'SCOUT') {
            try {
                new URL(inputVal);
            } catch {
                setInputError('Please enter a valid URL (e.g., https://example.com)');
                return false;
            }
        }

        if (activeTab === 'CONCIERGE') {
            if (!inputVal.includes('github.com') && !inputVal.includes('gitlab.com')) {
                setInputError('Please enter a valid Git repository URL');
                return false;
            }
        }

        if (activeTab === 'TICKET' && inputVal.trim().length < 10) {
            setInputError('Please provide more detail (at least 10 characters)');
            return false;
        }

        setInputError(null);
        return true;
    };

    const handleLaunch = async () => {
        if (!validateInput()) return;

        setSubmitting(true);
        try {
            const response = await api.createMission({
                type: activeTab,
                input: inputVal
            });

            if (response.success && response.data) {
                const newMission: Mission = {
                    ...response.data,
                    createdAt: new Date(response.data.createdAt)
                };
                setMissions((prev) => [newMission, ...prev]);
                setSelectedMission(newMission);
                setInputVal('');
                setInputError(null);
            }
        } catch (error) {
            console.warn('Mission create API unavailable, keeping local mandate only', error);
            const localMission = buildLocalMission(activeTab, inputVal.trim());
            setMissions((prev) => [localMission, ...prev]);
            setSelectedMission(localMission);
            setUsingFallbackData(true);
            setInputVal('');
            setInputError(null);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteMission = async (id: string) => {
        if (confirm('Are you sure you want to delete this mission?')) {
            try {
                await api.deleteMission(id);
            } catch (error) {
                console.warn('Mission delete API unavailable, removing local mandate only', error);
                setUsingFallbackData(true);
            } finally {
                setMissions((prev) => prev.filter((mission) => mission.id !== id));
                setSelectedMission((current) => current?.id === id ? null : current);
            }
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div
            className="min-h-screen p-8 font-sans transition-colors duration-300"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        >
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-7xl mx-auto space-y-8"
            >
                {/* Header */}
                <div className="flex justify-between items-end border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight">
                            Mission Control
                        </h1>
                        <p className="text-gray-400 mt-2 text-lg">
                            Authorized Personnel Only. Assign mandates to the Autonomous Department.
                        </p>
                        {usingFallbackData && (
                            <p className="mt-3 text-sm text-amber-300">
                                Running with local fallback mission data while backend mission services are unavailable.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <div className="text-right">
                            <div className="text-sm text-gray-400">Active Missions</div>
                            <div className="text-2xl font-mono font-bold text-green-400">
                                {missions.filter(m => m.status === 'ACTIVE').length}/{missions.length}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-400">Completed</div>
                            <div className="text-2xl font-mono font-bold text-blue-400">
                                {missions.filter(m => m.status === 'COMPLETED').length}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Command Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left: Input Console */}
                    <div className="lg:col-span-2 space-y-6">
                        <motion.div variants={itemVariants} className="bg-[#131620] border border-white/10 rounded-2xl p-1 overflow-hidden backdrop-blur-xl">
                            <div className="flex border-b border-white/5">
                                {[
                                    { id: 'TICKET', icon: FileText, label: 'Ingest Ticket', color: 'text-blue-400' },
                                    { id: 'SCOUT', icon: Globe, label: 'Deploy Scout', color: 'text-emerald-400' },
                                    { id: 'CONCIERGE', icon: Github, label: 'Onboard Repo', color: 'text-purple-400' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id as MissionType);
                                            setInputError(null);
                                        }}
                                        className={`flex-1 flex items-center justify-center gap-3 py-4 text-sm font-medium transition-all duration-200
                      ${activeTab === tab.id ? 'bg-white/5 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                    `}
                                    >
                                        <tab.icon size={18} className={activeTab === tab.id ? tab.color : ''} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                                        {activeTab === 'TICKET' ? 'Jira Ticket / Requirement Description' :
                                            activeTab === 'SCOUT' ? 'Target Application URL' :
                                                'Git Repository URL'}
                                    </label>
                                    <textarea
                                        value={inputVal}
                                        onChange={(e) => {
                                            setInputVal(e.target.value);
                                            if (inputError) setInputError(null);
                                        }}
                                        placeholder={
                                            activeTab === 'TICKET' ? "As a user, I want to verify that the checkout flow persists cart items..." :
                                                activeTab === 'SCOUT' ? "https://staging.myapp.com" :
                                                    "https://github.com/org/repo"
                                        }
                                        className={`w-full h-32 bg-black/40 border rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 font-mono text-sm resize-none transition-all ${inputError ? 'border-red-500/50' : 'border-white/10'
                                            }`}
                                    />
                                    {inputError && (
                                        <p className="text-red-400 text-sm flex items-center gap-1">
                                            <span className="w-1 h-1 bg-red-400 rounded-full" />
                                            {inputError}
                                        </p>
                                    )}
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <div className="flex gap-2">
                                        {activeTab === 'TICKET' && (
                                            <span className="flex items-center gap-1 text-xs text-blue-400/80 bg-blue-500/10 px-2 py-1 rounded">
                                                <Cpu size={12} /> Architect AI Ready
                                            </span>
                                        )}
                                        {activeTab === 'SCOUT' && (
                                            <span className="flex items-center gap-1 text-xs text-emerald-400/80 bg-emerald-500/10 px-2 py-1 rounded">
                                                <Search size={12} /> Scout AI Ready
                                            </span>
                                        )}
                                    </div>
                                    <Button
                                        variant="neon"
                                        glow
                                        onClick={handleLaunch}
                                        rightIcon={submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                        disabled={!inputVal.trim() || submitting || loading}
                                    >
                                        {submitting ? 'Launching...' : 'Initialize Mission'}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Mission Logs / Terminal */}
                        <motion.div variants={itemVariants} className="h-[400px]">
                            <LiveFeed />
                        </motion.div>
                    </div>

                    {/* Right: Active Missions */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                            <Target size={14} /> ACTIVE MANDATES ({missions.length})
                        </h3>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            <AnimatePresence>
                                {missions.map((mission) => (
                                    <motion.div
                                        key={mission.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        className={`bg-[#131620] border rounded-xl p-4 transition-all group cursor-pointer ${selectedMission?.id === mission.id
                                            ? 'border-primary/50 ring-1 ring-primary/20'
                                            : 'border-white/10 hover:border-white/20'
                                            }`}
                                        onClick={() => setSelectedMission(mission)}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                {mission.type === 'TICKET' ? <FileText size={16} className="text-blue-400" /> :
                                                    mission.type === 'SCOUT' ? <Globe size={16} className="text-emerald-400" /> :
                                                        <Github size={16} className="text-purple-400" />
                                                }
                                                <span className="font-semibold text-sm text-gray-200">{mission.id}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={
                                                    mission.status === 'ACTIVE' ? 'primary' :
                                                        mission.status === 'COMPLETED' ? 'success' :
                                                            mission.status === 'FAILED' ? 'error' : 'secondary'
                                                } size="sm">
                                                    {mission.status}
                                                </Badge>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteMission(mission.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all"
                                                >
                                                    <Trash2 size={14} className="text-red-400" />
                                                </button>
                                            </div>
                                        </div>

                                        <h4 className="text-white font-medium mb-1 line-clamp-1 group-hover:text-blue-400 transition-colors">
                                            {mission.title}
                                        </h4>

                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                            <Shield size={12} />
                                            <span>Assigned to: <span className="text-gray-300">{mission.agent}</span></span>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs text-gray-400">
                                                <span>Progress</span>
                                                <span>{Math.round(mission.progress)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                                                <motion.div
                                                    className={`h-full ${mission.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'
                                                        }`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${mission.progress}%` }}
                                                    transition={{ duration: 0.5 }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {missions.length === 0 && (
                                <div className="text-center py-12 text-gray-500">
                                    <Target size={32} className="mx-auto mb-3 opacity-30" />
                                    <p>No missions yet</p>
                                    <p className="text-sm">Create your first mission above</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </motion.div>

            {/* Mission Detail Modal */}
            <AnimatePresence>
                {selectedMission && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setSelectedMission(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-[#131620] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                                <div className="flex items-center gap-3">
                                    {selectedMission.type === 'TICKET' ? <FileText size={20} className="text-blue-400" /> :
                                        selectedMission.type === 'SCOUT' ? <Globe size={20} className="text-emerald-400" /> :
                                            <Github size={20} className="text-purple-400" />
                                    }
                                    <div>
                                        <h2 className="font-bold text-white">{selectedMission.id}</h2>
                                        <p className="text-xs text-gray-500">{selectedMission.startTime}</p>
                                    </div>
                                </div>
                                <Badge variant={
                                    selectedMission.status === 'ACTIVE' ? 'primary' :
                                        selectedMission.status === 'COMPLETED' ? 'success' :
                                            selectedMission.status === 'FAILED' ? 'error' : 'secondary'
                                }>
                                    {selectedMission.status}
                                </Badge>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Mission Title</h3>
                                    <p className="text-white">{selectedMission.title}</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Input</h3>
                                    <p className="text-gray-300 bg-black/40 p-3 rounded-lg font-mono text-sm break-all">
                                        {selectedMission.input}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Assigned Agent</h3>
                                    <p className="text-white flex items-center gap-2">
                                        <Shield size={14} className="text-primary" />
                                        {selectedMission.agent}
                                    </p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Progress</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-black rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${selectedMission.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`}
                                                style={{ width: `${selectedMission.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-white font-mono">{Math.round(selectedMission.progress)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
                                <Button variant="ghost" onClick={() => setSelectedMission(null)}>Close</Button>
                                {selectedMission.status === 'COMPLETED' && (
                                    <Button variant="neon" leftIcon={<Eye size={16} />}>View Results</Button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default MissionControl;
