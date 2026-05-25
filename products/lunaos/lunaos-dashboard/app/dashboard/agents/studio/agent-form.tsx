'use client';

import { useState } from 'react';
import { agentsApi } from '../../../../lib/api';

interface PromptVariant {
    id: string;
    content: string;
    weight: number;
}

interface AgentFormProps {
    onSaved: () => void;
}

export function AgentForm({ onSaved }: AgentFormProps) {
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [promptVariants, setPromptVariants] = useState<PromptVariant[]>([{ id: 'v1', content: '', weight: 100 }]);
    const [model, setModel] = useState('');
    const [temperature, setTemperature] = useState<number>(0.3);

    const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
    };

    const handleAddVariant = () => {
        setPromptVariants([...promptVariants, { id: `v${promptVariants.length + 1}`, content: '', weight: 100 }]);
    };

    const handleVariantChange = (index: number, field: string, value: string | number) => {
        const newVariants = [...promptVariants];
        newVariants[index] = { ...newVariants[index], [field]: value };
        setPromptVariants(newVariants);
    };

    const handleRemoveVariant = (index: number) => {
        const newVariants = [...promptVariants];
        newVariants.splice(index, 1);
        setPromptVariants(newVariants);
    };

    const resetForm = () => {
        setName('');
        setSlug('');
        setDescription('');
        setPromptVariants([{ id: 'v1', content: '', weight: 100 }]);
        setModel('');
        setTemperature(0.3);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await agentsApi.createCustom({
                name, slug, description, promptVariants,
                category: 'custom', model: model || undefined,
                temperature, is_public: false,
            });
            if (res.error) { alert(res.error); return; }
            resetForm();
            onSaved();
        } catch {
            alert('Failed to save custom agent');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="border border-white/10 rounded-xl bg-black/40 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Create New Persona</h2>
            <form onSubmit={handleSave} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1">Display Name</label>
                        <input type="text" required value={name} onChange={e => setName(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                            placeholder="e.g. Senior Frontend Dev" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1">Slug (ID)</label>
                        <input type="text" required value={slug} onChange={handleSlugChange}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 font-mono text-sm"
                            placeholder="senior-ui-expert" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">Short Description</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                        placeholder="Expert in React and CSS" />
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-end mb-2 border-b border-white/10 pb-2">
                        <div>
                            <label className="block text-sm font-medium text-neutral-300">System Prompt Variants</label>
                            <p className="text-xs text-neutral-500 mt-1">Add variations for A/B testing.</p>
                        </div>
                        <button type="button" onClick={handleAddVariant}
                            className="text-xs px-2 py-1 bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30 transition-colors">
                            + Add Variant
                        </button>
                    </div>
                    {promptVariants.map((variant, index) => (
                        <div key={index} className="pl-3 border-l-2 border-white/10 space-y-2 relative group">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono text-neutral-500 bg-black/50 px-1.5 py-0.5 rounded">{variant.id}</span>
                                    <span className="text-xs text-neutral-500">Weight: </span>
                                    <input type="number" min="0" max="100" value={variant.weight}
                                        onChange={(e) => handleVariantChange(index, 'weight', parseInt(e.target.value) || 0)}
                                        className="w-16 bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:border-violet-500" />
                                </div>
                                {promptVariants.length > 1 && (
                                    <button type="button" onClick={() => handleRemoveVariant(index)}
                                        className="text-xs text-red-500/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Remove
                                    </button>
                                )}
                            </div>
                            <textarea required value={variant.content} onChange={e => handleVariantChange(index, 'content', e.target.value)}
                                rows={4}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 font-mono text-sm"
                                placeholder="You are an expert... Provide concise instructions... Never use var..." />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1">Default Model <span className="text-xs text-neutral-500">(Optional)</span></label>
                        <input type="text" value={model} onChange={e => setModel(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 text-sm"
                            placeholder="deepseek-chat" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-neutral-300 mb-1">Temperature ({temperature})</label>
                        <input type="range" min="0" max="1" step="0.1" value={temperature}
                            onChange={e => setTemperature(parseFloat(e.target.value))}
                            className="w-full accent-violet-500 mt-2" />
                    </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <button type="submit" disabled={saving}
                        className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                        {saving ? 'Deploying Persona...' : 'Create Persona'}
                    </button>
                </div>
            </form>
        </div>
    );
}
