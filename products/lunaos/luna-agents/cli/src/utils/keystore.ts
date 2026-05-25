/**
 * Keystore — thin wrapper over the macOS Keychain `security` CLI.
 *
 * Secrets are stored as generic-password entries with account=$USER and
 * service=<name>. A sidecar index at ~/.luna/secrets-index tracks names so
 * `list` is O(1) without scanning the whole keychain.
 *
 * Linux/Windows are not supported yet; callers should check `isSupported()`.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const INDEX_PATH = path.join(os.homedir(), '.luna', 'secrets-index');

export function isSupported(): boolean {
    return process.platform === 'darwin';
}

function ensureSupported(): void {
    if (!isSupported()) {
        throw new Error('Keystore currently supports macOS only (uses `security` CLI).');
    }
}

function account(): string {
    return process.env.USER || os.userInfo().username;
}

function readIndex(): string[] {
    try {
        return fs.readFileSync(INDEX_PATH, 'utf-8')
            .split('\n').map((s) => s.trim()).filter(Boolean);
    } catch { return []; }
}

function writeIndex(names: string[]): void {
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    const unique = Array.from(new Set(names)).sort();
    fs.writeFileSync(INDEX_PATH, unique.join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(INDEX_PATH, 0o600);
}

export function listSecrets(): string[] {
    ensureSupported();
    return readIndex();
}

export function getSecret(name: string): string | null {
    ensureSupported();
    const r = spawnSync('security', ['find-generic-password', '-a', account(), '-s', name, '-w'], { encoding: 'utf-8' });
    if (r.status !== 0) return null;
    return r.stdout.replace(/\n$/, '');
}

export function setSecret(name: string, value: string): void {
    ensureSupported();
    const r = spawnSync('security', ['add-generic-password', '-a', account(), '-s', name, '-w', value, '-U'], { encoding: 'utf-8' });
    if (r.status !== 0) {
        throw new Error(`security add-generic-password failed: ${r.stderr.trim() || r.stdout.trim()}`);
    }
    const idx = readIndex();
    if (!idx.includes(name)) writeIndex([...idx, name]);
}

export function deleteSecret(name: string): boolean {
    ensureSupported();
    const r = spawnSync('security', ['delete-generic-password', '-a', account(), '-s', name], { encoding: 'utf-8' });
    const idx = readIndex().filter((n) => n !== name);
    writeIndex(idx);
    return r.status === 0;
}

/** Shell snippet installed by `luna keystore install`. */
export function shellSnippet(): string {
    return `# >>> luna keystore >>>
# Managed by \`luna keystore install\` — edit luna source, not here.
list-secrets() {
  local f="$HOME/.luna/secrets-index"
  [ -f "$f" ] && cat "$f" || echo "(no secrets indexed yet — run: luna keystore set <name> <value>)"
}
get-secret() {
  [ -z "$1" ] && echo "usage: get-secret <name>" >&2 && return 2
  security find-generic-password -a "$USER" -s "$1" -w 2>/dev/null
}
set-secret() {
  [ -z "$1" ] || [ -z "$2" ] && echo "usage: set-secret <name> <value>" >&2 && return 2
  security add-generic-password -a "$USER" -s "$1" -w "$2" -U \\
    && mkdir -p "$HOME/.luna" \\
    && { grep -qxF "$1" "$HOME/.luna/secrets-index" 2>/dev/null || echo "$1" >> "$HOME/.luna/secrets-index"; } \\
    && chmod 600 "$HOME/.luna/secrets-index"
}
# <<< luna keystore <<<
`;
}

const MARK_BEGIN = '# >>> luna keystore >>>';
const MARK_END = '# <<< luna keystore <<<';

/** Append (or replace) the snippet in a shell profile. Returns the profile path. */
export function installShellSnippet(shell: 'zsh' | 'bash'): string {
    const rcName = shell === 'zsh' ? '.zshrc' : '.bashrc';
    const rcPath = path.join(os.homedir(), rcName);
    const existing = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf-8') : '';
    const stripped = existing.replace(
        new RegExp(`\\n?${MARK_BEGIN}[\\s\\S]*?${MARK_END}\\n?`, 'g'),
        ''
    );
    const next = (stripped.endsWith('\n') || stripped === '' ? stripped : stripped + '\n') + '\n' + shellSnippet();
    if (existing) {
        fs.writeFileSync(rcPath + '.luna-backup', existing, 'utf-8');
    }
    fs.writeFileSync(rcPath, next, 'utf-8');
    return rcPath;
}

/** Parse KEY=VALUE lines (.env-style). Strips quotes, ignores comments/blank. */
export function parseEnvFile(content: string): Array<{ key: string; value: string }> {
    const out: Array<{ key: string; value: string }> = [];
    for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        let value = m[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out.push({ key: m[1], value });
    }
    return out;
}
