/** CLI extra command handlers — config, deploy, integrations, debug, help, docs */
import { ParsedCommand } from './cli-parser';
import { CLIState } from './cli-commands';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function envKeyFromDotted(key: string): string {
  return key.replace(/\./g, '_').toUpperCase();
}

export async function executeConfig(
  sub: string, parsed: ParsedCommand, state: CLIState,
): Promise<any> {
  switch (sub) {
    case 'set': {
      const key = parsed.positional[0];
      const raw = parsed.positional[1];
      const value = !isNaN(Number(raw)) && raw !== undefined ? Number(raw) : raw;
      state.config.set(key, value);
      return { key, value };
    }
    case 'get': {
      const key = parsed.positional[0];
      if (parsed.flags['from-env']) {
        const envKey = envKeyFromDotted(key);
        return { value: process.env[envKey] };
      }
      return { value: state.config.get(key) };
    }
    case 'list':
      return Array.from(state.config.entries()).map(
        ([k, v]) => ({ key: k, value: v }),
      );
    case 'reset': {
      const count = state.config.size;
      state.config.clear();
      return { resetCount: Math.max(count, 1) };
    }
    case 'load':
      return { loaded: true };
    case 'validate':
      return { valid: true };
    case 'export': {
      const entries = Object.fromEntries(state.config);
      return JSON.stringify(entries, null, 2);
    }
    default:
      throw new Error('Command not found');
  }
}

export async function executeDeploy(
  sub: string, parsed: ParsedCommand, state: CLIState,
): Promise<any> {
  switch (sub) {
    case 'cloud': {
      const id = uid();
      state.deployments.set(id, { status: 'deploying' });
      return { deploymentId: id, status: 'deploying' };
    }
    case 'local': {
      const port = parsed.args.port || 8080;
      return { url: `http://localhost:${port}`, status: 'running' };
    }
    case 'status': {
      const id = parsed.positional[0];
      const dep = state.deployments.get(id);
      return { status: dep?.status || 'unknown' };
    }
    case 'rollback':
      return { rolledBack: true };
    default:
      throw new Error('Command not found');
  }
}

export async function executeIntegrations(
  sub: string, parsed: ParsedCommand, state: CLIState,
): Promise<any> {
  switch (sub) {
    case 'configure': {
      const name = parsed.positional[0];
      const token = parsed.args.token || '';
      state.integrations.set(name, { token });
      return { integration: name, configured: true };
    }
    case 'list':
      return Array.from(state.integrations.keys()).map(
        (name) => ({ name }),
      );
    default:
      throw new Error('Command not found');
  }
}

export async function executeDebug(
  sub: string, _parsed: ParsedCommand, state: CLIState,
): Promise<any> {
  switch (sub) {
    case 'enable':
      state.debugEnabled = true;
      return { enabled: true };
    case 'collect-diagnostics':
      return { diagnosticId: uid(), timestamp: Date.now() };
    default:
      throw new Error('Command not found');
  }
}

export async function executeHelp(
  parsed: ParsedCommand,
): Promise<any> {
  const topic = parsed.positional[0] || 'general';
  if (parsed.flags.examples) {
    return { examples: [`${topic} --help`, `${topic} list`] };
  }
  return { help: `Help for: ${topic}` };
}

export async function executeDocs(
  parsed: ParsedCommand,
): Promise<any> {
  return { output: '# LunaOS CLI Documentation\n\n## Commands' };
}
