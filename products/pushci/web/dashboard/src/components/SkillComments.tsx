// Threaded comment list + input. Apple HIG: indented replies, avatar placeholders,
// relative timestamps, calm typography.
import { useMemo, useState } from 'react';
import type { SkillComment } from '../hooks/useSkillSocial';

function relativeTime(iso: string): string {
  const delta = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (delta < 60) return 'just now';
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function initials(login: string | null): string {
  return (login ?? '??').slice(0, 2).toUpperCase();
}

interface Props {
  comments: SkillComment[];
  currentUserSub?: string | null;
  canPost: boolean;
  onPost: (body: string, parentId?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function SkillComments({ comments, currentUserSub, canPost, onPost, onDelete }: Props): JSX.Element {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tree = useMemo(() => {
    const roots: SkillComment[] = [];
    const byParent = new Map<string, SkillComment[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const arr = byParent.get(c.parent_id) ?? [];
        arr.push(c); byParent.set(c.parent_id, arr);
      } else roots.push(c);
    }
    return { roots, byParent };
  }, [comments]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try { await onPost(text.trim(), replyTo ?? undefined); setText(''); setReplyTo(null); }
    finally { setBusy(false); }
  };

  const renderComment = (c: SkillComment, depth: number) => (
    <li key={c.id} className="flex gap-3" style={{ marginLeft: depth * 20 }} data-testid="skill-comment">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300" aria-hidden="true">
        {initials(c.author_login)}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-300">{c.author_login ?? 'anon'}</span>
          <span title={c.created_at}>{relativeTime(c.created_at)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{c.body}</p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
          {canPost && <button type="button" onClick={() => setReplyTo(c.id)} className="hover:text-zinc-300">Reply</button>}
          {onDelete && c.author_sub === currentUserSub && (
            <button type="button" onClick={() => void onDelete(c.id)} className="hover:text-red-400" aria-label="Delete comment">Delete</button>
          )}
        </div>
        <ul className="mt-3 space-y-3">
          {(tree.byParent.get(c.id) ?? []).map((child) => renderComment(child, depth + 1))}
        </ul>
      </div>
    </li>
  );

  return (
    <section aria-label="Skill comments" className="space-y-4">
      {canPost ? (
        <form onSubmit={submit} className="space-y-2" aria-label="Add a comment">
          {replyTo && (
            <div className="flex items-center justify-between rounded-md bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-400">
              <span>Replying to comment</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-zinc-300">cancel</button>
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Share what worked (or didn't)..."
            aria-label="Comment body" rows={3}
            className="w-full rounded-lg border border-zinc-700/50 bg-zinc-900 p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none" />
          <div className="flex justify-end">
            <button type="submit" disabled={busy || !text.trim()}
              className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
              {busy ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400" role="note">
          Login to comment on this skill.
        </div>
      )}
      <ul className="space-y-3">
        {tree.roots.length === 0 && <li className="text-xs text-zinc-500">No comments yet. Be the first.</li>}
        {tree.roots.map((c) => renderComment(c, 0))}
      </ul>
    </section>
  );
}
