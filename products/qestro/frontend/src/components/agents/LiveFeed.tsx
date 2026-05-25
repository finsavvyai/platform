import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Zap, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface LogEntry {
    id: string;
    agent: string;
    message: string;
    timestamp: string;
    type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING' | 'SYSTEM' | 'NETWORK';
    screenshot?: string;
}

const INITIAL_LOGS: LogEntry[] = [
    { id: '1', agent: 'System', message: 'Live Feed connection established', timestamp: 'Now', type: 'SYSTEM' },
    { id: '2', agent: 'QA Architect', message: 'Ingesting 5 new tickets from Jira...', timestamp: '10s ago', type: 'INFO' },
    { id: '3', agent: 'The Scout', message: 'Discovered new route: /onboarding/step-2', timestamp: '12s ago', type: 'SUCCESS' },
];

type EventTemplate = Pick<LogEntry, 'agent' | 'message' | 'type' | 'screenshot'>;

const LiveFeed = () => {
    const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Simulation Interval
        const interval = setInterval(() => {
            const possibleEvents: EventTemplate[] = [
                { agent: 'The Novice', message: 'Clicked "Sign Up" button', type: 'INFO' },
                { agent: 'The Hacker', message: 'Attempting SQL Injection on login field', type: 'WARNING' },
                { agent: 'The Scout', message: 'Mapping DOM tree for /dashboard', type: 'INFO' },
                { agent: 'System', message: 'Auto-scaling agent pool to 15 workers', type: 'SYSTEM' },
                { agent: 'Visual Eye', message: 'Regression detected in Navbar component', type: 'ERROR', screenshot: 'navbar_diff.png' },
                { agent: 'Network Spy', message: 'POST /api/v1/user 200 OK (45ms)', type: 'NETWORK' }
            ];

            const randomEvent = possibleEvents[Math.floor(Math.random() * possibleEvents.length)];
            const newLog: LogEntry = {
                id: Math.random().toString(36).substr(2, 9),
                agent: randomEvent.agent,
                message: randomEvent.message,
                timestamp: new Date().toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 }),
                type: randomEvent.type,
                screenshot: randomEvent.screenshot
            };

            setLogs(prev => {
                const updated = [...prev, newLog];
                if (updated.length > 50) return updated.slice(-50);
                return updated;
            });

        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="flex flex-col h-full bg-[#0a0b14] rounded-xl border border-white/10 overflow-hidden font-mono text-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-2 text-gray-300">
                    <Terminal size={14} className="text-primary" />
                    <span className="font-semibold tracking-wider">LIVE OPERATIONS FEED</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-900/20 text-green-400 rounded text-[10px] border border-green-500/20 animate-pulse">
                        <Zap size={10} fill="currentColor" /> LIVE
                    </span>
                    <span className="text-xs text-gray-500">12 Agents Active</span>
                </div>
            </div>

            {/* Log Stream */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <AnimatePresence initial={false}>
                    {logs.map((log) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="group flex gap-3 text-gray-300 hover:bg-white/5 p-1.5 rounded transition-colors"
                        >
                            {/* Timestamp */}
                            <span className="text-gray-600 w-20 shrink-0 text-xs mt-0.5 font-light">{log.timestamp}</span>

                            {/* Agent */}
                            <span className={`w-28 shrink-0 text-xs mt-0.5 font-bold truncate ${log.agent === 'System' ? 'text-gray-500' :
                                    log.agent === 'The Hacker' ? 'text-red-400' :
                                        log.agent === 'The Scout' ? 'text-emerald-400' :
                                            log.agent === 'Visual Eye' ? 'text-purple-400' :
                                                'text-blue-400'
                                }`}>
                                {log.agent}
                            </span>

                            {/* Message */}
                            <div className="flex-1 space-y-2">
                                <span className={`${log.type === 'ERROR' ? 'text-red-400' :
                                        log.type === 'WARNING' ? 'text-orange-400' :
                                            log.type === 'SUCCESS' ? 'text-green-400' :
                                                log.type === 'SYSTEM' ? 'text-gray-500 italic' :
                                                    'text-gray-300'
                                    }`}>
                                    {log.message}
                                </span>

                                {/* Simulated Screenshot Preview */}
                                {log.screenshot && (
                                    <div className="flex items-center gap-2 mt-1 p-2 bg-black/40 rounded border border-white/10 w-fit cursor-pointer hover:border-primary/50 transition-colors">
                                        <ImageIcon size={14} className="text-gray-400" />
                                        <span className="text-xs text-gray-400 underline decoration-dotted">{log.screenshot}</span>
                                        <ExternalLink size={10} className="text-gray-600" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default LiveFeed;
