import { btnGestureSubtle } from '../../styles/gestures';
import type { CompanyRegistry, RegistryType } from './types';

interface Props {
  registry: CompanyRegistry;
  testing: boolean;
  deleting: boolean;
  onTest: (r: CompanyRegistry) => void;
  onEdit: (r: CompanyRegistry) => void;
  onDelete: (r: CompanyRegistry) => void;
}

function TypeBadge({ type }: { type: RegistryType }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 uppercase tracking-wider">
      {type}
    </span>
  );
}

export default function RegistryRow({ registry, testing, deleting, onTest, onEdit, onDelete }: Props) {
  return (
    <div className="p-4 rounded-xl bg-surface-card border border-surface-border flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <TypeBadge type={registry.type} />
          <span className="text-sm font-medium text-zinc-100 truncate">{registry.name}</span>
        </div>
        <div className="text-xs text-zinc-500 truncate">
          {registry.url}{registry.region ? ` · ${registry.region}` : ''} · auth: {registry.authMode}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => onTest(registry)}
          disabled={testing}
          aria-busy={testing}
          className={`px-3 py-1.5 text-xs rounded-md bg-surface-hover border border-surface-border text-zinc-200 disabled:opacity-60 ${btnGestureSubtle}`}
        >
          {testing ? 'Testing…' : 'Test'}
        </button>
        <button
          type="button"
          onClick={() => onEdit(registry)}
          className={`px-3 py-1.5 text-xs rounded-md bg-surface-hover border border-surface-border text-zinc-200 ${btnGestureSubtle}`}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(registry)}
          disabled={deleting}
          aria-busy={deleting}
          className={`px-3 py-1.5 text-xs rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 disabled:opacity-60 ${btnGestureSubtle}`}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
