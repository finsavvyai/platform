/**
 * OS-tailored install snippets.
 *
 * IMPORTANT: every command here MUST be one we can support today. We do
 * not advertise package managers we haven't actually published to
 * (no fake `brew install opensyber/tap/cli` if the tap doesn't exist).
 * The published artifact today is `@opensyber/cli` on npm, so OS-tailored
 * snippets focus on the OS-specific PREREQUISITE (how to get node) and
 * then funnel into the same npm install command.
 *
 * When we ship homebrew / winget packages, swap the commands here —
 * the component contract doesn't change.
 */

import type { DetectedOS } from './os-detect.js';

export interface InstallSnippet {
  /** What this snippet does in one phrase, e.g. "Install via npm". */
  label: string;
  /** Shell-runnable command. Multi-line uses real newlines. */
  command: string;
  /** Optional one-line note shown under the snippet. */
  note?: string;
}

/**
 * Produce ordered snippets for an OS — earliest is the recommended one.
 * Always ends with the universal npm install as the fallback.
 */
export function snippetsForOS(os: DetectedOS, token: string): InstallSnippet[] {
  const loginCommand = `opensyber login ${token}`;

  switch (os) {
    case 'macos':
      return [
        {
          label: 'Install with npm (recommended)',
          command: `npm install -g @opensyber/cli\n${loginCommand}`,
          note: 'Need node? Run `brew install node` first.',
        },
      ];

    case 'linux':
      return [
        {
          label: 'Install with npm (recommended)',
          command: `npm install -g @opensyber/cli\n${loginCommand}`,
          note: 'No node? Use your distro package manager or nvm.',
        },
      ];

    case 'windows':
      return [
        {
          label: 'Install with npm (recommended)',
          command: `npm install -g @opensyber/cli\n${loginCommand}`,
          note: 'No node? Run `winget install OpenJS.NodeJS` first (PowerShell).',
        },
      ];

    case 'mobile':
      return [
        {
          label: 'Install on a desktop',
          command: `# OpenSyber CLI is desktop-only.\n# Open this page on macOS, Linux, or Windows.`,
          note: 'Or use the web dashboard — it works on phones.',
        },
      ];

    case 'unknown':
    default:
      return [
        {
          label: 'Install with npm',
          command: `npm install -g @opensyber/cli\n${loginCommand}`,
        },
      ];
  }
}
