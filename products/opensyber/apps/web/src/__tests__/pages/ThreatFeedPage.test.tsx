import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThreatFeedPage from '@/app/dashboard/threat-feed/page';

describe('ThreatFeedPage', () => {
  it('renders heading', async () => {
    const result = await ThreatFeedPage();
    render(result);
    expect(
      screen.getByText('Threat Intelligence Feed'),
    ).toBeInTheDocument();
  });

  it('renders threat count stats', async () => {
    const result = await ThreatFeedPage();
    render(result);
    expect(screen.getByText('Tracked Threats (30d)')).toBeInTheDocument();
    expect(screen.getByText('Critical Severity')).toBeInTheDocument();
    expect(screen.getByText('Categories Monitored')).toBeInTheDocument();
  });

  it('renders threat entries', async () => {
    const result = await ThreatFeedPage();
    render(result);
    expect(
      screen.getByText('UNC6426 Supply Chain Attack via npm'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('CursorJack — IDE Extension Hijack'),
    ).toBeInTheDocument();
  });

  it('renders connect CTA', async () => {
    const result = await ThreatFeedPage();
    render(result);
    expect(
      screen.getByText(/Connect Your Stack for Live Monitoring/),
    ).toBeInTheDocument();
  });

  it('renders CVE links', async () => {
    const result = await ThreatFeedPage();
    render(result);
    expect(screen.getByText('CVE-2026-33017')).toBeInTheDocument();
  });
});
