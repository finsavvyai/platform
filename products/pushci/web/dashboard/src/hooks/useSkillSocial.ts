// Hook for skill marketplace social data: stats, comments, upvote.
import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

export interface SkillComment {
  id: string; skill_id: string; author_sub: string;
  author_login: string | null; body: string; created_at: string; parent_id: string | null;
}

export interface SkillStats {
  skill_id: string; upvotes_count: number; comments_count: number;
  usage_count_30d: number; usage_count_all_time: number; my_usage_count: number;
  top_users_30d: Array<{ user_sub: string; uses: number }>;
}

function authHeaders(): Record<string, string> {
  const tok = localStorage.getItem('pushci_token');
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

export function useSkillSocial(skillId: string): {
  stats: SkillStats | null;
  comments: SkillComment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  postComment: (body: string, parentId?: string) => Promise<void>;
  toggleUpvote: () => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
} {
  const [stats, setStats] = useState<SkillStats | null>(null);
  const [comments, setComments] = useState<SkillComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sRes, cRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/skills/${skillId}/stats`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/api/skills/${skillId}/comments?limit=50`),
      ]);
      if (!sRes.ok) throw new Error(`stats ${sRes.status}`);
      if (!cRes.ok) throw new Error(`comments ${cRes.status}`);
      const s = (await sRes.json()) as SkillStats;
      const c = (await cRes.json()) as { comments: SkillComment[] };
      setStats(s); setComments(c.comments);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const postComment = useCallback(async (body: string, parentId?: string) => {
    const res = await fetch(`${API_BASE_URL}/api/skills/${skillId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ body, parent_id: parentId }),
    });
    if (!res.ok) throw new Error(`post comment ${res.status}`);
    await refresh();
  }, [skillId, refresh]);

  const toggleUpvote = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/api/skills/${skillId}/upvote`, {
      method: 'POST', headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error(`upvote ${res.status}`);
    await refresh();
  }, [skillId, refresh]);

  const deleteComment = useCallback(async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/api/skills/${skillId}/comments/${id}`, {
      method: 'DELETE', headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error(`delete ${res.status}`);
    await refresh();
  }, [skillId, refresh]);

  return { stats, comments, loading, error, refresh, postComment, toggleUpvote, deleteComment };
}
