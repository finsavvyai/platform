'use client';

import { useState, useEffect } from 'react';
import { kbApi, type KBDocument } from '../../../lib/api';

export default function KnowledgeBasePage() {
    const [documents, setDocuments] = useState<KBDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');

    const loadDocuments = async () => {
        try {
            const data = await kbApi.list();
            setDocuments(data.documents || []);
        } catch (err) {
            // Error loading KB documents - will display empty state
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);
        try {
            const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
            await kbApi.upload(title, content, tagArray);
            setTitle('');
            setContent('');
            setTags('');
            await loadDocuments();
        } catch (err) {
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await kbApi.delete(id);
            await loadDocuments();
        } catch (err) {
            alert('Delete failed');
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Enterprise Knowledge Base</h1>
                    <p className="text-neutral-400">Global context and guidelines available to all agents.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Form */}
                <div className="lg:col-span-1 border border-white/10 rounded-xl bg-black/40 p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Upload Document</h2>
                    <form onSubmit={handleUpload} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-1">Title</label>
                            <input
                                type="text"
                                required
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                                placeholder="e.g. Coding Standards 2026"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-1">Content (Markdown/Text)</label>
                            <textarea
                                required
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                rows={8}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 font-mono text-sm"
                                placeholder="Insert the guidelines here..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-1">Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500"
                                placeholder="engineering, frontend, rules"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={uploading}
                            className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                            {uploading ? 'Processing...' : 'Upload & Index'}
                        </button>
                    </form>
                </div>

                {/* Document List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-semibold text-white mb-4">Indexed Documents</h2>
                    {loading ? (
                        <div className="text-neutral-400">Loading...</div>
                    ) : documents.length === 0 ? (
                        <div className="border border-white/10 border-dashed rounded-xl p-8 text-center bg-black/20">
                            <p className="text-neutral-400">No documents found in the Knowledge Base.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {documents.map(doc => (
                                <div key={doc.id} className="border border-white/10 rounded-xl bg-black/40 p-4 flex justify-between items-center group hover:bg-black/60 transition-colors">
                                    <div>
                                        <h3 className="text-white font-medium text-lg">{doc.title}</h3>
                                        <p className="text-sm text-neutral-500 mt-1">
                                            Added {new Date(doc.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(doc.id)}
                                        className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-300 px-3 py-1 bg-red-400/10 rounded-lg"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
