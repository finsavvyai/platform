import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Folder, MoreHorizontal, Calendar, FileText, Users, Building, Filter, Loader2, Download, Share2, PlusCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs } from '../components/atoms/Tabs/Tabs';
import { Button } from '../components/atoms';
import { useProject } from '../contexts/ProjectContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import { EmptyState } from '../components/EmptyState';
import NewTestPlanModal from '../components/modals/NewTestPlanModal';
import { api } from '../lib/api';

interface TestPlan {
    id: string;
    displayId?: string | null;
    name: string;
    description: string;
    testCases: number;
    progress: number;
    status: string;
    dueDate: string;
}

interface ApiTestPlan {
    id: string;
    displayId?: string | null;
    display_id?: string | null;
    name: string;
    description?: string;
    testCaseCount?: number;
    coverage?: number;
    status?: 'active' | 'draft' | 'completed';
    lastRun?: string;
}

const fallbackTestPlans: TestPlan[] = [
    {
        id: 'PLAN-101',
        name: 'Checkout Regression Pack',
        description: 'Core checkout and payment coverage for the current release candidate.',
        testCases: 18,
        progress: 84,
        status: 'Active',
        dueDate: 'Apr 10',
    },
    {
        id: 'PLAN-102',
        name: 'Identity and Access Verification',
        description: 'SSO, session expiry, and credential recovery coverage.',
        testCases: 12,
        progress: 66,
        status: 'Planned',
        dueDate: 'Apr 14',
    },
];

// Test Plans Page - Management of test plans and suite
const TestPlans = () => {
    const { currentProject } = useProject();
    const { markTaskComplete } = useOnboarding();
    const [showNewModal, setShowNewModal] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [testPlans, setTestPlans] = useState<TestPlan[]>([]);
    // Kebab-menu state: which card's menu is open (null = none).
    const [openMenuPlanId, setOpenMenuPlanId] = useState<string | null>(null);

    // Action handlers for onboarding tasks. Post-rewrite the onboarding
    // catalogue no longer has plan-component/export-specific steps, so these
    // actions don't tick anything off (sharing a plan still ticks the
    // "invite a teammate" collaboration step).
    const handleAddComponent = (planId: string) => {
        // In real app, this would open a modal to add components
        console.log(`Adding component to plan ${planId}`);
        alert('Component added to test plan!');
    };

    const handleExportPdf = (planId: string, planName: string) => {
        // In real app, this would trigger actual PDF export
        console.log(`Exporting plan ${planId} to PDF`);
        alert(`${planName} exported to PDF!`);
    };

    const handleSharePlan = (planId: string, planName: string) => {
        const shareUrl = `${window.location.origin}/plans/${planId}/share`;
        navigator.clipboard.writeText(shareUrl);
        markTaskComplete('invite_teammate');
        alert(`Share link for "${planName}" copied to clipboard!\n${shareUrl}`);
    };

    const fetchTestPlans = useCallback(async () => {
        try {
            const status = statusFilter !== 'all' ? statusFilter.toLowerCase() : undefined;
            const response = await api.getTestPlans({ status }) as Record<string, any>;
            if (response.success && response.data) {
                const mappedPlans = (response.data as ApiTestPlan[]).map((p: ApiTestPlan) => ({
                    id: p.id,
                    displayId: p.displayId ?? p.display_id ?? null,
                    name: p.name,
                    description: p.description || '',
                    testCases: p.testCaseCount || 0,
                    progress: p.coverage || 0,
                    status: p.status === 'active' ? 'Active' : p.status === 'draft' ? 'Planned' : 'Completed',
                    dueDate: p.lastRun || 'Not run yet'
                }));
                setTestPlans(mappedPlans);
            }
        } catch (error) {
            console.warn('Test plans API unavailable, using fallback plans', error);
            setTestPlans(fallbackTestPlans);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchTestPlans();
    }, [fetchTestPlans]);

    // Close the kebab menu when clicking outside any [role="menu"] / its trigger.
    useEffect(() => {
        if (!openMenuPlanId) return;
        const onDocClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target?.closest('[role="menu"], [aria-haspopup="menu"]')) {
                setOpenMenuPlanId(null);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [openMenuPlanId]);

    const handleDuplicatePlan = async (plan: TestPlan) => {
        setOpenMenuPlanId(null);
        try {
            await api.createTestPlan({
                name: `${plan.name} (copy)`,
                description: plan.description,
                status: 'draft',
            });
            await fetchTestPlans();
        } catch (error) {
            console.error('Duplicate plan failed:', error);
            alert('Could not duplicate plan. Please try again.');
        }
    };

    const handleDeletePlan = async (plan: TestPlan) => {
        setOpenMenuPlanId(null);
        const confirmed = window.confirm(`Delete test plan "${plan.name}"?`);
        if (!confirmed) return;
        const previous = testPlans;
        setTestPlans(prev => prev.filter(p => p.id !== plan.id));
        try {
            await api.deleteTestPlan(plan.id);
        } catch (error) {
            console.error('Delete plan failed:', error);
            setTestPlans(previous);
            alert('Could not delete plan. Please try again.');
        }
    };

    // Show loading state
    if (loading) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-gray-400">Loading test plans...</p>
                </div>
            </div>
        );
    }

    // Show empty state for production project
    if (currentProject?.id === '1') {
        return (
            <div className="p-6">
                <EmptyState
                    icon={Folder}
                    title="No Test Plans Yet"
                    description="Organize your test cases into plans and suites to streamline your testing workflow."
                    actionLabel="Create Test Plan"
                    onAction={() => setShowNewModal(true)}
                />
            </div>
        );
    }

    const tabs = [
        { id: 'all', label: 'All Templates', icon: <FileText size={16} />, count: testPlans.length },
        { id: 'team', label: 'Made by Team', icon: <Users size={16} />, count: testPlans.filter(p => p.status === 'Active').length },
        { id: 'testquality', label: 'By TestQuality', icon: <Building size={16} />, count: testPlans.filter(p => p.status === 'Completed').length }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="min-h-screen bg-bg-primary p-8">
            <motion.div
                className="max-w-7xl mx-auto space-y-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center bg-bg-secondary/50 backdrop-blur-md p-4 rounded-xl border border-border">
                    {/* Search */}
                    <div className="flex-1 min-w-[300px] relative group">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search test plans..."
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
                            <option value="all">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Completed">Completed</option>
                            <option value="Planned">Planned</option>
                            <option value="On Hold">On Hold</option>
                        </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <Tabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onChange={setActiveTab}
                            variant="default"
                        />
                    </div>

                    <Button
                        variant="neon"
                        glow
                        leftIcon={<Plus size={16} />}
                        onClick={() => setShowNewModal(true)}
                    >
                        New Test Plan
                    </Button>
                </div>


                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testPlans
                        .filter((plan) => {
                            const q = searchTerm.trim().toLowerCase();
                            if (!q) return true;
                            const hay = [
                                plan.id,
                                plan.displayId ?? '',
                                plan.name,
                                plan.description,
                                plan.status,
                            ].join(' ').toLowerCase();
                            return hay.includes(q);
                        })
                        .map((plan) => (
                        <motion.div
                            key={plan.id}
                            variants={itemVariants}
                            className="group bg-black/20 backdrop-blur-md border border-white/10 rounded-xl p-6 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                                        <Folder size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-semibold mb-1 group-hover:text-primary transition-colors">{plan.name}</h3>
                                        <p
                                            className="text-xs text-gray-400 font-mono tracking-wide"
                                            title={plan.id}
                                        >
                                            {plan.displayId ?? plan.id}
                                        </p>
                                    </div>
                                </div>
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuPlanId(
                                                openMenuPlanId === plan.id ? null : plan.id
                                            );
                                        }}
                                        aria-label={`More actions for ${plan.name}`}
                                        aria-haspopup="menu"
                                        aria-expanded={openMenuPlanId === plan.id}
                                        className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>
                                    {openMenuPlanId === plan.id && (
                                        <div
                                            role="menu"
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute right-0 top-10 z-20 w-44 bg-gray-800 border border-white/10 rounded-lg shadow-xl overflow-hidden"
                                        >
                                            <button
                                                role="menuitem"
                                                onClick={() => handleDuplicatePlan(plan)}
                                                className="flex items-center w-full px-4 py-2 text-sm text-gray-200 hover:bg-white/5"
                                            >
                                                Duplicate
                                            </button>
                                            <button
                                                role="menuitem"
                                                onClick={() => handleDeletePlan(plan)}
                                                className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-white/5"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-sm text-gray-400 mb-6 line-clamp-2 min-h-[40px]">{plan.description}</p>

                            <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-white/5 rounded-lg border border-white/5">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Test Cases</p>
                                    <p className="text-xl font-bold text-white font-mono">{plan.testCases}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Progress</p>
                                    <p className="text-xl font-bold text-white font-mono">{plan.progress}%</p>
                                </div>
                            </div>

                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
                                <motion.div
                                    className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${plan.progress}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleAddComponent(plan.id); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-white/5 hover:bg-primary/20 text-gray-400 hover:text-primary rounded-lg text-xs font-medium transition-all border border-white/5 hover:border-primary/30"
                                    title="Add Component"
                                >
                                    <PlusCircle size={14} />
                                    Add
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleExportPdf(plan.id, plan.name); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-white/5 hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400 rounded-lg text-xs font-medium transition-all border border-white/5 hover:border-emerald-500/30"
                                    title="Export to PDF"
                                >
                                    <Download size={14} />
                                    PDF
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSharePlan(plan.id, plan.name); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-white/5 hover:bg-violet-500/20 text-gray-400 hover:text-violet-400 rounded-lg text-xs font-medium transition-all border border-white/5 hover:border-violet-500/30"
                                    title="Share Plan"
                                >
                                    <Share2 size={14} />
                                    Share
                                </button>
                            </div>

                            <div className="flex justify-between items-center border-t border-white/5 pt-4 mt-auto">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${plan.status === 'Active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${plan.status === 'Active' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                                    {plan.status}
                                </span>
                                <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium">
                                    <Calendar size={14} />
                                    <span>{plan.dueDate}</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    <motion.button
                        variants={itemVariants}
                        onClick={() => setShowNewModal(true)}
                        className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-white/10 text-gray-500 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-300 min-h-[300px] group"
                    >
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 shadow-sm">
                            <Plus size={32} />
                        </div>
                        <span className="font-medium text-lg">Create New Plan</span>
                    </motion.button>
                </div>
            </motion.div>

            {/* New Test Plan Modal */}
            <NewTestPlanModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                onSuccess={() => setShowNewModal(false)}
            />
        </div>
    );
};

export default TestPlans;
