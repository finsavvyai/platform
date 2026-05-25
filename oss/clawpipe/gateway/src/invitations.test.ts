/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { formatInviteEmail } from './invitations';

describe('formatInviteEmail', () => {
  it('includes project name in subject and body', () => {
    const msg = formatInviteEmail('Growth team', 'Alice', 'tok123');
    expect(msg.subject).toContain('Growth team');
    expect(msg.html).toContain('Growth team');
    expect(msg.text).toContain('Growth team');
  });

  it('includes inviter name', () => {
    const msg = formatInviteEmail('proj', 'Alice', 't');
    expect(msg.html).toContain('Alice');
    expect(msg.text).toContain('Alice');
  });

  it('builds accept link with token', () => {
    const msg = formatInviteEmail('proj', 'Alice', 'abc123');
    expect(msg.html).toContain('https://app.clawpipe.ai/invite/abc123');
    expect(msg.text).toContain('https://app.clawpipe.ai/invite/abc123');
  });

  it('escapes HTML-unsafe project names', () => {
    const msg = formatInviteEmail('<script>x</script>', 'Alice', 't');
    expect(msg.html).not.toContain('<script>x');
    expect(msg.html).toContain('&lt;script&gt;');
  });

  it('escapes HTML-unsafe inviter names', () => {
    const msg = formatInviteEmail('proj', '<img>', 't');
    expect(msg.html).toContain('&lt;img&gt;');
  });
});
