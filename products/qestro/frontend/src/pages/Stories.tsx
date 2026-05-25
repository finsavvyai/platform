import { useState } from 'react';
import { Sparkles, Send, FileText, Check, Copy, RefreshCw, Wand2 } from 'lucide-react';
import { Card, Button } from '../components/atoms';
import { motion, AnimatePresence } from 'framer-motion';
import { aiCore } from '../lib/ai-core';
import type { AIResponse } from '../lib/ai-core';

const Stories = () => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedStory, setGeneratedStory] = useState<AIResponse | null>(null);

    // Stories page is AI-powered and works for all projects
    // No empty state needed - it's a tool, not data storage

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const result = await aiCore.generateTestStory({ featureDescription: prompt });
            setGeneratedStory(result);
        } catch (error) {
            console.error('Generation failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-5xl h-[calc(100vh-100px)] flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-white font-mono flex items-center gap-3">
                    <Wand2 className="text-secondary" size={32} />
                    TEST STORY AI
                </h1>
                <p className="text-gray-400">Transform requirements into executable test scenarios instantly.</p>
            </div>

            {/* Input Section */}
            <Card variant="glass" className="p-6 relative overflow-hidden transition-all focus-within:border-primary/50 focus-within:shadow-neon">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Sparkles size={120} />
                </div>

                <div className="flex flex-col gap-4 relative z-10">
                    <label className="text-sm font-semibold text-gray-300">Describe the feature or user flow:</label>
                    <textarea
                        className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-primary/50 transition-colors placeholder:text-gray-600 font-mono text-sm"
                        placeholder="e.g. As a new user, I want to sign up using Google OAuth so that I can access the dashboard immediately..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                            <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 border border-white/5 cursor-pointer hover:bg-white/10">Login Flow</span>
                            <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 border border-white/5 cursor-pointer hover:bg-white/10">Payment Checkout</span>
                            <span className="text-xs px-2 py-1 rounded bg-white/5 text-gray-400 border border-white/5 cursor-pointer hover:bg-white/10">API Validation</span>
                        </div>
                        <Button
                            variant="neon"
                            glow
                            disabled={isGenerating || !prompt}
                            onClick={handleGenerate}
                            rightIcon={isGenerating ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                        >
                            {isGenerating ? 'Dreaming...' : 'Generate Story'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Output Section */}
            <AnimatePresence>
                {generatedStory && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="flex-1 flex flex-col min-h-0"
                    >
                        <Card variant="holographic" className="flex-1 flex flex-col overflow-hidden border-primary/30" padding="none">
                            <div className="bg-black/30 p-4 border-b border-white/10 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <FileText size={18} className="text-primary" />
                                    <span className="font-bold text-white">GENERATED SCENARIOS</span>
                                    <span className="text-xs text-gray-500 ml-2">Confidence: {(generatedStory.confidence * 100).toFixed(0)}%</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" leftIcon={<Copy size={16} />}>Copy</Button>
                                    <Button variant="outline" size="sm" leftIcon={<Check size={16} />}>Save as Test Plan</Button>
                                    <Button variant="primary" size="sm" leftIcon={<Send size={16} />}>Run Now</Button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 bg-black/20">
                                <pre className="font-mono text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                                    {generatedStory.content}
                                </pre>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State / Placeholder */}
            {!generatedStory && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50">
                    <Wand2 size={64} className="mb-4" />
                    <p className="text-lg">AI is ready to generate.</p>
                </div>
            )}
        </div>
    );
};

export default Stories;
