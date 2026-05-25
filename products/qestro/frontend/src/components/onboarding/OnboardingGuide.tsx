/**
 * OnboardingGuide — floating, minimizable checklist.
 *
 * Keeps the existing Qestro "floating guide" footprint but consumes the new
 * Day 1 / Week 1 / Month 1 task catalogue via OnboardingChecklist.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gift, RotateCcw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useOnboarding } from '../../contexts/OnboardingContext';
import type { OnboardingTask } from '../../contexts/OnboardingContext';
import { OnboardingChecklist } from './OnboardingChecklist';

export const OnboardingGuide = () => {
    const [isOpen, setIsOpen] = useState(true);
    const [isMinimized, setIsMinimized] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const {
        tasksByBucket, progress, completedCount, tasks, resetOnboarding, markTaskComplete,
    } = useOnboarding();

    const handleGoToTask = (task: OnboardingTask) => {
        setIsMinimized(true);
        navigate(task.route);
        // Idempotent: re-click is safe; backend upserts by (user, step).
        void markTaskComplete(task.id);
    };

    if (!isOpen || location.pathname === '/recording-studio') return null;

    return (
        <div
            className={cn(
                'fixed bottom-6 right-6 z-50 transition-all duration-300 ease-in-out font-sans',
                isMinimized ? 'w-auto' : 'w-[400px]',
            )}
        >
            <AnimatePresence mode="wait">
                {isMinimized ? (
                    <motion.button
                        key="collapsed"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="border border-border p-4 rounded-full shadow-lg hover:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-shadow group"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                        onClick={() => setIsMinimized(false)}
                        aria-label="Open onboarding checklist"
                    >
                        <div className="relative">
                            <Gift className="text-primary w-6 h-6" />
                            {completedCount < tasks.length && (
                                <span
                                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2"
                                    style={{ borderColor: 'var(--bg-secondary)' }}
                                />
                            )}
                        </div>
                    </motion.button>
                ) : (
                    <motion.div
                        key="expanded"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className="backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--bg-primary) 95%, transparent)' }}
                        role="dialog"
                        aria-label="Qestro onboarding checklist"
                    >
                        <header
                            className="p-5 border-b border-white/5"
                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <Gift className="text-primary w-5 h-5" />
                                    <h3 className="font-bold text-text-primary text-base">Get started with Qestro</h3>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setIsMinimized(true)}
                                        className="text-text-secondary hover:text-text-primary transition-colors p-1 hover:bg-white/5 rounded"
                                        aria-label="Minimize"
                                    >
                                        <div className="w-4 h-0.5 bg-current" />
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="text-text-secondary hover:text-text-primary transition-colors p-1 hover:bg-white/5 rounded"
                                        aria-label="Close onboarding guide"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-text-secondary">
                                    {completedCount}/{tasks.length} tasks completed
                                </p>
                                <button
                                    onClick={() => void resetOnboarding()}
                                    className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
                                    title="Reset onboarding progress"
                                >
                                    <RotateCcw size={12} />
                                    Reset
                                </button>
                            </div>

                            <div
                                className="h-1.5 w-full rounded-full overflow-hidden"
                                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                            >
                                <motion.div
                                    className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{ duration: 0.6 }}
                                />
                            </div>
                        </header>

                        <div className="overflow-y-auto flex-1 p-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            <OnboardingChecklist
                                tasksByBucket={tasksByBucket}
                                onSelectTask={handleGoToTask}
                                variant="compact"
                            />
                        </div>

                        {progress === 100 && (
                            <footer
                                className="p-4 border-t border-white/5 flex items-center gap-2"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 50%, transparent)' }}
                            >
                                <div className="text-amber-400" aria-hidden>✨</div>
                                <p className="text-sm text-text-primary">
                                    You're all set. Nice work getting Qestro wired into your stack.
                                </p>
                            </footer>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
