import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Folder, Calendar, Microscope, Plus } from 'lucide-react';

interface QuickCreateMenuProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement>;
    onCreateTestCase: () => void;
    onCreateTestPlan: () => void;
    onCreateCycle: () => void;
    onCreateExploration: () => void;
}

const MENU_ITEMS = [
    { id: 'test-case', label: 'Test Case', icon: FileText, description: 'Create a new test case' },
    { id: 'test-plan', label: 'Test Plan', icon: Folder, description: 'Organize test cases' },
    { id: 'cycle', label: 'Test Cycle', icon: Calendar, description: 'Track testing efforts' },
    { id: 'exploration', label: 'Exploration', icon: Microscope, description: 'Start exploratory testing' },
];

export const QuickCreateMenu: React.FC<QuickCreateMenuProps> = ({
    isOpen,
    onClose,
    anchorRef,
    onCreateTestCase,
    onCreateTestPlan,
    onCreateCycle,
    onCreateExploration,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (isOpen && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 8,
                left: rect.right - 280, // Align to right edge
            });
        }
    }, [isOpen, anchorRef]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, onClose, anchorRef]);

    const handleAction = (id: string) => {
        switch (id) {
            case 'test-case':
                onCreateTestCase();
                break;
            case 'test-plan':
                onCreateTestPlan();
                break;
            case 'cycle':
                onCreateCycle();
                break;
            case 'exploration':
                onCreateExploration();
                break;
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    style={{
                        position: 'fixed',
                        top: position.top,
                        left: position.left,
                        zIndex: 1000,
                    }}
                    className="w-72 bg-[#0B1121] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="p-2">
                        <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Quick Create
                        </div>
                        {MENU_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleAction(item.id)}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-white/5 transition-all duration-200 group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                        <Icon className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                                            {item.label}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {item.description}
                                        </div>
                                    </div>
                                    <Plus className="w-4 h-4 text-gray-600 group-hover:text-primary transition-colors" />
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
