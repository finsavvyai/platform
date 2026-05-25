/**
 * WorkflowManager — modal for listing, opening, and creating workflows.
 */

import { useState, useEffect, useCallback } from 'react';
import { listWorkflows, type SavedWorkflow } from '../../lib/api-client';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  spacing, radius, fontFamily, fontSize, fontWeight, colors, shadow,
} from '../../lib/theme';

interface WorkflowManagerProps {
  open: boolean;
  onClose: () => void;
  onOpen: (workflow: SavedWorkflow) => void;
  onNew: () => void;
}

export function WorkflowManager({ open, onClose, onOpen, onNew }: WorkflowManagerProps) {
  const isDark = useDarkMode();
  const c = isDark ? colors.dark : colors.light;
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setWorkflows(await listWorkflows()); }
    catch { setError('Failed to load workflows'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: c.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily }} onClick={onClose}>
      <div style={{ background: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: radius.lg, width: 560, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: shadow.lg, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${spacing.md}px ${spacing.lg}px`, borderBottom: `1px solid ${c.separator}` }}>
          <span style={{ fontSize: fontSize.title2, fontWeight: fontWeight.bold, color: c.text }}>Your Workflows</span>
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button style={{ padding: `${spacing.xs}px ${spacing.md}px`, borderRadius: radius.sm, border: 'none', background: c.accent, color: '#fff', fontWeight: fontWeight.semibold, fontSize: fontSize.caption1, cursor: 'pointer', fontFamily }} onClick={() => { onNew(); onClose(); }}>+ New</button>
            <button style={{ background: 'none', border: 'none', fontSize: fontSize.title3, color: c.textTertiary, cursor: 'pointer', fontFamily }} onClick={onClose} aria-label="Close">&times;</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: spacing.md }}>
          {loading && <p style={{ color: c.textTertiary, textAlign: 'center', padding: spacing.lg }}>Loading...</p>}
          {error && <p style={{ color: c.red, textAlign: 'center', padding: spacing.lg }}>{error}</p>}
          {!loading && !error && workflows.length === 0 && (
            <p style={{ textAlign: 'center', padding: spacing.xl, color: c.textTertiary, fontSize: fontSize.body }}>No workflows yet. Create your first one.</p>
          )}
          {workflows.map((w) => (
            <WorkflowRow key={w.id} w={w} onOpen={() => { onOpen(w); onClose(); }} isDark={isDark} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WorkflowRow({ w, onOpen, isDark }: { w: SavedWorkflow; onOpen: () => void; isDark: boolean }) {
  const c = isDark ? colors.dark : colors.light;
  const [hovered, setHovered] = useState(false);
  const date = new Date(w.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dotColor = w.status === 'completed' ? c.green : w.status === 'failed' ? c.red : c.orange;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.sm}px ${spacing.md}px`, borderRadius: radius.sm, cursor: 'pointer', marginBottom: 4, background: hovered ? (isDark ? '#2C2C2E' : '#E5E5EA') : 'transparent', transition: 'background 120ms ease' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onOpen}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: fontSize.subheadline, fontWeight: fontWeight.medium, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name || 'Untitled'}</div>
          <div style={{ fontSize: fontSize.caption2, color: c.textTertiary }}>{date}</div>
        </div>
      </div>
      <span style={{ fontSize: fontSize.caption1, color: c.textTertiary }}>{w.status}</span>
    </div>
  );
}
