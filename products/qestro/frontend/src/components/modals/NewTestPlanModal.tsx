import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar } from 'lucide-react';
import { Button } from '../atoms';
import { useOnboarding } from '../../contexts/OnboardingContext';

interface NewTestPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (plan: Record<string, unknown>) => void;
}

const NewTestPlanModal: React.FC<NewTestPlanModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { markTaskComplete } = useOnboarding();

    const handleSubmit = () => {
        // Logic to create plan would go here

        // Creating a test plan counts as the "generate first test" milestone.
        markTaskComplete('generate_first_test');

        if (onSuccess) onSuccess({});
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
                    >
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                            <div>
                                <h2 className="text-xl font-bold text-white">Create New Test Plan</h2>
                                <p className="text-sm text-gray-400 mt-1">Define the scope and details of your test plan.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Plan Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                    placeholder="e.g., Sprint 2025.13 Testing"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all min-h-[100px]"
                                    placeholder="Describe the objectives and scope of this test plan..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Due Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all [color-scheme:dark]"
                                        />
                                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                                    <select className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer">
                                        <option>Planned</option>
                                        <option>Active</option>
                                        <option>Completed</option>
                                        <option>On Hold</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-white/5">
                            <Button variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button variant="neon" glow onClick={handleSubmit}>
                                Create Plan
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NewTestPlanModal;
