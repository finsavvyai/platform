import { describe, it, expect } from 'vitest';
import { snippetsForOS } from './install-snippets';

const TOKEN = 'tk_abc123';

describe('snippetsForOS', () => {
  it('macos returns one verified snippet', () => {
    const s = snippetsForOS('macos', TOKEN);
    expect(s).toHaveLength(1);
    expect(s[0].command).toContain('npm install -g @opensyber/cli');
    expect(s[0].command).toContain(`opensyber login ${TOKEN}`);
    expect(s[0].note).toMatch(/brew install node/);
  });

  it('linux suggests distro pm or nvm', () => {
    const s = snippetsForOS('linux', TOKEN);
    expect(s[0].note).toMatch(/distro|nvm/i);
  });

  it('windows suggests winget for node', () => {
    const s = snippetsForOS('windows', TOKEN);
    expect(s[0].note).toMatch(/winget install OpenJS\.NodeJS/);
  });

  it('mobile shows no real install command (desktop-only)', () => {
    const s = snippetsForOS('mobile', TOKEN);
    expect(s[0].command).not.toContain('npm install');
    expect(s[0].note).toMatch(/web dashboard/i);
  });

  it('unknown OS still returns a working npm fallback', () => {
    const s = snippetsForOS('unknown', TOKEN);
    expect(s[0].command).toContain('npm install -g @opensyber/cli');
    expect(s[0].command).toContain(`opensyber login ${TOKEN}`);
  });

  it('never advertises commands we do not support today', () => {
    // We have not shipped homebrew tap or winget package yet — guard against
    // a future contributor adding fake commands.
    for (const os of ['macos', 'linux', 'windows', 'unknown'] as const) {
      for (const snip of snippetsForOS(os, TOKEN)) {
        expect(snip.command).not.toMatch(/brew install opensyber/);
        expect(snip.command).not.toMatch(/winget install opensyber/i);
      }
    }
  });
});
