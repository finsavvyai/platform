/** CLITools — main entry point for CLI command execution */
import { parseCommand, ParsedCommand } from './cli-parser';
import { CLIState, createState, executeAgents, executeWorkflow } from './cli-commands';
import { executeConfig, executeDeploy, executeIntegrations, executeDebug, executeHelp, executeDocs } from './cli-extras';
import { createREPL, REPL } from './cli-repl';

export class CLITools {
  private state: CLIState;

  constructor() {
    this.state = createState();
  }

  /** Parse a command string into structured parts */
  async parse(input: string): Promise<ParsedCommand> {
    return parseCommand(input);
  }

  /** Execute a CLI command and return the result */
  async execute(command: string): Promise<any> {
    const parsed = parseCommand(command);
    const [group, sub] = parsed.command.split(' ');

    switch (group) {
      case 'agents':
        return executeAgents(sub, parsed, this.state);
      case 'workflow':
        return executeWorkflow(sub, parsed, this.state);
      case 'config':
        return executeConfig(sub, parsed, this.state);
      case 'deploy':
        return executeDeploy(sub, parsed, this.state);
      case 'integrations':
        return executeIntegrations(sub, parsed, this.state);
      case 'debug':
        return executeDebug(sub, parsed, this.state);
      case 'help':
        return executeHelp(parsed);
      case 'docs':
        return executeDocs(parsed);
      default:
        throw new Error('Command not found');
    }
  }

  /** Create an interactive REPL session */
  createREPL(): REPL {
    return createREPL((cmd) => this.execute(cmd));
  }
}
