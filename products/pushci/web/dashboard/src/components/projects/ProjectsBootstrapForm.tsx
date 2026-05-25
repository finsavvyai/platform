import { type FormEvent, useState } from 'react';

interface Props {
  submitting: boolean;
  onSubmit: (repo: string) => Promise<void>;
}

export default function ProjectsBootstrapForm({ submitting, onSubmit }: Props) {
  const [repo, setRepo] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSubmit(repo.trim());
    if (!submitting) setRepo('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Claim Existing Project Access</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Use this once for repos that were created before governance was enabled.
        </p>
      </div>
      <label htmlFor="bootstrap-repo" className="sr-only">Repository slug</label>
      <input
        id="bootstrap-repo"
        value={repo}
        onChange={(event) => setRepo(event.target.value)}
        placeholder="owner/repo"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={submitting || repo.trim().length === 0}
        aria-busy={submitting}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-900/60 disabled:text-zinc-500"
      >
        {submitting ? 'Claiming…' : 'Claim access'}
      </button>
    </form>
  );
}
