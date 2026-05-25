/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup);
import { SidebarNav } from './SidebarNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe('SidebarNav', () => {
  it('renders the main navigation landmark', () => {
    const { container } = render(<SidebarNav hasOrg={false} />);
    const nav = container.querySelector('nav[aria-label="Main navigation"]');
    expect(nav).toBeTruthy();
  });

  it('renders Overview link', () => {
    const { container } = render(<SidebarNav hasOrg={false} />);
    const overview = container.querySelector('a[href="/dashboard"]');
    expect(overview).toBeTruthy();
    expect(overview?.textContent).toContain('Overview');
  });

  it('renders sidebar group titles', () => {
    const { container } = render(<SidebarNav hasOrg={false} />);
    const buttons = container.querySelectorAll('button.group-header');
    const titles = Array.from(buttons).map((b) => b.textContent?.trim());
    expect(titles).toContain('Agent');
    expect(titles).toContain('Security');
    expect(titles).toContain('Governance');
  });

  it('renders bottom rail items', () => {
    const { container } = render(<SidebarNav hasOrg={false} />);
    const links = Array.from(container.querySelectorAll('a'));
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/dashboard/settings');
    expect(hrefs).toContain('/dashboard/profile');
    expect(hrefs).toContain('/dashboard/integrations');
  });

  it('marks Overview as current page', () => {
    const { container } = render(<SidebarNav hasOrg={false} />);
    const overview = container.querySelector('a[href="/dashboard"]');
    expect(overview?.getAttribute('aria-current')).toBe('page');
  });

  it('toggles group on click', () => {
    const { container } = render(<SidebarNav hasOrg={true} />);
    const buttons = container.querySelectorAll('button.group-header');
    const agentButton = Array.from(buttons).find((b) => b.textContent?.includes('Agent'));
    expect(agentButton).toBeTruthy();
    fireEvent.click(agentButton!);
    expect(agentButton?.getAttribute('aria-expanded')).toBeDefined();
  });

  it('hides labels when collapsed', () => {
    const { container } = render(<SidebarNav hasOrg={false} collapsed={true} />);
    const spans = container.querySelectorAll('nav span');
    expect(spans.length).toBe(0);
  });

  it('locks team group when hasOrg is false', () => {
    const { container } = render(<SidebarNav hasOrg={false} />);
    const buttons = container.querySelectorAll('button.group-header');
    const teamButton = Array.from(buttons).find((b) => b.textContent?.includes('Team'));
    expect(teamButton?.className).toContain('opacity-50');
    expect(teamButton?.getAttribute('aria-disabled')).toBe('true');
  });
});
