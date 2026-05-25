// CycleGrid - Grid layout for displaying cycle cards
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import CycleCard from './CycleCard';
import { EmptyState } from '../ui/EmptyState';
import { api } from '../../lib/api';

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

interface CycleGridProps {
    searchTerm: string;
    statusFilter: string;
    environmentFilter: string;
}

interface ApiCycle {
    id: string;
    name: string;
    description?: string;
    status: Cycle['status'];
    startDate: string | number;
    endDate?: string | number;
    totalTests?: number;
    passedTests?: number;
    failedTests?: number;
}

export default function CycleGrid({ searchTerm, statusFilter, environmentFilter }: CycleGridProps) {
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCycles = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.getCycles({
                status: statusFilter !== 'all' ? statusFilter : undefined,
            });
            // Handle the response format: { success: true, data: [...] }
            if (response.success && response.data) {
                // Map API response to component's Cycle interface
                const mappedCycles = (response.data as ApiCycle[]).map((c) => ({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    status: c.status,
                    environment: 'production', // Default environment
                    startDate: new Date(c.startDate).getTime(),
                    endDate: c.endDate ? new Date(c.endDate).getTime() : Date.now(),
                    progress: {
                        total: c.totalTests || 0,
                        passed: c.passedTests || 0,
                        failed: c.failedTests || 0,
                        blocked: 0,
                        notRun: (c.totalTests || 0) - (c.passedTests || 0) - (c.failedTests || 0)
                    }
                }));
                setCycles(mappedCycles);
            } else {
                setCycles([]);
            }
        } catch (error) {
            console.error('Error fetching cycles:', error);
            setCycles([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchCycles();
    }, [fetchCycles]);

    // Filter cycles
    const filteredCycles = cycles.filter((cycle) => {
        const matchesSearch = cycle.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || cycle.status === statusFilter;
        const matchesEnvironment = environmentFilter === 'all' || cycle.environment === environmentFilter;
        return matchesSearch && matchesStatus && matchesEnvironment;
    });

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        className="h-64 bg-white/5 border border-white/5 rounded-xl animate-pulse"
                    />
                ))}
            </div>
        );
    }

    if (filteredCycles.length === 0) {
        return (
            <EmptyState
                title="No test cycles yet"
                description="Create your first test cycle to start organizing test execution"
                actionLabel="Create Cycle"
                onAction={() => window.location.reload()}
            />
        );
    }

    return (
        <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {filteredCycles.map((cycle) => (
                <CycleCard key={cycle.id} cycle={cycle} onUpdate={fetchCycles} />
            ))}
        </motion.div>
    );
}
