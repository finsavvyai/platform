import { useRef, useEffect } from 'react';
import { Settings, Download, Trash2, Copy } from 'lucide-react';

interface MoreMenuProps {
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLButtonElement | null>;
    /** Wired by the consuming page. Omit an item to hide it. */
    onSettings?: () => void;
    onDuplicate?: () => void;
    onExport?: () => void;
    onDelete?: () => void;
}

export default function MoreMenu({
    isOpen,
    onClose,
    anchorRef,
    onSettings,
    onDuplicate,
    onExport,
    onDelete,
}: MoreMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                anchorRef.current &&
                !anchorRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, anchorRef]);

    if (!isOpen) return null;

    // Each item closes the menu after firing its handler.
    const run = (fn?: () => void) => () => {
        fn?.();
        onClose();
    };

    const itemCls =
        'flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white';
    const dangerCls =
        'flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300';

    const showSettings = Boolean(onSettings);
    const showDuplicate = Boolean(onDuplicate);
    const showExport = Boolean(onExport);
    const showDelete = Boolean(onDelete);
    const showDivider = showDelete && (showSettings || showDuplicate || showExport);

    return (
        <div
            ref={menuRef}
            className="absolute right-0 top-12 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{ right: '2rem', top: '4rem' }}
            role="menu"
            data-testid="more-menu"
        >
            <div className="py-1">
                {showSettings && (
                    <button onClick={run(onSettings)} className={itemCls} role="menuitem">
                        <Settings className="w-4 h-4 mr-3" />
                        Settings
                    </button>
                )}
                {showDuplicate && (
                    <button onClick={run(onDuplicate)} className={itemCls} role="menuitem">
                        <Copy className="w-4 h-4 mr-3" />
                        Duplicate Dashboard
                    </button>
                )}
                {showExport && (
                    <button onClick={run(onExport)} className={itemCls} role="menuitem">
                        <Download className="w-4 h-4 mr-3" />
                        Export Data
                    </button>
                )}
                {showDivider && <div className="border-t border-gray-700 my-1" />}
                {showDelete && (
                    <button onClick={run(onDelete)} className={dangerCls} role="menuitem">
                        <Trash2 className="w-4 h-4 mr-3" />
                        Delete Dashboard
                    </button>
                )}
            </div>
        </div>
    );
}
