/**
 * AddCardModal — modal for adding new workflow columns or feature cards.
 * Collects title, description, tags, and context files.
 * Data is saved to localStorage via the parent callback.
 */

import React, { useState, useRef, useEffect } from 'react';

export type ModalMode = 'workflow' | 'card';

interface AddCardModalProps {
  mode: ModalMode;
  onSave: (data: {
    title: string;
    description: string;
    tags: string[];
    contextFiles: string[];
  }) => void;
  onClose: () => void;
}

export function AddCardModal({ mode, onSave, onClose }: AddCardModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [fileInput, setFileInput] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const addFile = () => {
    const f = fileInput.trim();
    if (f && !files.includes(f)) setFiles([...files, f]);
    setFileInput('');
  };

  const removeFile = (f: string) => setFiles(files.filter((x) => x !== f));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), tags, contextFiles: files });
  };

  const label = mode === 'workflow' ? 'Workflow' : 'Feature Card';

  return (
    <div style={overlay} onClick={onClose} role="dialog" aria-label={`Add ${label}`}>
      <form style={modal} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3 style={headingStyle}>Add {label}</h3>

        <label style={labelStyle}>Title</label>
        <input ref={titleRef} style={inputStyle} value={title}
          onChange={(e) => setTitle(e.target.value)} placeholder={`${label} name`} />

        <label style={labelStyle}>Description</label>
        <textarea style={{ ...inputStyle, height: 64, resize: 'vertical' }}
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description" />

        {mode === 'card' && (
          <>
            <label style={labelStyle}>Tags</label>
            <div style={rowStyle}>
              <input style={{ ...inputStyle, flex: 1 }} value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tag, press Enter" />
              <button type="button" style={smallBtn} onClick={addTag}>+</button>
            </div>
            {tags.length > 0 && (
              <div style={chipsRow}>
                {tags.map((t) => (
                  <span key={t} style={chip} onClick={() => removeTag(t)}>{t} x</span>
                ))}
              </div>
            )}

            <label style={labelStyle}>Context Files</label>
            <div style={rowStyle}>
              <input style={{ ...inputStyle, flex: 1 }} value={fileInput}
                onChange={(e) => setFileInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFile())}
                placeholder="src/components/..." />
              <button type="button" style={smallBtn} onClick={addFile}>+</button>
            </div>
            {files.length > 0 && (
              <div style={chipsRow}>
                {files.map((f) => (
                  <span key={f} style={fileChip} onClick={() => removeFile(f)}>{f} x</span>
                ))}
              </div>
            )}
          </>
        )}

        <div style={footerRow}>
          <button type="button" style={cancelBtn} onClick={onClose}>Cancel</button>
          <button type="submit" style={saveBtn} disabled={!title.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: '#141420', border: '1px solid #2a2a3e', borderRadius: 14,
  padding: 24, width: '100%', maxWidth: 420, display: 'flex',
  flexDirection: 'column', gap: 10,
};

const headingStyle: React.CSSProperties = {
  color: '#f0f0f5', fontSize: 18, fontWeight: 700, margin: 0,
};

const labelStyle: React.CSSProperties = {
  color: '#a1a1b5', fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.04em', marginTop: 4,
};

const inputStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8,
  padding: '8px 12px', color: '#f0f0f5', fontSize: 14, outline: 'none',
  fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

const rowStyle: React.CSSProperties = { display: 'flex', gap: 6 };

const smallBtn: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
  padding: '6px 12px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
};

const chipsRow: React.CSSProperties = {
  display: 'flex', gap: 4, flexWrap: 'wrap',
};

const chip: React.CSSProperties = {
  fontSize: 11, padding: '2px 8px', borderRadius: 4,
  background: '#6366f120', color: '#818cf8', cursor: 'pointer',
};

const fileChip: React.CSSProperties = {
  fontSize: 11, padding: '2px 8px', borderRadius: 4,
  background: '#8b5cf620', color: '#a78bfa', cursor: 'pointer', fontFamily: 'monospace',
};

const footerRow: React.CSSProperties = {
  display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8,
};

const cancelBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #2a2a3e', borderRadius: 8,
  padding: '8px 16px', color: '#a1a1b5', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const saveBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
  borderRadius: 8, padding: '8px 20px', color: '#fff', fontSize: 13,
  fontWeight: 600, cursor: 'pointer',
};
