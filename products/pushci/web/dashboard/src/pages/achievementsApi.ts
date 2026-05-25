import { API_BASE_URL } from '../config';
import type {
  ApiBadge,
  ApiLeaderboardEntry,
  EarnedBadge,
  LeaderboardEntry,
} from './achievementsData';

function getToken(): string | null {
  return localStorage.getItem('pushci_token');
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchAchievements(): Promise<{ xp: number; badges: EarnedBadge[] }> {
  const res = await authFetch('/api/achievements/badges');
  if (!res.ok) throw new Error(`Failed to load achievements: ${res.status}`);
  const data = (await res.json()) as { xp: number; badges: ApiBadge[] };
  const earned: EarnedBadge[] = (data.badges ?? [])
    .filter((b) => b.unlocked && b.awarded_at)
    .map((b) => ({ badge_id: b.id, earned_at: b.awarded_at as string }));
  return { xp: data.xp ?? 0, badges: earned };
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await authFetch('/api/achievements/leaderboard');
  if (!res.ok) throw new Error(`Failed to load leaderboard: ${res.status}`);
  const data = (await res.json()) as { leaderboard?: ApiLeaderboardEntry[] };
  const rows = data.leaderboard ?? [];
  return rows.map((e, i) => ({
    rank: i + 1,
    login: e.login,
    avatar_url: `https://avatars.githubusercontent.com/${e.login}?size=28`,
    xp: e.xp,
  }));
}

export async function triggerBadgeCheck(): Promise<void> {
  try {
    await authFetch('/api/achievements/check', { method: 'POST' });
  } catch {
    // non-fatal — page still renders current KV state
  }
}
