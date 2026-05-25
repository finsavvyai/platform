/**
 * Shared styles for ProductMap components.
 * Extracted to keep component files under 200 lines.
 */

import type React from 'react';

export const pageStyle: React.CSSProperties = {
  minHeight: '100vh', background: '#0a0a0f', color: '#f0f0f5',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  padding: '24px 32px', overflowX: 'auto',
};

export const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24,
};

export const backBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #2a2a3e', borderRadius: 8,
  padding: '6px 14px', color: '#a1a1b5', fontSize: 13, cursor: 'pointer',
};

export const pageTitleStyle: React.CSSProperties = {
  fontSize: 24, fontWeight: 700, margin: 0,
};

export const productBar: React.CSSProperties = {
  background: '#141420', border: '1px solid #2a2a3e', borderRadius: 12,
  padding: '16px 20px', marginBottom: 24, cursor: 'pointer',
  display: 'flex', flexDirection: 'column', gap: 4,
};

export const productName: React.CSSProperties = { fontSize: 20, fontWeight: 700, margin: 0 };

export const productDesc: React.CSSProperties = {
  fontSize: 14, color: '#a1a1b5', margin: 0,
};

export const editInput: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8,
  padding: '8px 12px', color: '#f0f0f5', fontSize: 14, width: '100%',
  boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
};

export const saveProdBtn: React.CSSProperties = {
  background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8,
  padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  alignSelf: 'flex-start', marginTop: 4,
};

export const gridContainer: React.CSSProperties = {
  display: 'grid', gridAutoFlow: 'column',
  gridAutoColumns: '280px', gap: 16, overflowX: 'auto',
  paddingBottom: 24, alignItems: 'start',
};

export const columnStyle: React.CSSProperties = {
  background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12,
  padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
};

export const columnHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};

export const columnTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: 0 };

export const deleteBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#a1a1b5',
  fontSize: 14, cursor: 'pointer', padding: '2px 6px',
};

export const columnDesc: React.CSSProperties = {
  fontSize: 12, color: '#a1a1b5', margin: 0,
};

export const cardsStack: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
};

export const addCardBtn: React.CSSProperties = {
  background: 'transparent', border: '1px dashed #2a2a3e', borderRadius: 8,
  padding: '8px', color: '#a1a1b5', fontSize: 12, cursor: 'pointer',
  textAlign: 'center',
};

export const addColumnBtn: React.CSSProperties = {
  background: 'transparent', border: '1px dashed #2a2a3e', borderRadius: 12,
  padding: '40px 20px', color: '#a1a1b5', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', textAlign: 'center', minHeight: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/* FeatureCard styles */

export const fcCard: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 10,
  padding: '12px 14px', cursor: 'pointer', transition: 'border-color 200ms ease',
  display: 'flex', flexDirection: 'column', gap: 8,
};

export const fcHeaderRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
};

export const fcTitle: React.CSSProperties = {
  color: '#f0f0f5', fontSize: 14, fontWeight: 600,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
};

export const fcDesc: React.CSSProperties = {
  color: '#a1a1b5', fontSize: 12, lineHeight: 1.5, margin: 0,
};

export const fcTagsRow: React.CSSProperties = { display: 'flex', gap: 4, flexWrap: 'wrap' };

export const fcTagChip: React.CSSProperties = {
  fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 4,
  background: '#6366f120', color: '#818cf8',
};

export const fcExpanded: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 8,
  borderTop: '1px solid #2a2a3e', paddingTop: 8, marginTop: 4,
};

export const fcContextBlock: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
};

export const fcContextLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#a1a1b5',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

export const fcFileChip: React.CSSProperties = {
  fontSize: 11, color: '#8b5cf6', fontFamily: 'monospace',
};

export const fcBuildBtn: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
  border: 'none', cursor: 'pointer',
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
  alignSelf: 'flex-start',
};
