/**
 * OnboardingWidget — dashboard card variant.
 *
 * Structure follows the luna-os dashboard Onboarding widget. Shows aggregate
 * progress + the current Day 1 bucket inline, with "Show more" to expand into
 * the full Week 1 / Month 1 checklist. Mounted at the top of Dashboard.tsx.
 *
 * Hides itself once Day 1 is complete AND the user has dismissed the widget,
 * so it doesn't clutter returning dashboards. Reset via the floating guide.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card } from '../atoms';
import { useOnboarding } from '../../contexts/OnboardingContext';
import type { OnboardingTask } from '../../contexts/OnboardingContext';
import { OnboardingChecklist } from './OnboardingChecklist';

const DISMISSED_KEY = 'qestro_onboarding_widget_dismissed_v2';

export const OnboardingWidget = () => {
    const navigate = useNavigate();
    const {
        tasksByBucket, progress, completedCount, tasks, day1Done, markTaskComplete, isLoaded,
    } = useOnboarding();

    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState<boolean>(() => {
        try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
    });

    const handleSelectTask = (task: OnboardingTask) => {
        navigate(task.route);
        void markTaskComplete(task.id);
    };

    const handleDismiss = () => {
        setDismissed(true);
        try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
    };

    // Hide entirely when the user has finished everything, or when Day 1 is
    // done AND they've dismissed the follow-on tasks. Still render while the
    // context is hydrating so the layout doesn't flicker.
    const shouldHide = useMemo(() => {
        if (!isLoaded) return false;
        if (completedCount === tasks.length) return true;
        if (day1Done && dismissed) return true;
        return false;
    }, [isLoaded, completedCount, tasks.length, day1Done, dismissed]);

    if (shouldHide) return null;

    const day1Items = tasksByBucket.day1;
    const followOnBuckets = { day1: [], week1: tasksByBucket.week1, month1: tasksByBucket.month1 };

    return (
        <Card className="p-6 mb-6 border-primary/20 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-800/30">
            <div className="flex items-start justify-between mb-4 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h2 className="text-lg font-semibold text-text-primary">Welcome to Qestro</h2>
                    </div>
                    <p className="text-sm text-text-secondary">
                        {day1Done
                            ? 'Day 1 is done. Keep the momentum going with Week 1.'
                            : 'Get to your first green test run. Four steps, under fifteen minutes.'}
                    </p>
                </div>
                {day1Done && (
                    <button
                        onClick={handleDismiss}
                        className="text-text-secondary hover:text-text-primary transition-colors p-1 hover:bg-white/5 rounded"
                        aria-label="Dismiss onboarding widget"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6 }}
                    />
                </div>
                <span className="text-xs text-text-secondary tabular-nums">
                    {completedCount}/{tasks.length}
                </span>
            </div>

            {!day1Done && (
                <OnboardingChecklist
                    tasksByBucket={{ day1: day1Items, week1: [], month1: [] }}
                    onSelectTask={handleSelectTask}
                    variant="roomy"
                />
            )}

            {expanded && (
                <div className="mt-2">
                    <OnboardingChecklist
                        tasksByBucket={followOnBuckets}
                        onSelectTask={handleSelectTask}
                        variant="roomy"
                    />
                </div>
            )}

            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
            >
                {expanded ? (
                    <>
                        <ChevronUp size={14} />
                        Hide Week 1 &amp; Month 1
                    </>
                ) : (
                    <>
                        <ChevronDown size={14} />
                        {day1Done ? 'Show the rest' : 'Show Week 1 &amp; Month 1'}
                    </>
                )}
            </button>
        </Card>
    );
};
