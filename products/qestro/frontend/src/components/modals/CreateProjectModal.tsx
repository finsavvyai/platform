import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Globe, Smartphone, Server, Monitor } from 'lucide-react';
import { useProject, type Platform } from '../../contexts/ProjectContext';
import { cn } from '../../lib/utils';
import { Button } from '../atoms/Button/Button';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PLATFORMS: { id: Platform; label: string; icon: React.ReactNode }[] = [
    { id: 'web', label: 'Web Application', icon: <Globe size={18} /> },
    { id: 'mobile', label: 'Mobile App', icon: <Smartphone size={18} /> },
    { id: 'api', label: 'Backend API', icon: <Server size={18} /> },
    { id: 'desktop', label: 'Desktop App', icon: <Monitor size={18} /> },
];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
    const { addProject, setCurrentProject } = useProject();
    const [name, setName] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);

    const togglePlatform = (platformId: Platform) => {
        setSelectedPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(p => p !== platformId)
                : [...prev, platformId]
        );
    };

    const createProject = () => {
        if (!name.trim() || selectedPlatforms.length === 0) return;

        const newProject = {
            id: Date.now().toString(),
            name,
            platforms: selectedPlatforms,
        };

        addProject(newProject);
        setCurrentProject(newProject);
        onClose();
        setName('');
        setSelectedPlatforms([]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createProject();
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 40 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                            mass: 0.5
                        }}
                        className="relative w-full max-w-2xl bg-[#030712] border border-white/10 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col pointer-events-auto"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                                    <Plus className="w-6 h-6 text-primary" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight">Create a New Project</h2>
                                    <p className="text-sm text-gray-500 font-medium">Configure your project workspace</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all duration-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-10 overflow-y-auto max-h-[70vh]">
                            {/* Project Name */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] ml-1">Project Details</label>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Enter project name..."
                                        className="w-full px-6 py-5 bg-white/[0.03] border border-white/10 rounded-2xl text-white text-xl placeholder:text-white/10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner transition-all duration-300 font-medium"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Platforms */}
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] ml-1">Select Platforms</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {PLATFORMS.map((platform) => (
                                        <button
                                            key={platform.id}
                                            type="button"
                                            onClick={() => togglePlatform(platform.id)}
                                            className={cn(
                                                "group/platform relative flex items-center gap-5 p-5 rounded-2xl border-2 transition-all duration-500 text-left overflow-hidden",
                                                selectedPlatforms.includes(platform.id)
                                                    ? "bg-primary/[0.07] border-primary/50 text-white shadow-[0_0_40px_rgba(0,240,255,0.1)] scale-[1.02]"
                                                    : "bg-white/[0.02] border-white/5 text-gray-500 hover:bg-white/[0.05] hover:border-white/20"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-2xl shrink-0",
                                                selectedPlatforms.includes(platform.id)
                                                    ? "bg-primary text-black scale-110 rotate-3"
                                                    : "bg-white/5 text-gray-400 group-hover/platform:text-white group-hover/platform:scale-105"
                                            )}>
                                                {platform.icon}
                                            </div>
                                            <div className="relative z-10">
                                                <span className={cn(
                                                    "block font-bold text-base transition-colors duration-300",
                                                    selectedPlatforms.includes(platform.id) ? "text-white" : "text-gray-300 group-hover/platform:text-white"
                                                )}>{platform.label}</span>
                                                <span className="text-[11px] text-gray-500 font-medium block mt-0.5 truncate uppercase tracking-wider">
                                                    {platform.id} environment
                                                </span>
                                            </div>

                                            {selectedPlatforms.includes(platform.id) && (
                                                <>
                                                    <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-primary shadow-[0_0_15px_rgba(0,240,255,1)] animate-pulse" />
                                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
                                                </>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="px-8 py-8 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                            <div className="text-sm text-gray-400 font-medium italic">
                                {selectedPlatforms.length > 0 ? (
                                    <>Selected {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? 's' : ''}</>
                                ) : (
                                    <>Select at least one platform</>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={onClose}
                                    type="button"
                                    className="px-6 py-3 text-sm font-bold text-gray-400 hover:text-white transition-colors duration-200"
                                >
                                    Cancel
                                </button>
                                <Button
                                    variant="neon"
                                    glow
                                    disabled={!name.trim() || selectedPlatforms.length === 0}
                                    onClick={createProject}
                                    type="button"
                                    leftIcon={<Plus size={20} strokeWidth={2.5} />}
                                    className="px-8 py-4 text-sm font-bold rounded-2xl"
                                >
                                    CREATE PROJECT
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};
