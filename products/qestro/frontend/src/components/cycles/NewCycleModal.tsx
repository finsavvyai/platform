import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { api } from '../../lib/api';
import { useUiStore } from '../../stores/uiStore';
import { Modal } from '../ui/Modal';
import { Button } from '../atoms';
import { cn } from '../../lib/utils';

interface NewCycleModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NewCycleModal({ isOpen, onClose }: NewCycleModalProps) {
    const { triggerRefresh } = useUiStore();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        testPlanId: '',
        environment: 'dev',
        startDate: '',
        endDate: '',
        assignedTo: '',
        testCaseIds: [] as string[],
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await api.createCycle({
                ...formData,
                startDate: new Date(formData.startDate).getTime() / 1000,
                endDate: new Date(formData.endDate).getTime() / 1000,
                testCaseIds: formData.testCaseIds.length > 0 ? formData.testCaseIds : ['dummy-test-case-id'], // TODO: Implement test case selector
            });

            onClose();
            triggerRefresh(); // Notify other components to refresh
        } catch (error) {
            console.error('Error creating cycle:', error);
            alert(error instanceof Error ? error.message : 'Failed to create cycle');
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-2";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Cycle" size="lg">
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Cycle Name */}
                <div>
                    <label className={labelClasses}>
                        Cycle Name <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClasses}
                        placeholder="e.g., Sprint 23 Regression"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className={labelClasses}>
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className={cn(inputClasses, "min-h-[100px]")}
                        placeholder="Brief description of this test cycle..."
                    />
                </div>

                {/* Test Plan */}
                <div>
                    <label className={labelClasses}>
                        Test Plan <span className="text-red-400">*</span>
                    </label>
                    <select
                        required
                        value={formData.testPlanId}
                        onChange={(e) => setFormData({ ...formData, testPlanId: e.target.value })}
                        className={cn(inputClasses, "appearance-none cursor-pointer")}
                    >
                        <option value="">Select a test plan</option>
                        <option value="plan-1">Regression Test Plan</option>
                        <option value="plan-2">Feature Test Plan</option>
                        <option value="plan-3">Integration Test Plan</option>
                    </select>
                </div>

                {/* Environment */}
                <div>
                    <label className={labelClasses}>
                        Environment <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {['dev', 'staging', 'production'].map((env) => (
                            <button
                                key={env}
                                type="button"
                                onClick={() => setFormData({ ...formData, environment: env })}
                                className={cn(
                                    "px-4 py-3 rounded-xl border transition-all text-sm font-medium",
                                    formData.environment === env
                                        ? "border-primary/50 bg-primary/20 text-white shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                        : "border-white/10 bg-black/20 text-gray-400 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                {env.charAt(0).toUpperCase() + env.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className={labelClasses}>
                            Start Date <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <Calendar className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className={cn(inputClasses, "[color-scheme:dark]")}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClasses}>
                            End Date <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <Calendar className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                            <input
                                type="date"
                                required
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                className={cn(inputClasses, "[color-scheme:dark]")}
                            />
                        </div>
                    </div>
                </div>

                {/* Assignee */}
                <div>
                    <label className={labelClasses}>
                        Assigned To
                    </label>
                    <select
                        value={formData.assignedTo}
                        onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                        className={cn(inputClasses, "appearance-none cursor-pointer")}
                    >
                        <option value="">Unassigned</option>
                        <option value="user-1">John Doe</option>
                        <option value="user-2">Jane Smith</option>
                        <option value="user-3">Bob Johnson</option>
                    </select>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/10">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="neon"
                        glow
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Cycle'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
