import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DateRange } from '../../types';

interface DateRangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    range: DateRange;
    onApply: (range: DateRange) => void;
}

const PRESETS = [
    { label: 'Last 24 Hours', value: '24h' },
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Custom Range', value: 'custom' },
];

export default function DateRangeModal({ isOpen, onClose, range, onApply }: DateRangeModalProps) {
    const [localRange, setLocalRange] = useState<DateRange>(range);
    const [activePreset, setActivePreset] = useState<string>(
        PRESETS.find(p => p.label === range.label)?.value || 'custom'
    );

    if (!isOpen) return null;

    const handlePresetClick = (preset: typeof PRESETS[0]) => {
        setActivePreset(preset.value);
        if (preset.value !== 'custom') {
            setLocalRange({
                from: null,
                to: null,
                label: preset.label
            });
        }
    };

    const handleCustomChange = (type: 'from' | 'to', value: string) => {
        setLocalRange({
            ...localRange,
            [type]: value,
            label: 'Custom Range'
        });
        setActivePreset('custom');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" role="dialog" aria-modal="true">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative bg-[#0B1121] border border-white/10 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-primary" />
                                </div>
                                <h2 className="text-lg font-bold text-white">Select Date Range</h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {/* Preset Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                {PRESETS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        onClick={() => handlePresetClick(preset)}
                                        className={`px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activePreset === preset.value
                                                ? 'bg-primary/10 text-primary border-2 border-primary/50 shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                                                : 'bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.08] border-2 border-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            {/* Custom Date Inputs */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">From</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={localRange.from || ''}
                                            onChange={(e) => handleCustomChange('from', e.target.value)}
                                            className="w-full pl-10 pr-3 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">To</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={localRange.to || ''}
                                            onChange={(e) => handleCustomChange('to', e.target.value)}
                                            className="w-full pl-10 pr-3 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-5 border-t border-white/5 bg-black/20 flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => onApply(localRange)}
                                className="px-6 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-black text-sm font-black transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]"
                            >
                                Apply Range
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
