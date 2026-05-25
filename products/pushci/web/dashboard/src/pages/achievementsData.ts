export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  xp: number;
  category: string;
}

export interface EarnedBadge {
  badge_id: string;
  earned_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  login: string;
  avatar_url: string;
  xp: number;
}

export interface ApiBadge {
  id: string;
  name: string;
  description: string;
  category: string;
  xp: number;
  unlocked: boolean;
  awarded_at: string | null;
}

export interface ApiLeaderboardEntry {
  user_sub: string;
  login: string;
  xp: number;
  badge_count: number;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_run', name: 'First Blood', desc: 'Triggered your first CI run', icon: '\u{1FA78}', xp: 10, category: 'runs' },
  { id: 'ten_runs', name: 'Getting Serious', desc: '10 CI runs completed', icon: '🔟', xp: 25, category: 'runs' },
  { id: 'hundred_runs', name: 'CI Veteran', desc: '100 CI runs completed', icon: '💯', xp: 100, category: 'runs' },
  { id: 'thousand_runs', name: 'CI Legend', desc: '1,000 CI runs completed', icon: '🏆', xp: 500, category: 'runs' },
  { id: 'streak_7', name: 'Week Warrior', desc: '7 consecutive days with runs', icon: '🔥', xp: 50, category: 'streaks' },
  { id: 'streak_30', name: 'Monthly Machine', desc: '30 consecutive days', icon: '📅', xp: 200, category: 'streaks' },
  { id: 'streak_100', name: 'Unstoppable', desc: '100 consecutive days', icon: '⚡', xp: 1000, category: 'streaks' },
  { id: 'all_green', name: 'Green Machine', desc: '10 consecutive passing runs', icon: '✅', xp: 75, category: 'quality' },
  { id: 'zero_failures_week', name: 'Perfect Week', desc: 'No failures for 7 days', icon: '💎', xp: 50, category: 'quality' },
  { id: 'fast_runner', name: 'Speed Demon', desc: 'Avg build under 30 seconds', icon: '⚡', xp: 100, category: 'quality' },
  { id: 'first_project', name: 'Architect', desc: 'Created your first project', icon: '🏗️', xp: 15, category: 'team' },
  { id: 'five_projects', name: 'Empire Builder', desc: 'Managing 5+ projects', icon: '🏰', xp: 75, category: 'team' },
  { id: 'team_player', name: 'Team Player', desc: 'Added to 3+ project teams', icon: '🤝', xp: 50, category: 'team' },
  { id: 'night_owl', name: 'Night Owl', desc: 'Run between midnight and 5am', icon: '🦉', xp: 25, category: 'special' },
  { id: 'weekend_warrior', name: 'Weekend Warrior', desc: 'Runs on Saturday and Sunday', icon: '🎮', xp: 25, category: 'special' },
  { id: 'early_adopter', name: 'Early Adopter', desc: 'First 1000 users', icon: '🌟', xp: 200, category: 'special' },
];

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'runs', label: 'Run Milestones' },
  { key: 'streaks', label: 'Streaks' },
  { key: 'quality', label: 'Quality' },
  { key: 'team', label: 'Team' },
  { key: 'special', label: 'Special' },
];
