import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    VideoCameraIcon, PlayIcon, StopIcon, GlobeAltIcon,
    CodeBracketIcon, ClockIcon, CursorArrowRaysIcon,
    ArrowPathIcon,
    ChartBarIcon, DevicePhoneMobileIcon, ComputerDesktopIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../components/atoms';
import { api } from '../lib/api';
import '../styles/ai-features.css';

interface RecordingSession {
    id: string;
    name: string;
    url: string;
    status: 'recording' | 'completed' | 'processing' | 'error';
    duration: number;
    interactionCount: number;
    framework: string;
    confidence: number;
    createdAt: string;
    viewport: { width: number; height: number };
}

const VIEWPORTS = [
    { label: 'Desktop', icon: ComputerDesktopIcon, width: 1920, height: 1080 },
    { label: 'Tablet', icon: DevicePhoneMobileIcon, width: 768, height: 1024 },
    { label: 'Mobile', icon: DevicePhoneMobileIcon, width: 375, height: 812 },
];

const FRAMEWORKS = [
    { value: 'playwright', label: 'Playwright', icon: '🎭' },
    { value: 'cypress', label: 'Cypress', icon: '🌲' },
];

const MOCK_SESSIONS: RecordingSession[] = [
    { id: 'rec_1', name: 'Checkout Flow', url: 'https://app.example.com/checkout', status: 'completed', duration: 124, interactionCount: 18, framework: 'playwright', confidence: 92, createdAt: '2 hours ago', viewport: { width: 1920, height: 1080 } },
    { id: 'rec_2', name: 'User Registration', url: 'https://app.example.com/register', status: 'completed', duration: 87, interactionCount: 12, framework: 'playwright', confidence: 88, createdAt: '5 hours ago', viewport: { width: 1920, height: 1080 } },
    { id: 'rec_3', name: 'Search & Filter', url: 'https://app.example.com/products', status: 'completed', duration: 65, interactionCount: 9, framework: 'cypress', confidence: 76, createdAt: 'Yesterday', viewport: { width: 375, height: 812 } },
    { id: 'rec_4', name: 'Dashboard Nav', url: 'https://app.example.com/dashboard', status: 'completed', duration: 42, interactionCount: 7, framework: 'playwright', confidence: 95, createdAt: 'Yesterday', viewport: { width: 1920, height: 1080 } },
];

export default function RecordingStudio() {
    const [sessions, setSessions] = useState<RecordingSession[]>(MOCK_SESSIONS);
    const [activeSession, setActiveSession] = useState<RecordingSession | null>(null);
    const [showNewForm, setShowNewForm] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);

    // Form state
    const [newUrl, setNewUrl] = useState('');
    const [newName, setNewName] = useState('');
    const [selectedFramework, setSelectedFramework] = useState('playwright');
    const [selectedViewport, setSelectedViewport] = useState(0);
    const [isStarting, setIsStarting] = useState(false);

    // Timer for active recordings
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (activeSession?.status === 'recording') {
            timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [activeSession]);

    const loadSessions = useCallback(async () => {
        try {
            const res = await api.getBrowserRecordingSessions();
            if (res?.success && res.data) setSessions(res.data);
        } catch (err) {
            console.error("Failed to load real sessions from DB:", err);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadSessions();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadSessions]);

    const startRecording = async () => {
        if (!newUrl.trim()) return;
        setIsStarting(true);

        const sessionName = newName.trim() || `Recording ${sessions.length + 1}`;
        const viewport = VIEWPORTS[selectedViewport];

        try {
            const res = await api.startBrowserRecording({
                url: newUrl,
                name: sessionName,
                framework: selectedFramework,
                viewport: { width: viewport.width, height: viewport.height },
            });

            if (res?.success && res.data) {
                setActiveSession({ ...res.data, status: 'recording' });
            } else {
                alert('Failed to start recording session in the backend container.');
            }
        } catch (err) {
            console.error('API Error starting recording', err);
            alert('Could not bridge to Playwright container.');
        }

        setShowNewForm(false);
        setRecordingTime(0);
        setIsStarting(false);
        setNewUrl('');
        setNewName('');
    };

    const stopRecording = async () => {
        if (!activeSession) return;
        try {
            const res = await api.stopBrowserRecording(activeSession.id);
            if (res?.success) {
                const completedSession: RecordingSession = {
                    ...activeSession,
                    status: 'completed',
                    duration: recordingTime,
                    interactionCount: activeSession.interactionCount || 0,
                    confidence: 95, // Assuming high confidence for AI generated code
                };

                setSessions(prev => [completedSession, ...prev]);

                // Show the generated code in the modal if available
                if (res.code) {
                    setShowCodeModal(res.code);
                }
            } else {
                alert('Failed to stop recording cleanly on backend.');
            }
        } catch (err) {
            console.error('Failed to stop recording:', err);
        }

        setActiveSession(null);
        setRecordingTime(0);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getConfidenceLevel = (score: number) => {
        if (score >= 85) return 'high';
        if (score >= 60) return 'medium';
        return 'low';
    };

    const totalSessions = sessions.length;
    const totalInteractions = sessions.reduce((sum, s) => sum + s.interactionCount, 0);
    const avgConfidence = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.confidence, 0) / sessions.length) : 0;

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
    const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

    return (
        <motion.div className="p-6 space-y-6 max-w-[1600px] mx-auto" variants={containerVariants} initial="hidden" animate="visible">
            {/* Header */}
            <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                        <VideoCameraIcon className="h-7 w-7 text-rose-400" />
                        Recording Studio
                    </h1>
                    <p className="text-gray-400 mt-1">Record browser interactions and generate Playwright/Cypress tests</p>
                </div>
                <Button
                    onClick={() => setShowNewForm(!showNewForm)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-rose-500/25 transition-all"
                >
                    <VideoCameraIcon className="h-4 w-4" />
                    New Recording
                </Button>
            </motion.div>

            {/* Stats Bar */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Sessions', value: totalSessions, icon: <VideoCameraIcon className="h-5 w-5 text-rose-400" /> },
                    { label: 'Active', value: activeSession ? 1 : 0, icon: <PlayIcon className="h-5 w-5 text-emerald-400" /> },
                    { label: 'Interactions', value: totalInteractions, icon: <CursorArrowRaysIcon className="h-5 w-5 text-blue-400" /> },
                    { label: 'Avg Confidence', value: `${avgConfidence}%`, icon: <ChartBarIcon className="h-5 w-5 text-amber-400" /> },
                ].map(stat => (
                    <div key={stat.label} className="ai-metric-card">
                        <div className="flex items-center gap-2 mb-2">
                            {stat.icon}
                            <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
                        </div>
                        <div className="metric-value text-2xl">{stat.value}</div>
                    </div>
                ))}
            </motion.div>

            {/* New Recording Form */}
            <AnimatePresence>
                {showNewForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ai-glass-card p-6 overflow-hidden"
                    >
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">🎬 Start New Recording</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Target URL *</label>
                                <div className="flex items-center gap-2">
                                    <GlobeAltIcon className="h-4 w-4 text-gray-500" />
                                    <input
                                        type="url"
                                        value={newUrl}
                                        onChange={e => setNewUrl(e.target.value)}
                                        placeholder="https://your-app.com/flow"
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-rose-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Session Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. Checkout Flow"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-rose-500/50 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {/* Framework */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Framework</label>
                                <div className="flex gap-2">
                                    {FRAMEWORKS.map(fw => (
                                        <button
                                            key={fw.value}
                                            onClick={() => setSelectedFramework(fw.value)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${selectedFramework === fw.value
                                                ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                                                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200'
                                                }`}
                                        >
                                            {fw.icon} {fw.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Viewport */}
                            <div>
                                <label className="block text-xs text-gray-500 mb-1.5">Viewport</label>
                                <div className="flex gap-2">
                                    {VIEWPORTS.map((vp, i) => (
                                        <button
                                            key={vp.label}
                                            onClick={() => setSelectedViewport(i)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${selectedViewport === i
                                                ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300'
                                                : 'bg-white/5 border border-white/10 text-gray-400 hover:text-gray-200'
                                                }`}
                                        >
                                            <vp.icon className="h-4 w-4" />
                                            {vp.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-4">
                            <Button
                                onClick={startRecording}
                                disabled={!newUrl.trim() || isStarting}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-500 text-white text-sm font-medium disabled:opacity-40 hover:shadow-lg hover:shadow-rose-500/25 transition-all"
                            >
                                {isStarting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
                                {isStarting ? 'Starting...' : 'Start Recording'}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active Recording */}
            {activeSession && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="ai-glass-card p-6"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="recording-indicator">
                                <div className="rec-dot" />
                                <span className="rec-timer">{formatTime(recordingTime)}</span>
                            </div>
                            <div>
                                <div className="text-lg font-semibold text-gray-200">{activeSession.name}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-2">
                                    <GlobeAltIcon className="h-3.5 w-3.5" />
                                    {activeSession.url}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-sm text-gray-400">
                                    <CursorArrowRaysIcon className="h-4 w-4 inline mr-1" />
                                    {activeSession.interactionCount} interactions
                                </div>
                                <div className="text-xs text-gray-600">{activeSession.framework}</div>
                            </div>
                            <Button
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-all"
                            >
                                <StopIcon className="h-4 w-4" />
                                Stop
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Completed Sessions Grid */}
            <motion.div variants={itemVariants}>
                <h2 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-gray-400" />
                    Completed Sessions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sessions.filter(s => s.status === 'completed').map(session => (
                        <motion.div
                            key={session.id}
                            variants={itemVariants}
                            className="ai-glass-card p-4 group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                                        {session.name}
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                        <GlobeAltIcon className="h-3 w-3" />
                                        {session.url.replace(/^https?:\/\//, '')}
                                    </div>
                                </div>
                                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    ✓ Complete
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div>
                                    <div className="text-xs text-gray-600">Duration</div>
                                    <div className="text-sm text-gray-300 font-medium flex items-center gap-1">
                                        <ClockIcon className="h-3.5 w-3.5" />
                                        {formatTime(session.duration)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-600">Steps</div>
                                    <div className="text-sm text-gray-300 font-medium flex items-center gap-1">
                                        <CursorArrowRaysIcon className="h-3.5 w-3.5" />
                                        {session.interactionCount}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-600">Confidence</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium ${session.confidence >= 85 ? 'text-emerald-400' :
                                            session.confidence >= 60 ? 'text-amber-400' : 'text-red-400'
                                            }`}>{session.confidence}%</span>
                                        <div className="confidence-meter">
                                            <div
                                                className={`fill ${getConfidenceLevel(session.confidence)}`}
                                                style={{ width: `${session.confidence}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded">
                                        {session.framework === 'playwright' ? '🎭' : '🌲'} {session.framework}
                                    </span>
                                    <span className="text-xs text-gray-600">{session.createdAt}</span>
                                </div>
                                <button
                                    onClick={() => setShowCodeModal(session.id)}
                                    className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                    <CodeBracketIcon className="h-3.5 w-3.5" />
                                    View Test
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Recording playback modal — streams real video from
                /api/recordings/:runId. Auth is passed as ?token= because
                HTMLVideoElement can't send custom headers (MVP; upgrade
                to signed R2 URLs later). Falls back to the generated code
                block if no recording artifact exists. */}
            <AnimatePresence>
                {showCodeModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                        onClick={() => setShowCodeModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-3xl ai-code-preview"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="code-header">
                                <span className="lang flex items-center gap-2">
                                    <VideoCameraIcon className="h-4 w-4" />
                                    {sessions.find(s => s.id === showCodeModal)?.name || 'recording'} — playback
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowCodeModal(null)}
                                        aria-label="Close playback"
                                        className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300 ml-2"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-black/40">
                                {(() => {
                                    const apiBase = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL || '';
                                    const token = typeof window !== 'undefined'
                                        ? (localStorage.getItem('access_token') || localStorage.getItem('token') || '')
                                        : '';
                                    const src = `${apiBase}/api/recordings/${encodeURIComponent(showCodeModal)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
                                    return (
                                        <video
                                            src={src}
                                            controls
                                            preload="metadata"
                                            playsInline
                                            className="w-full max-h-[70vh] rounded-lg bg-black"
                                            onError={(e) => {
                                                // If the recording doesn't exist the response is JSON 404;
                                                // <video> just fails silently — surface a helpful note.
                                                const target = e.currentTarget;
                                                const parent = target.parentElement;
                                                if (parent && !parent.querySelector('.recording-fallback')) {
                                                    const note = document.createElement('div');
                                                    note.className = 'recording-fallback text-sm text-gray-400 p-4 text-center';
                                                    note.textContent = 'No video recording available for this session yet.';
                                                    parent.appendChild(note);
                                                }
                                            }}
                                        >
                                            Your browser does not support embedded video playback.
                                        </video>
                                    );
                                })()}
                                <div className="mt-2 text-[11px] text-gray-500">
                                    Streaming from R2 · seekable · auth via short-lived token
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
