/** CLI REPL — interactive mode with history and autocomplete */

const SUBCOMMANDS: Record<string, string[]> = {
  agents: ['list', 'info', 'spawn', 'pause', 'resume', 'stop', 'logs', 'metrics', 'spawn-batch'],
  workflow: ['create', 'list', 'show', 'add-node', 'connect', 'validate', 'execute', 'delete', 'export'],
  config: ['set', 'get', 'list', 'reset', 'load', 'validate', 'export'],
  deploy: ['cloud', 'local', 'status', 'rollback'],
  integrations: ['configure', 'list'],
  debug: ['enable', 'collect-diagnostics'],
  help: [],
  docs: ['generate'],
};

export interface REPL {
  running: boolean;
  execute(cmd: string): Promise<any>;
  getHistory(): string[];
  autocomplete(partial: string): string[];
}

export function createREPL(
  executeFn: (cmd: string) => Promise<any>,
): REPL {
  const history: string[] = [];

  return {
    running: true,
    async execute(cmd: string) {
      history.push(cmd);
      return executeFn(cmd);
    },
    getHistory() {
      return [...history];
    },
    autocomplete(partial: string) {
      const hasTrailingSpace = partial.endsWith(' ');
      const parts = partial.trim().split(' ').filter(Boolean);
      const group = parts[0] || '';
      if (parts.length === 0 || (parts.length === 1 && !hasTrailingSpace)) {
        return Object.keys(SUBCOMMANDS).filter(
          (k) => k.startsWith(group),
        );
      }
      const subs = SUBCOMMANDS[group];
      if (!subs) return [];
      const prefix = hasTrailingSpace && parts.length === 1 ? '' : (parts[1] || '');
      return subs.filter((s) => s.startsWith(prefix));
    },
  };
}
