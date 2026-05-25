import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Layers, Globe, Smartphone, Server, Monitor } from "lucide-react";
import { useProject, type Platform } from "../../contexts/ProjectContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

import { CreateProjectModal } from "../modals/CreateProjectModal";

const ProjectSwitcher: React.FC = () => {
    const { projects, currentProject, setCurrentProject } = useProject();
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getIcon = (type: Platform) => {
        switch (type) {
            case 'web': return <Globe size={14} />;
            case 'mobile': return <Smartphone size={14} />;
            case 'api': return <Server size={14} />;
            case 'desktop': return <Monitor size={14} />;
            default: return <Layers size={14} />;
        }
    };

    if (!currentProject) return null;

    return (
        <>
            <div className="relative px-6 mb-8 z-50" ref={dropdownRef}>
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between p-2 rounded-xl border border-transparent hover:bg-white/5 hover:border-white/10 transition-all duration-300 group"
                    whileTap={{ scale: 0.98 }}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="relative h-10 w-10 flex-shrink-0 flex items-center justify-center transition-transform group-hover:scale-105 duration-300">
                            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse-slow" />
                            <div className="relative h-10 w-10 bg-gradient-to-br from-primary/80 to-secondary/80 rounded-xl flex items-center justify-center shadow-neon border border-white/20 text-white">
                                <span className="text-lg font-bold">{currentProject.name.charAt(0)}</span>
                            </div>
                        </div>
                        <div className="text-left overflow-hidden">
                            <div className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                                {currentProject.name}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                                {currentProject.platforms?.map((platform) => (
                                    <span key={platform} className="text-gray-400" title={platform}>
                                        {getIcon(platform)}
                                    </span>
                                )) || <span className="text-xs text-text-muted">No platforms</span>}
                            </div>
                        </div>
                    </div>
                    <ChevronDown
                        size={16}
                        className={cn(
                            "text-gray-500 transition-transform duration-300 flex-shrink-0 ml-2",
                            isOpen && "transform rotate-180 text-primary"
                        )}
                    />
                </motion.button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-4 right-4 top-full mt-2 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[100] ring-1 ring-white/5"
                        >
                            <div className="p-2 space-y-1">
                                <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Switch Project
                                </div>
                                <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    {projects.map((project) => (
                                        <button
                                            key={project.id}
                                            onClick={() => {
                                                setCurrentProject(project);
                                                setIsOpen(false);
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group/item relative overflow-hidden",
                                                currentProject.id === project.id
                                                    ? "bg-primary/10 text-primary border border-primary/20"
                                                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors",
                                                currentProject.id === project.id
                                                    ? "bg-primary/20 text-primary shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                                                    : "bg-white/5 text-gray-500 group-hover/item:bg-white/10 group-hover/item:text-white"
                                            )}>
                                                {project.name.charAt(0)}
                                            </div>
                                            <div className="text-left flex-1 min-w-0">
                                                <div className="truncate font-medium">{project.name}</div>
                                                <div className="flex items-center gap-1 mt-0.5 text-xs opacity-60">
                                                    {project.platforms?.slice(0, 3).map(p => (
                                                        <span key={p}>{getIcon(p)}</span>
                                                    ))}
                                                    {project.platforms?.length > 3 && <span>+{project.platforms.length - 3}</span>}
                                                </div>
                                            </div>

                                            {currentProject.id === project.id && (
                                                <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        setIsCreateModalOpen(true);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 hover:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-all duration-300 border border-transparent hover:border-primary/20 group/create"
                                >
                                    <Plus size={16} className="group-hover/create:scale-110 transition-transform" />
                                    <span>Create New Project</span>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <CreateProjectModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </>
    );
};

export default ProjectSwitcher;
