import { useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../atoms';
import { AlertCircle } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useProject } from '../../contexts/ProjectContext';

interface NewTestCaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (testCase: Record<string, unknown>) => void;
}

export default function NewTestCaseModal({ isOpen, onClose, onSuccess }: NewTestCaseModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { markTaskComplete } = useOnboarding();
    const { currentProject } = useProject();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'Active',
        priority: 'Medium',
        type: 'Functional',
        jiraIssue: ''
    });

    if (!isOpen) return null;

    const validateForm = (): string | null => {
        if (!formData.title.trim()) {
            return 'Title is required';
        }
        if (formData.title.trim().length < 3) {
            return 'Title must be at least 3 characters';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        try {
            const result = await api.createTestCase({
                ...formData,
                projectId: currentProject?.id ?? 'demo',
                title: formData.title.trim(),
                description: formData.description.trim(),
            });

            // Reset form
            setFormData({
                title: '',
                description: '',
                status: 'Active',
                priority: 'Medium',
                type: 'Functional',
                jiraIssue: ''
            });

            onSuccess(result.data || result);

            // Creating a test case is the AI-generated-test step in the new flow.
            markTaskComplete('generate_first_test');

            onClose();
        } catch (err) {
            console.error('Error creating test case:', err);
            setError(err instanceof Error ? err.message : 'Failed to create test case');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setFormData({
            title: '',
            description: '',
            status: 'Active',
            priority: 'Medium',
            type: 'Functional',
            jiraIssue: ''
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Create New Test Case" size="lg">
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => {
                            setFormData({ ...formData, title: e.target.value });
                            if (error) setError(null);
                        }}
                        className={`w-full px-4 py-2 bg-slate-800 border rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium ${error && !formData.title.trim() ? 'border-red-500' : 'border-slate-700'
                            }`}
                        placeholder="e.g., Verify login with valid credentials"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Description of the test case..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Priority
                        </label>
                        <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Status
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Active">Active</option>
                            <option value="Draft">Draft</option>
                            <option value="Deprecated">Deprecated</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Type
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Functional">Functional</option>
                            <option value="E2E">E2E</option>
                            <option value="Integration">Integration</option>
                            <option value="Performance">Performance</option>
                            <option value="Security">Security</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Jira Issue
                        </label>
                        <input
                            type="text"
                            value={formData.jiraIssue}
                            onChange={(e) => setFormData({ ...formData, jiraIssue: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g., PROJ-123"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        type="button"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={loading}
                    >
                        {loading ? 'Creating...' : 'Create Test Case'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
