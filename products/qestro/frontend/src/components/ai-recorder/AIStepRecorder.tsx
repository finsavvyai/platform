import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Plus,
    Trash2,
    GripVertical,
    Globe,
    Sparkles,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Code,
    Image,
    Copy,
    Download,
    ChevronRight,
    Wand2,
    Eye,
    AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';

interface Step {
    id: string;
    description: string;
}

interface ExecutedStep {
    description: string;
    action: {
        type: string;
        target?: string;
        value?: string;
    };
    selector?: string;
    status: 'success' | 'failed' | 'skipped';
    duration: number;
    error?: string;
}

interface RecordingResult {
    sessionId: string;
    url: string;
    status: string;
    executedSteps: ExecutedStep[];
    generatedCode: string;
    screenshotCount: number;
    errors: Array<{ message: string }>;
    totalDuration: number;
}

export default function AIStepRecorder() {
    const [url, setUrl] = useState('');
    const [steps, setSteps] = useState<Step[]>([
        { id: '1', description: '' }
    ]);
    const [isRecording, setIsRecording] = useState(false);
    const [result, setResult] = useState<RecordingResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'steps' | 'code' | 'screenshots'>('steps');
    const [headless, setHeadless] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Add a new step
    const addStep = useCallback(() => {
        const newStep: Step = {
            id: Date.now().toString(),
            description: '',
        };
        setSteps(prev => [...prev, newStep]);
        // Focus the new input after render
        setTimeout(() => {
            const lastInput = inputRefs.current[steps.length];
            lastInput?.focus();
        }, 100);
    }, [steps.length]);

    // Remove a step
    const removeStep = useCallback((id: string) => {
        setSteps(prev => prev.filter(s => s.id !== id));
    }, []);

    // Update step description
    const updateStep = useCallback((id: string, description: string) => {
        setSteps(prev => prev.map(s =>
            s.id === id ? { ...s, description } : s
        ));
    }, []);

    // Handle Enter key to add new step
    const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (index === steps.length - 1) {
                addStep();
            } else {
                inputRefs.current[index + 1]?.focus();
            }
        }
    }, [steps.length, addStep]);

    // Drag and drop handlers
    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newSteps = [...steps];
        const draggedStep = newSteps[draggedIndex];
        newSteps.splice(draggedIndex, 1);
        newSteps.splice(index, 0, draggedStep);
        setSteps(newSteps);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    // Start recording
    const startRecording = useCallback(async () => {
        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        const validSteps = steps.filter(s => s.description.trim());
        if (validSteps.length === 0) {
            setError('Please add at least one step');
            return;
        }

        setIsRecording(true);
        setError(null);
        setResult(null);

        try {
            const response = await api.quickRecord(
                url,
                validSteps.map(s => s.description),
                { headless, captureScreenshots: true }
            );

            if (response.success) {
                setResult(response.data);
                setActiveTab('code');
            } else {
                setError(response.error || 'Recording failed');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsRecording(false);
        }
    }, [url, steps, headless]);

    // Copy code to clipboard
    const copyCode = useCallback(() => {
        if (result?.generatedCode) {
            navigator.clipboard.writeText(result.generatedCode);
        }
    }, [result]);

    // Download code as file
    const downloadCode = useCallback(() => {
        if (result?.generatedCode) {
            const blob = new Blob([result.generatedCode], { type: 'text/typescript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'recorded-test.spec.ts';
            a.click();
            URL.revokeObjectURL(url);
        }
    }, [result]);

    // Suggested steps for common actions
    const suggestedSteps = [
        "Click the login button",
        "Type 'test@example.com' in the email field",
        "Fill out the password field",
        "Click the submit button",
        "Verify the welcome message appears",
        "Navigate to the dashboard",
        "Click on the user menu",
        "Wait for the page to load",
    ];

    const applySuggestion = (suggestion: string) => {
        const emptyStepIndex = steps.findIndex(s => !s.description.trim());
        if (emptyStepIndex >= 0) {
            updateStep(steps[emptyStepIndex].id, suggestion);
        } else {
            setSteps(prev => [...prev, { id: Date.now().toString(), description: suggestion }]);
        }
    };

    return (
        <div className="min-h-screen bg-bg-primary p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-xl border border-primary/30">
                            <Wand2 className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-bold text-text-primary">AI Step Recorder</h1>
                    </div>
                    <p className="text-text-muted">
                        Define your test steps in plain English. Our AI will record and execute them on any website.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Panel - Input */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-6"
                    >
                        {/* URL Input */}
                        <div className="bg-bg-secondary/50 backdrop-blur-md border border-border rounded-xl p-6">
                            <label className="block text-sm font-medium text-text-primary mb-2">
                                Target URL
                            </label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                                <input
                                    type="url"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    className="w-full pl-12 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-primary/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Steps Input */}
                        <div className="bg-bg-secondary/50 backdrop-blur-md border border-border rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    Test Steps
                                </label>
                                <span className="text-xs text-text-muted">
                                    {steps.filter(s => s.description.trim()).length} steps defined
                                </span>
                            </div>

                            <div className="space-y-3">
                                <AnimatePresence>
                                    {steps.map((step, index) => (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="flex items-center gap-2 group"
                                            draggable
                                            onDragStart={() => handleDragStart(index)}
                                            onDragOver={(e) => handleDragOver(e, index)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <div className="cursor-grab text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                                <GripVertical className="w-4 h-4" />
                                            </div>
                                            <span className="text-xs text-primary font-mono w-6">
                                                {index + 1}.
                                            </span>
                                            <input
                                                ref={el => { inputRefs.current[index] = el; }}
                                                type="text"
                                                value={step.description}
                                                onChange={e => updateStep(step.id, e.target.value)}
                                                onKeyDown={e => handleKeyDown(e, index)}
                                                placeholder="Describe what to do..."
                                                className="flex-1 px-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-primary/50 transition-all text-sm"
                                            />
                                            {steps.length > 1 && (
                                                <button
                                                    onClick={() => removeStep(step.id)}
                                                    className="p-2 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            <button
                                onClick={addStep}
                                className="mt-4 w-full py-2.5 border border-dashed border-white/20 rounded-lg text-text-muted hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Add Step
                            </button>
                        </div>

                        {/* Suggestions */}
                        <div className="bg-bg-secondary/30 backdrop-blur-md border border-border rounded-xl p-4">
                            <label className="text-xs font-medium text-text-muted mb-2 block">
                                Quick Suggestions
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {suggestedSteps.slice(0, 4).map((suggestion, i) => (
                                    <button
                                        key={i}
                                        onClick={() => applySuggestion(suggestion)}
                                        className="px-3 py-1.5 text-xs bg-white/5 hover:bg-primary/10 border border-white/10 hover:border-primary/30 rounded-full text-text-muted hover:text-primary transition-all"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Options */}
                        <div className="flex items-center justify-between bg-bg-secondary/30 backdrop-blur-md border border-border rounded-xl p-4">
                            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={headless}
                                    onChange={e => setHeadless(e.target.checked)}
                                    className="w-4 h-4 rounded bg-black/30 border-white/20 text-primary focus:ring-primary"
                                />
                                <Eye className="w-4 h-4 text-text-muted" />
                                Headless Mode
                                <span className="text-xs text-text-muted">(faster, no browser UI)</span>
                            </label>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
                                >
                                    <AlertCircle className="w-5 h-5 text-red-400" />
                                    <span className="text-red-300 text-sm">{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Start Button */}
                        <button
                            onClick={startRecording}
                            disabled={isRecording}
                            className="w-full py-4 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary/25"
                        >
                            {isRecording ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Recording in Progress...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5" />
                                    Start AI Recording
                                </>
                            )}
                        </button>
                    </motion.div>

                    {/* Right Panel - Results */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="bg-bg-secondary/50 backdrop-blur-md border border-border rounded-xl overflow-hidden h-full">
                            {/* Tabs */}
                            <div className="flex border-b border-white/10">
                                <button
                                    onClick={() => setActiveTab('steps')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${activeTab === 'steps'
                                        ? 'text-primary border-b-2 border-primary bg-primary/5'
                                        : 'text-text-muted hover:text-text-primary'
                                        }`}
                                >
                                    <ChevronRight className="w-4 h-4 inline mr-1" />
                                    Executed Steps
                                </button>
                                <button
                                    onClick={() => setActiveTab('code')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${activeTab === 'code'
                                        ? 'text-primary border-b-2 border-primary bg-primary/5'
                                        : 'text-text-muted hover:text-text-primary'
                                        }`}
                                >
                                    <Code className="w-4 h-4 inline mr-1" />
                                    Generated Code
                                </button>
                                <button
                                    onClick={() => setActiveTab('screenshots')}
                                    className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${activeTab === 'screenshots'
                                        ? 'text-primary border-b-2 border-primary bg-primary/5'
                                        : 'text-text-muted hover:text-text-primary'
                                        }`}
                                >
                                    <Image className="w-4 h-4 inline mr-1" />
                                    Screenshots
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 min-h-[500px]">
                                {!result && !isRecording && (
                                    <div className="h-full flex flex-col items-center justify-center text-center py-16">
                                        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                                            <Wand2 className="w-8 h-8 text-primary/50" />
                                        </div>
                                        <h3 className="text-lg font-medium text-text-primary mb-2">
                                            No Recording Yet
                                        </h3>
                                        <p className="text-text-muted text-sm max-w-xs">
                                            Define your test steps and click "Start AI Recording" to begin
                                        </p>
                                    </div>
                                )}

                                {isRecording && (
                                    <div className="h-full flex flex-col items-center justify-center text-center py-16">
                                        <div className="relative">
                                            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                                                <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                                            </div>
                                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                                        </div>
                                        <h3 className="text-lg font-medium text-text-primary mb-2">
                                            Recording in Progress
                                        </h3>
                                        <p className="text-text-muted text-sm max-w-xs">
                                            AI is executing your steps and recording the results...
                                        </p>
                                    </div>
                                )}

                                {result && !isRecording && (
                                    <AnimatePresence mode="wait">
                                        {activeTab === 'steps' && (
                                            <motion.div
                                                key="steps"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="space-y-3"
                                            >
                                                {/* Summary */}
                                                <div className="grid grid-cols-3 gap-3 mb-6">
                                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                                                        <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                                                        <div className="text-lg font-bold text-emerald-400">
                                                            {result.executedSteps.filter(s => s.status === 'success').length}
                                                        </div>
                                                        <div className="text-xs text-text-muted">Passed</div>
                                                    </div>
                                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                                                        <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
                                                        <div className="text-lg font-bold text-red-400">
                                                            {result.executedSteps.filter(s => s.status === 'failed').length}
                                                        </div>
                                                        <div className="text-xs text-text-muted">Failed</div>
                                                    </div>
                                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                                                        <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                                                        <div className="text-lg font-bold text-blue-400">
                                                            {(result.totalDuration / 1000).toFixed(1)}s
                                                        </div>
                                                        <div className="text-xs text-text-muted">Duration</div>
                                                    </div>
                                                </div>

                                                {/* Step List */}
                                                {result.executedSteps.map((step, i) => (
                                                    <div
                                                        key={i}
                                                        className={`p-4 rounded-lg border ${step.status === 'success'
                                                            ? 'bg-emerald-500/5 border-emerald-500/20'
                                                            : 'bg-red-500/5 border-red-500/20'
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            {step.status === 'success' ? (
                                                                <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                                                            ) : (
                                                                <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                                                            )}
                                                            <div className="flex-1">
                                                                <div className="text-sm text-text-primary font-medium">
                                                                    {step.description}
                                                                </div>
                                                                <div className="text-xs text-text-muted mt-1 flex items-center gap-4">
                                                                    <span className="bg-white/5 px-2 py-0.5 rounded">
                                                                        {step.action.type}
                                                                    </span>
                                                                    {step.selector && (
                                                                        <span className="font-mono truncate max-w-[200px]">
                                                                            {step.selector}
                                                                        </span>
                                                                    )}
                                                                    <span>{step.duration}ms</span>
                                                                </div>
                                                                {step.error && (
                                                                    <div className="text-xs text-red-300 mt-2 bg-red-500/10 p-2 rounded">
                                                                        {step.error}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </motion.div>
                                        )}

                                        {activeTab === 'code' && (
                                            <motion.div
                                                key="code"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <span className="text-sm text-text-muted">
                                                        Generated Playwright Test
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={copyCode}
                                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                            title="Copy to clipboard"
                                                        >
                                                            <Copy className="w-4 h-4 text-text-muted hover:text-primary" />
                                                        </button>
                                                        <button
                                                            onClick={downloadCode}
                                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                            title="Download file"
                                                        >
                                                            <Download className="w-4 h-4 text-text-muted hover:text-primary" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <pre className="bg-black/50 rounded-xl p-4 overflow-x-auto text-sm font-mono text-text-primary border border-white/5">
                                                    <code>{result.generatedCode || 'No code generated'}</code>
                                                </pre>
                                            </motion.div>
                                        )}

                                        {activeTab === 'screenshots' && (
                                            <motion.div
                                                key="screenshots"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="text-center py-8"
                                            >
                                                {result.screenshotCount > 0 ? (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-center gap-2 text-text-muted">
                                                            <Image className="w-5 h-5" />
                                                            <span>{result.screenshotCount} screenshots captured</span>
                                                        </div>
                                                        <p className="text-xs text-text-muted">
                                                            Screenshots are available via the API
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="text-text-muted">
                                                        No screenshots captured
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
