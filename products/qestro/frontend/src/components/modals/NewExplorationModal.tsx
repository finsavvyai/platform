import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../atoms';

interface NewExplorationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (exploration: ExplorationData) => void;
}

export interface ExplorationData {
    id: string;
    name: string;
    milestone: string;
    startTime: string;
    mission: string;
    status: 'Active' | 'Completed';
}

const NewExplorationModal: React.FC<NewExplorationModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [startTime, setStartTime] = useState(new Date().toLocaleDateString('en-US'));
    const [milestone, setMilestone] = useState('');
    const [mission, setMission] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = () => {
        if (!name.trim()) {
            alert('Please enter an exploration name');
            return;
        }

        setIsSubmitting(true);

        // Create the exploration object
        const newExploration: ExplorationData = {
            id: Date.now().toString(),
            name: name.trim(),
            milestone: milestone || 'General',
            startTime: startTime || new Date().toLocaleDateString('en-US'),
            mission: mission || 'No mission specified',
            status: 'Active',
        };

        // Call the success callback with the new exploration
        if (onSuccess) {
            onSuccess(newExploration);
        }

        // Reset form
        setName('');
        setStartTime(new Date().toLocaleDateString('en-US'));
        setMilestone('');
        setMission('');
        setIsSubmitting(false);
        onClose();
    };

    const handleClose = () => {
        setName('');
        setStartTime(new Date().toLocaleDateString('en-US'));
        setMilestone('');
        setMission('');
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
                        onClick={handleClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-lg bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
                    >
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-bold text-white">Create Exploration</h2>
                            <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Name <span className="text-red-400">*</span></label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                        placeholder="Exploration 001"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Start Time</label>
                                    <input
                                        type="text"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50 transition-colors"
                                        placeholder="12/03/2025"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Milestone</label>
                                <select
                                    value={milestone}
                                    onChange={(e) => setMilestone(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50 transition-colors appearance-none"
                                >
                                    <option value="">Select milestone...</option>
                                    <option value="Bug resolution">Bug resolution</option>
                                    <option value="Feature Release">Feature Release</option>
                                    <option value="Sprint 1">Sprint 1</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">Mission</label>
                                <textarea
                                    value={mission}
                                    onChange={(e) => setMission(e.target.value)}
                                    className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary/50 transition-colors min-h-[100px]"
                                    placeholder="Describe the exploration mission..."
                                ></textarea>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
                            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                            <Button
                                variant="neon"
                                glow
                                onClick={handleSubmit}
                                disabled={isSubmitting || !name.trim()}
                            >
                                {isSubmitting ? 'Creating...' : 'Create Session'}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NewExplorationModal;
