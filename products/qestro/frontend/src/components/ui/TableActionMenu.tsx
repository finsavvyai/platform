import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Trash2 } from 'lucide-react';

interface TableActionMenuProps {
    isOpen: boolean;
    onClose: () => void;
    position: { top: number; left: number };
    onEdit: () => void;
    onDelete: () => void;
}

export const TableActionMenu: React.FC<TableActionMenuProps> = ({
    isOpen,
    onClose,
    position,
    onEdit,
    onDelete
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => {
            onClose(); // Close on scroll to avoid detached menu
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', handleScroll, true);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="py-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                        onClose();
                    }}
                    className="flex items-center w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                    <Edit2 className="w-4 h-4 mr-3" />
                    Edit
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                        onClose();
                    }}
                    className="flex items-center w-full px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors"
                >
                    <Trash2 className="w-4 h-4 mr-3" />
                    Delete
                </button>
            </div>
        </div>,
        document.body
    );
};
