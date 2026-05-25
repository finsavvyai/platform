/**
 * Visual style constants for chain types.
 * Maps chain slugs to icons, gradients, border colors, and status styles.
 */

export const chainIcons: Record<string, string> = {
    'full-review': '🔍',
    'new-feature': '✨',
    'deploy': '🚀',
    'security-audit': '🛡️',
    'api-design': '🔌',
};

export const chainGradients: Record<string, string> = {
    'full-review': 'from-violet-500/20 to-indigo-500/20',
    'new-feature': 'from-emerald-500/20 to-teal-500/20',
    'deploy': 'from-orange-500/20 to-red-500/20',
    'security-audit': 'from-amber-500/20 to-yellow-500/20',
    'api-design': 'from-blue-500/20 to-cyan-500/20',
};

export const chainBorderColors: Record<string, string> = {
    'full-review': 'border-violet-500/20 hover:border-violet-500/40',
    'new-feature': 'border-emerald-500/20 hover:border-emerald-500/40',
    'deploy': 'border-orange-500/20 hover:border-orange-500/40',
    'security-audit': 'border-amber-500/20 hover:border-amber-500/40',
    'api-design': 'border-blue-500/20 hover:border-blue-500/40',
};

export const statusColors: Record<
    string,
    { bg: string; text: string; dot: string }
> = {
    completed: {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        dot: 'bg-emerald-400',
    },
    running: {
        bg: 'bg-violet-500/10',
        text: 'text-violet-400',
        dot: 'bg-violet-400',
    },
    failed: {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        dot: 'bg-red-400',
    },
};
