// Cycles Page - Main page for Test Cycles management
import { useState } from 'react';
import { Filter, Search, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import CycleGrid from '../components/cycles/CycleGrid';
import NewCycleModal from '../components/cycles/NewCycleModal';
import { Button } from '../components/atoms';
import { useProject } from '../contexts/ProjectContext';
import { EmptyState } from '../components/EmptyState';

export default function Cycles() {
    const { currentProject } = useProject();
    const [showNewModal, setShowNewModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [environmentFilter, setEnvironmentFilter] = useState<string>('all');

    if (currentProject?.id === '1') {
        return (
            <div className="p-6">
                <EmptyState
                    icon={Filter}
                    title="No Test Cycles Yet"
                    description="Create test cycles to organize and track your testing efforts across sprints and releases."
                    actionLabel="Create Cycle"
                    onAction={() => setShowNewModal(true)}
                />
                <NewCycleModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} />
            </div>
        );
    }
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    return (
        <div className="min-h-screen bg-bg-primary p-8">
            <motion.div
                className="max-w-7xl mx-auto space-y-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Test Cycles</h1>
                        <p className="text-text-muted">Manage and execute test cycles across environments.</p>
                    </div>
                    <Button
                        variant="neon"
                        glow
                        leftIcon={<Plus size={16} />}
                        onClick={() => setShowNewModal(true)}
                    >
                        New Cycle
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center bg-bg-secondary/50 backdrop-blur-md p-4 rounded-xl border border-border">
                    {/* Search */}
                    <div className="flex-1 min-w-[300px] relative group">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search cycles..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-text-secondary" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2.5 bg-white/5 border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer hover:bg-white/10"
                        >
                            <option value="all">All Status</option>
                            <option value="planned">Planned</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    {/* Environment Filter */}
                    <div>
                        <select
                            value={environmentFilter}
                            onChange={(e) => setEnvironmentFilter(e.target.value)}
                            className="px-4 py-2.5 bg-white/5 border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer hover:bg-white/10"
                        >
                            <option value="all">All Environments</option>
                            <option value="dev">Development</option>
                            <option value="staging">Staging</option>
                            <option value="production">Production</option>
                        </select>
                    </div>
                </div>

                {/* Cycle Grid */}
                <CycleGrid
                    searchTerm={searchTerm}
                    statusFilter={statusFilter}
                    environmentFilter={environmentFilter}
                />

                {/* New Cycle Modal */}
                {showNewModal && (
                    <NewCycleModal
                        isOpen={showNewModal}
                        onClose={() => setShowNewModal(false)}
                    />
                )}
            </motion.div>
        </div>
    );
}
