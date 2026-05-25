import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../atoms';
import { api } from '../../lib/api';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useProject } from '../../contexts/ProjectContext';
import { useAuthStore } from '../../stores/authStore';

interface TestCase {
    id: string;
    title: string;
    status: string;
}

interface NewTestRunModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (run: Record<string, unknown>) => void;
}

const NewTestRunModal: React.FC<NewTestRunModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [loadingTestCases, setLoadingTestCases] = useState(true);
    const [selectedTestCases, setSelectedTestCases] = useState<string[]>([]);
    const { markTaskComplete } = useOnboarding();
    const { currentProject } = useProject();
    const { user } = useAuthStore();

    const [formData, setFormData] = useState({
        name: '',
        environment: 'staging',
        browser: 'chromium',
    });

    // Fetch available test cases when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchTestCases();
        }
    }, [isOpen]);

    const fetchTestCases = async () => {
        try {
            setLoadingTestCases(true);
            const response = await api.getTestCases(
                currentProject?.id ? { projectId: currentProject.id } : undefined
            );
            if (response.success && response.data) {
                setTestCases(response.data);
            }
        } catch (err) {
            console.error('Failed to fetch test cases:', err);
        } finally {
            setLoadingTestCases(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            setError('Run name is required');
            return;
        }

        if (selectedTestCases.length === 0) {
            setError('Please select at least one test case');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Build the proper API payload
            const payload = {
                name: formData.name.trim(),
                projectId: currentProject?.id ?? 'demo',
                userId: user?.id ?? 'demo-user',
                testCases: selectedTestCases.map(id => ({ id })),
                config: {
                    parallel: false,
                    environment: formData.environment,
                    retryFailedTests: false,
                    captureScreenshots: true,
                    captureVideo: false,
                },
                metadata: {
                    browser: formData.browser,
                },
            };

            const result = await api.createAutomationRun(payload);

            if (result.success) {
                // Creating a run means the user followed through on the Day 1 flow.
                markTaskComplete('run_first_test');

                if (onSuccess) onSuccess(result.data);
                handleClose();
            } else {
                throw new Error(result.error || 'Failed to create test run');
            }
        } catch (err) {
            console.error('Error creating test run:', err);
            setError(err instanceof Error ? err.message : 'Failed to create test run');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setFormData({
            name: '',
            environment: 'staging',
            browser: 'chromium',
        });
        setSelectedTestCases([]);
        onClose();
    };

    const toggleTestCase = (id: string) => {
        setSelectedTestCases(prev =>
            prev.includes(id)
                ? prev.filter(caseId => caseId !== id)
                : [...prev, id]
        );
    };

    const selectAllTestCases = () => {
        if (selectedTestCases.length === testCases.length) {
            setSelectedTestCases([]);
        } else {
            setSelectedTestCases(testCases.map(tc => tc.id));
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="new-test-run-title">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto max-h-[90vh] flex flex-col"
                    >
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/20 rounded-lg">
                                    <Play size={20} className="text-primary" />
                                </div>
                                <div>
                                    <h2 id="new-test-run-title" className="text-xl font-bold text-white">Create New Test Run</h2>
                                    <p className="text-sm text-gray-400 mt-0.5">Execute your test cases and track results</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Run Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: e.target.value });
                                        if (error) setError(null);
                                    }}
                                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                                    placeholder="e.g., Regression Test - Sprint 42"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Environment</label>
                                    <select
                                        value={formData.environment}
                                        onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="development">Development</option>
                                        <option value="staging">Staging</option>
                                        <option value="production">Production</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Browser</label>
                                    <select
                                        value={formData.browser}
                                        onChange={(e) => setFormData({ ...formData, browser: e.target.value })}
                                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="chromium">Chromium</option>
                                        <option value="firefox">Firefox</option>
                                        <option value="webkit">WebKit (Safari)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-300">
                                        Select Test Cases <span className="text-red-400">*</span>
                                    </label>
                                    <button
                                        onClick={selectAllTestCases}
                                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                                    >
                                        {selectedTestCases.length === testCases.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                <div className="bg-black/20 border border-white/10 rounded-xl max-h-48 overflow-y-auto">
                                    {loadingTestCases ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="animate-spin text-primary" size={24} />
                                        </div>
                                    ) : testCases.length === 0 ? (
                                        <div className="py-8 text-center text-gray-500 text-sm">
                                            No test cases available. Create some test cases first.
                                        </div>
                                    ) : (
                                        testCases.map((testCase) => (
                                            <label
                                                key={testCase.id}
                                                className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTestCases.includes(testCase.id)}
                                                    onChange={() => toggleTestCase(testCase.id)}
                                                    className="w-4 h-4 rounded border-gray-600 bg-black/20 text-primary focus:ring-primary focus:ring-offset-0"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm text-white">{testCase.title}</div>
                                                    <div className="text-xs text-gray-500">ID: {testCase.id}</div>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded ${testCase.status === 'Active'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {testCase.status}
                                                </span>
                                            </label>
                                        ))
                                    )}
                                </div>
                                {selectedTestCases.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        {selectedTestCases.length} test case{selectedTestCases.length > 1 ? 's' : ''} selected
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-white/5">
                            <Button variant="ghost" onClick={handleClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button
                                variant="neon"
                                glow
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2" size={16} />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Play size={16} className="mr-2" />
                                        Start Test Run
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default NewTestRunModal;
