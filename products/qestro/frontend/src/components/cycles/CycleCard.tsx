import { Calendar, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Cycle {
    id: string;
    name: string;
    description?: string;
    status: 'planned' | 'active' | 'completed';
    environment: string;
    startDate: number;
    endDate: number;
    progress: {
        total: number;
        passed: number;
        failed: number;
        blocked: number;
        notRun: number;
    };
}

interface CycleCardProps {
    cycle: Cycle;
    onUpdate: () => void;
}

export default function CycleCard({ cycle }: CycleCardProps) {
    const navigate = useNavigate();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'completed':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    const getEnvironmentColor = (env: string) => {
        switch (env) {
            case 'production':
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'staging':
                return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            default:
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    const progressPercentage = cycle.progress.total > 0
        ? Math.round(((cycle.progress.passed + cycle.progress.failed + cycle.progress.blocked) / cycle.progress.total) * 100)
        : 0;

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <motion.div
            onClick={() => navigate(`/cycles/${cycle.id}`)}
            className="group bg-glass backdrop-blur-md rounded-xl p-6 border border-border hover:border-primary/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all cursor-pointer relative overflow-hidden"
            whileHover={{ y: -2 }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                    <h3 className="text-lg font-semibold text-text-primary group-hover:text-primary transition-colors">
                        {cycle.name}
                    </h3>
                    {cycle.description && (
                        <p className="text-sm text-text-muted mt-1 line-clamp-2">
                            {cycle.description}
                        </p>
                    )}
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(cycle.status)}`}>
                    {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                </div>
            </div>

            {/* Environment Badge */}
            <div className="mb-6">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getEnvironmentColor(cycle.environment)}`}>
                    {cycle.environment.charAt(0).toUpperCase() + cycle.environment.slice(1)}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex items-center justify-between text-xs mb-2 uppercase tracking-wide">
                    <span className="text-text-muted">Progress</span>
                    <span className="text-text-primary font-mono">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                        className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* Test Counts */}
            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-gray-300 font-medium">{cycle.progress.passed} Passed</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-gray-300 font-medium">{cycle.progress.failed} Failed</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-gray-300 font-medium">{cycle.progress.blocked} Blocked</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-gray-300 font-medium">{cycle.progress.notRun} Not Run</span>
                </div>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-2 text-xs text-text-muted pt-4 border-t border-border font-medium">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                    {formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}
                </span>
            </div>

            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </motion.div>
    );
}
