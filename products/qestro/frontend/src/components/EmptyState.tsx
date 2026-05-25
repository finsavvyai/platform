import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { Button } from './atoms/Button/Button';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center"
        >
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
                <div className="relative w-24 h-24 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center">
                    <Icon className="w-12 h-12 text-gray-500" strokeWidth={1.5} />
                </div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
            <p className="text-gray-400 max-w-md mb-8 leading-relaxed">{description}</p>

            {actionLabel && onAction && (
                <Button
                    variant="neon"
                    glow
                    onClick={onAction}
                    className="px-8"
                >
                    {actionLabel}
                </Button>
            )}
        </motion.div>
    );
};
