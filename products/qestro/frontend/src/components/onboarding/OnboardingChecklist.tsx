/**
 * OnboardingChecklist — bucketed task list rendered inside panels/widgets.
 * Shared between the floating OnboardingGuide and the dashboard widget.
 */
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { OnboardingBucket, OnboardingTask } from '../../contexts/OnboardingContext';
import { BUCKET_LABELS } from '../../contexts/onboarding/tasks';

const BUCKET_ORDER: OnboardingBucket[] = ['day1', 'week1', 'month1'];

interface Props {
    tasksByBucket: Record<OnboardingBucket, OnboardingTask[]>;
    onSelectTask: (task: OnboardingTask) => void;
    /** Visually compact (used in the floating guide) vs. airy (dashboard widget) */
    variant?: 'compact' | 'roomy';
}

export const OnboardingChecklist = ({ tasksByBucket, onSelectTask, variant = 'compact' }: Props) => {
    return (
        <div className={cn('space-y-4', variant === 'roomy' && 'space-y-5')}>
            {BUCKET_ORDER.map((bucket) => {
                const items = tasksByBucket[bucket];
                if (items.length === 0) return null;
                const bucketDone = items.filter((t) => t.completed).length;

                return (
                    <section key={bucket} aria-labelledby={`bucket-${bucket}`}>
                        <div className="flex items-center justify-between px-1 mb-2">
                            <h4
                                id={`bucket-${bucket}`}
                                className="text-xs font-semibold uppercase tracking-wider text-text-muted"
                            >
                                {BUCKET_LABELS[bucket]}
                            </h4>
                            <span className="text-[10px] text-text-muted">
                                {bucketDone}/{items.length}
                            </span>
                        </div>
                        <ul className="space-y-1">
                            {items.map((task) => (
                                <li key={task.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelectTask(task)}
                                        className={cn(
                                            'w-full text-left flex items-start gap-3 rounded-lg transition-all group',
                                            variant === 'roomy' ? 'p-3' : 'p-2.5',
                                            task.completed ? 'opacity-60' : 'hover:bg-white/5 cursor-pointer',
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors',
                                                task.completed
                                                    ? 'bg-emerald-500 border-emerald-500 text-black'
                                                    : 'border-border group-hover:border-primary',
                                            )}
                                            aria-hidden
                                        >
                                            {task.completed && <Check size={12} strokeWidth={3} />}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span
                                                className={cn(
                                                    'block text-sm font-medium transition-colors',
                                                    variant === 'compact' ? 'truncate' : '',
                                                    task.completed
                                                        ? 'text-text-muted line-through'
                                                        : 'text-text-primary',
                                                )}
                                            >
                                                {task.title}
                                            </span>
                                            <span
                                                className={cn(
                                                    'block text-xs text-text-secondary mt-0.5',
                                                    variant === 'compact' ? 'line-clamp-2' : '',
                                                )}
                                            >
                                                {task.description}
                                            </span>
                                            {!task.completed && (
                                                <span className="block text-xs text-primary mt-1 font-medium">
                                                    {task.cta} →
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
};
