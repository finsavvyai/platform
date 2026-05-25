'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';
import { SKILL_CATEGORIES, INITIAL_FORM } from './submit-helpers';

export default function SubmitSkillPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/skills/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug, name: form.name, description: form.description || undefined,
          category: form.category, githubUrl: form.githubUrl || undefined, version: form.version,
        }),
      });
      if (res.ok) { router.push('/dashboard/skills'); }
      else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Submission failed');
      }
    } catch { setError('Network error'); } finally { setLoading(false); }
  }

  return (
    <div className="max-w-xl">
      <Link href="/dashboard/skills" className="flex items-center gap-1 text-sm text-text-secondary hover:text-white mb-6">
        <ArrowLeft className="h-4 w-4" />Back to Skills
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Submit a Skill</h1>
        <p className="text-sm text-text-secondary mt-1">Submit your skill for review and inclusion in the marketplace.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField id="slug" label="Slug" required value={form.slug} onChange={handleChange}
          placeholder="my-skill-name" pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" minLength={3}
          hint="Lowercase letters, numbers, and hyphens only (min 3 chars)" />
        <FormField id="name" label="Name" required value={form.name} onChange={handleChange} placeholder="My Skill Name" />
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
          <textarea id="description" name="description" value={form.description} onChange={handleChange} rows={3}
            placeholder="A brief description of what your skill does..."
            className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-signal focus:outline-none resize-none" />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-text-primary mb-1.5">Category <span className="text-red-400">*</span></label>
          <select id="category" name="category" value={form.category} onChange={handleChange}
            className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white focus:border-signal focus:outline-none">
            {SKILL_CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
          </select>
        </div>
        <FormField id="githubUrl" label="GitHub URL" type="url" value={form.githubUrl} onChange={handleChange}
          placeholder="https://github.com/your-org/your-skill" />
        <FormField id="version" label="Version" required value={form.version} onChange={handleChange} placeholder="1.0.0" />
        {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">{error}</div>}
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50">
          <Upload className="h-4 w-4" />{loading ? 'Submitting...' : 'Submit for Review'}
        </button>
      </form>
    </div>
  );
}

function FormField({ id, label, required, hint, ...inputProps }: {
  id: string; label: string; required?: boolean; hint?: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; pattern?: string; minLength?: number; type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text-primary mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input id={id} name={id} required={required} {...inputProps}
        className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-signal focus:outline-none" />
      {hint && <p className="text-xs text-text-dim mt-1">{hint}</p>}
    </div>
  );
}
