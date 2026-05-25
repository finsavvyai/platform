import { useState } from 'react';
import { X } from 'lucide-react';
import type { DashboardFilters } from '../../types';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    filters: DashboardFilters;
    onApply: (filters: DashboardFilters) => void;
}

export default function FilterModal({ isOpen, onClose, filters, onApply }: FilterModalProps) {
    const [localFilters, setLocalFilters] = useState<DashboardFilters>(filters);



    if (!isOpen) return null;

    const handleStatusChange = (status: keyof DashboardFilters['status']) => {
        setLocalFilters({
            ...localFilters,
            status: {
                ...localFilters.status,
                [status]: !localFilters.status[status]
            }
        });
    };

    const handleEnvironmentChange = (environment: string) => {
        setLocalFilters({
            ...localFilters,
            environment
        });
    };

    const handleReset = () => {
        const defaultFilters: DashboardFilters = {
            status: { passed: true, failed: true, pending: true },
            environment: 'All Environments'
        };
        setLocalFilters(defaultFilters);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-slate-800 rounded-xl max-w-md w-full shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-50">Filter Dashboard</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-200 mb-3">Status</label>
                        <div className="space-y-3">
                            {(['passed', 'failed', 'pending'] as const).map((status) => (
                                <label key={status} className="flex items-center space-x-3 text-slate-200 capitalize cursor-pointer hover:bg-slate-700 p-2 rounded-lg transition-colors">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                                        checked={localFilters.status[status]}
                                        onChange={() => handleStatusChange(status)}
                                    />
                                    <span className="font-medium">{status}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-200 mb-3">Environment</label>
                        <select
                            className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                            value={localFilters.environment}
                            onChange={(e) => handleEnvironmentChange(e.target.value)}
                        >
                            <option>All Environments</option>
                            <option>Development</option>
                            <option>Staging</option>
                            <option>Production</option>
                        </select>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                    <button onClick={handleReset} className="px-4 py-2 bg-slate-700 border border-slate-600 hover:bg-slate-700 rounded-lg text-slate-200 font-medium transition-colors">
                        Reset
                    </button>
                    <button
                        onClick={() => onApply(localFilters)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium transition-colors shadow-sm"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
}
