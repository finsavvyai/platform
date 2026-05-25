import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChatBubbleLeftRightIcon, SparklesIcon, CheckIcon,
    CodeBracketIcon, DocumentDuplicateIcon, ArrowDownTrayIcon,
    ChevronDownIcon, PaperAirplaneIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { Button } from '../components/atoms';
import { api } from '../lib/api';
import '../styles/ai-features.css';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    options?: string[];
    domainBadge?: string;
}

interface Scenario {
    id: string;
    name: string;
    type: string;
    priority: string;
    steps: string[];
    selected: boolean;
}

interface Session {
    id: string;
    status: string;
    domain: string;
    scenarioCount: number;
    createdAt: string;
}

type IncomingScenario = Omit<Scenario, 'selected'> & Partial<Pick<Scenario, 'selected'>>;
type ConversationHistoryResponse = { success?: boolean; data?: Session[] };
type StartConversationResponse = {
    success?: boolean;
    data?: { domain?: string; sessionId?: string; message?: string; options?: string[] };
};
type AnswerQuestionResponse = {
    success?: boolean;
    data?: { response: string; scenarios?: IncomingScenario[] };
};
type ApproveScenariosResponse = {
    success?: boolean;
    data?: { savedScenarios?: Array<{ testCode?: string; codePreview?: string; generatedCode?: string }> };
};

const DOMAIN_BADGES: Record<string, { label: string; emoji: string; color: string }> = {
    payment: { label: 'Payment', emoji: '💳', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    auth: { label: 'Authentication', emoji: '🔐', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
    checkout: { label: 'Checkout', emoji: '🛒', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
    api: { label: 'API', emoji: '🔌', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
    general: { label: 'General', emoji: '📋', color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
};

const INITIAL_MESSAGES: Message[] = [
    {
        id: 'welcome',
        role: 'assistant',
        content: 'Hi there! I\'m your AI Test Generator. Describe the feature or flow you want to test, and I\'ll create a comprehensive test suite for you. For example:\n\n• "Generate tests for a Stripe payment checkout flow"\n• "I need auth tests for OAuth2 login with Google"\n• "Create API tests for our REST user management endpoints"',
        timestamp: new Date().toISOString(),
    },
];



export default function TestGenStudio() {
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [showCode, setShowCode] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [sessionDomain, setSessionDomain] = useState<string | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeTab, setActiveTab] = useState<'chat' | 'history'>('chat');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const messageSequenceRef = useRef(0);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const nextMessageId = useCallback((prefix: 'u' | 'a' | 'sys') => {
        messageSequenceRef.current += 1;
        return `${prefix}_${messageSequenceRef.current}`;
    }, []);

    const loadSessions = useCallback(async () => {
        try {
            const res = await api.getTestConversations() as ConversationHistoryResponse;
            if (res?.success && res.data) setSessions(res.data);
        } catch {
            // Use empty state when session history cannot be loaded.
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadSessions();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadSessions]);

    const sendMessage = async () => {
        if (!input.trim()) return;
        const userMsg: Message = {
            id: nextMessageId('u'),
            role: 'user',
            content: input,
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const res = await api.startTestConversation(input) as StartConversationResponse;
            setIsTyping(false);

            if (res?.success && res.data) {
                const domain = res.data.domain || 'general';
                setSessionDomain(domain);
                setCurrentSessionId(res.data.sessionId);

                const assistantMsg: Message = {
                    id: nextMessageId('a'),
                    role: 'assistant',
                    content: res.data.message || 'I detected your testing domain.',
                    timestamp: new Date().toISOString(),
                    options: res.data.options,
                    domainBadge: domain,
                };
                setMessages(prev => [...prev, assistantMsg]);
            }
        } catch {
            setIsTyping(false);
            const errorMsg: Message = {
                id: nextMessageId('sys'),
                role: 'system',
                content: 'Unable to reach Test Generator backend. Mock fallback is disabled; please retry or check API availability.',
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
            console.error("Failed to start conversation against real backend.");
        }
    };

    const handleOptionClick = async (option: string) => {
        setInput(option);

        const msg: Message = {
            id: nextMessageId('u'),
            role: 'user',
            content: option,
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, msg]);
        setIsTyping(true);
        setInput('');

        if (currentSessionId) {
            try {
                const res = await api.answerTestGenQuestions(currentSessionId, { selection: option }) as AnswerQuestionResponse;
                setIsTyping(false);
                if (res?.success && res.data) {
                    const aiMsg: Message = {
                        id: nextMessageId('a'),
                        role: 'assistant',
                        content: res.data.response,
                        timestamp: new Date().toISOString(),
                    };
                    setMessages(prev => [...prev, aiMsg]);
                    if (res.data.scenarios) {
                        setScenarios(
                            (res.data.scenarios as IncomingScenario[]).map((scenario: IncomingScenario) => ({
                                ...scenario,
                                selected: true,
                            }))
                        );
                    }
                }
            } catch {
                setIsTyping(false);
                const errorMsg: Message = {
                    id: nextMessageId('sys'),
                    role: 'system',
                    content: 'Failed to continue the conversation because the backend request failed.',
                    timestamp: new Date().toISOString(),
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        }
    };

    const handleApprove = async () => {
        const selectedScenarios = scenarios.filter(s => s.selected);
        const selectedIds = selectedScenarios.map(s => s.id);

        if (currentSessionId) {
            try {
                const res = await api.approveTestScenarios(currentSessionId, selectedIds) as ApproveScenariosResponse;
                if (res?.success && res.data?.savedScenarios?.length > 0) {
                    // Extract code from the first scenario for preview
                    const firstCode = res.data.savedScenarios[0].testCode || res.data.savedScenarios[0].codePreview || res.data.savedScenarios[0].generatedCode;
                    setShowCode(true);
                    setGeneratedCode(firstCode || '// Code generated successfully');

                    const sysMsg: Message = {
                        id: nextMessageId('sys'),
                        role: 'system',
                        content: `✅ Generated and saved Playwright code for ${selectedScenarios.length} scenarios to the D1 Database.`,
                        timestamp: new Date().toISOString(),
                    };
                    setMessages(prev => [...prev, sysMsg]);
                }
            } catch (e) {
                console.error('Failed to approve scenarios', e);
                const errorMsg: Message = {
                    id: nextMessageId('sys'),
                    role: 'system',
                    content: 'Could not save approved scenarios. Please retry once backend connectivity is restored.',
                    timestamp: new Date().toISOString(),
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        }
    };

    const toggleScenario = (id: string) => {
        setScenarios(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
    };

    const downloadCode = () => {
        if (!generatedCode) return;
        const filename = sessionDomain
            ? `${sessionDomain}.spec.ts`
            : 'playwright.test.ts';
        const blob = new Blob([generatedCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(generatedCode);
    };

    const getTypeLabel = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-100px)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <ChatBubbleLeftRightIcon className="h-7 w-7 text-violet-400" />
                    <h1 className="text-2xl font-bold text-gray-100">Test Generator Studio</h1>
                    {sessionDomain && (
                        <span className={`text-xs px-3 py-1 rounded-full border ${DOMAIN_BADGES[sessionDomain]?.color || 'text-gray-400'}`}>
                            {DOMAIN_BADGES[sessionDomain]?.emoji} {DOMAIN_BADGES[sessionDomain]?.label}
                        </span>
                    )}
                </div>
            </div>

            {/* Split Layout */}
            <div className="ai-split-layout">
                {/* Left: Chat Panel */}
                <div className="flex flex-col ai-glass-card overflow-hidden">
                    {/* Chat Tabs */}
                    <div className="flex border-b border-white/5">
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'chat' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            💬 Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            📜 History ({sessions.length})
                        </button>
                    </div>

                    {activeTab === 'chat' ? (
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <AnimatePresence>
                                    {messages.map(msg => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
                                        >
                                            <div className={`chat-bubble ${msg.role}`}>
                                                {msg.domainBadge && (
                                                    <div className="mb-2">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${DOMAIN_BADGES[msg.domainBadge]?.color}`}>
                                                            {DOMAIN_BADGES[msg.domainBadge]?.emoji} {DOMAIN_BADGES[msg.domainBadge]?.label} detected
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="whitespace-pre-wrap">
                                                    {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) =>
                                                        part.startsWith('**') && part.endsWith('**')
                                                            ? <strong key={i}>{part.slice(2, -2)}</strong>
                                                            : part
                                                    )}
                                                </div>
                                                {msg.options && (
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        {msg.options.map(opt => (
                                                            <button
                                                                key={opt}
                                                                onClick={() => handleOptionClick(opt)}
                                                                className="option-pill"
                                                            >
                                                                {opt}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {isTyping && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                                        <div className="chat-bubble assistant">
                                            <div className="typing-indicator">
                                                <div className="dot" /><div className="dot" /><div className="dot" />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 border-t border-white/5">
                                <div className="flex gap-2">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                        placeholder="Describe the tests you need..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-200 text-sm placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                                    />
                                    <Button
                                        onClick={sendMessage}
                                        disabled={!input.trim()}
                                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white text-sm font-medium disabled:opacity-40 hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                                    >
                                        <PaperAirplaneIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* History Tab */
                        <div className="flex-1 overflow-y-auto p-4">
                            {sessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <ClockIcon className="h-12 w-12 mb-3 opacity-30" />
                                    <p className="text-sm">No previous sessions</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {sessions.map(s => (
                                        <div key={s.id} className="p-3 rounded-lg bg-white/3 hover:bg-white/5 cursor-pointer transition-colors">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-300">{s.domain}</span>
                                                <span className="text-xs text-gray-600">{s.scenarioCount} scenarios</span>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">{s.createdAt}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Scenarios + Code Panel */}
                <div className="flex flex-col gap-4 overflow-hidden">
                    {/* Scenarios */}
                    <div className="flex-1 ai-glass-card overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-white/5">
                            <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                                <SparklesIcon className="h-4 w-4 text-violet-400" />
                                Generated Scenarios ({scenarios.length})
                            </h3>
                            {scenarios.length > 0 && (
                                <Button
                                    onClick={handleApprove}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all"
                                >
                                    <CheckIcon className="h-3.5 w-3.5" />
                                    Approve ({scenarios.filter(s => s.selected).length})
                                </Button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {scenarios.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <SparklesIcon className="h-12 w-12 mb-3 opacity-20" />
                                    <p className="text-sm">Scenarios will appear here</p>
                                    <p className="text-xs text-gray-600 mt-1">Start a conversation to generate tests</p>
                                </div>
                            ) : (
                                scenarios.map(scenario => (
                                    <motion.div
                                        key={scenario.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className={`rounded-xl border transition-all cursor-pointer ${scenario.selected
                                            ? 'bg-white/5 border-violet-500/30'
                                            : 'bg-white/2 border-white/5 opacity-60'
                                            }`}
                                    >
                                        <div
                                            className="flex items-center gap-3 p-3"
                                            onClick={() => toggleScenario(scenario.id)}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={scenario.selected}
                                                onChange={() => toggleScenario(scenario.id)}
                                                className="rounded border-gray-600 bg-transparent text-violet-500 focus:ring-violet-500 h-4 w-4"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-200">{scenario.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`type-badge ${scenario.type}`}>{getTypeLabel(scenario.type)}</span>
                                                    <span className={`severity-badge ${scenario.priority}`}>{scenario.priority}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={e => { e.stopPropagation(); setExpandedScenario(expandedScenario === scenario.id ? null : scenario.id); }}
                                                className="p-1"
                                            >
                                                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform ${expandedScenario === scenario.id ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                        <AnimatePresence>
                                            {expandedScenario === scenario.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="px-3 pb-3 overflow-hidden"
                                                >
                                                    <div className="pl-7 space-y-1">
                                                        {scenario.steps.map((step, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                                                <span className="text-gray-600">{i + 1}.</span> {step}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Code Preview */}
                    {showCode && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="ai-code-preview max-h-[300px] flex flex-col"
                        >
                            <div className="code-header">
                                <span className="lang flex items-center gap-2">
                                    <CodeBracketIcon className="h-4 w-4" />
                                    playwright.test.ts
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={copyCode}
                                        aria-label="Copy generated code"
                                        className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300"
                                    >
                                        <DocumentDuplicateIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={downloadCode}
                                        aria-label="Download generated code"
                                        className="p-1 rounded hover:bg-white/10 transition-colors text-gray-500 hover:text-gray-300"
                                    >
                                        <ArrowDownTrayIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <pre className="flex-1 overflow-auto">{generatedCode}</pre>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
