/**
 * Team Management — create team form sub-component
 */

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface CreateTeamFormProps {
  onCreate: (name: string, description: string) => void;
  isCreating: boolean;
}

export function CreateTeamForm({ onCreate, isCreating }: CreateTeamFormProps) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(name, description);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium" style={{ color: theme.colors.text }}>Team Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="My Engineering Team" disabled={isCreating} required
          className="w-full rounded-lg border px-3 py-2"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }} />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" style={{ color: theme.colors.text }}>Description (Optional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="A team for database collaboration..." disabled={isCreating} rows={3}
          className="w-full rounded-lg border px-3 py-2"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }} />
      </div>
      <button type="submit" disabled={isCreating || !name.trim()}
        className="w-full rounded-lg px-4 py-2 font-medium text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: theme.colors.accent }}>
        {isCreating ? 'Creating...' : 'Create Team'}
      </button>
    </form>
  );
}
