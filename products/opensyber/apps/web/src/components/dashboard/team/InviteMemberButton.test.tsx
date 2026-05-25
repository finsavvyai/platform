/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InviteMemberButton } from './InviteMemberButton';

beforeEach(() => {
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('InviteMemberButton', () => {
  it('renders invite button', () => {
    render(<InviteMemberButton orgId="org1" currentUserRole="admin" />);
    expect(screen.getByText('Invite Member')).toBeDefined();
  });

  it('opens modal on click', () => {
    render(<InviteMemberButton orgId="org1" currentUserRole="admin" />);
    fireEvent.click(screen.getByText('Invite Member'));
    expect(screen.getByText('Invite Team Member')).toBeDefined();
  });
});
