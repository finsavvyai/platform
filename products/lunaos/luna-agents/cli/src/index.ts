import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { listCommand } from './commands/list.js';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { keysCommand } from './commands/keys.js';
import { createAgentCommand } from './commands/create-agent.js';
import { indexCommand } from './commands/index.js';
import { chainCommand } from './commands/chain.js';
import { configCommand } from './commands/config.js';
import { loginCommand } from './commands/login.js';
import { ragCommand } from './commands/rag.js';
import { secCommand } from './commands/sec.js';
import { keystoreCommand } from './commands/keystore.js';
import { handleError } from './utils/error-handler.js';

const program = new Command();

program
  .name('luna')
  .description(
    chalk.hex('#E8A317')('🌙 LunaOS') +
    ' — AI agent platform for the full software development lifecycle'
  )
  .version('0.1.0')
  .addHelpText('after', `
${chalk.dim('Examples:')}
  ${chalk.cyan('luna r code-review')}         Run an agent ${chalk.dim('(r = run)')}
  ${chalk.cyan('luna q "how does auth work?"')} Search codebase ${chalk.dim('(q = rag)')}
  ${chalk.cyan('luna ch full-review')}        Run agent chain ${chalk.dim('(ch = chain)')}
  ${chalk.cyan('luna ls')}                    List all 28+ agents ${chalk.dim('(ls = list)')}
  ${chalk.cyan('luna ix')}                    Index for RAG ${chalk.dim('(ix = index)')}
  ${chalk.cyan('luna s')}                     Project status ${chalk.dim('(s = status)')}
  ${chalk.cyan('luna k add anthropic')}       Add API key ${chalk.dim('(k = keys)')}
  ${chalk.cyan('luna cfg set model gpt-4o')}  Set config ${chalk.dim('(cfg = config)')}
  ${chalk.cyan('luna new my-agent')}          Create agent ${chalk.dim('(new = create-agent)')}
  ${chalk.cyan('luna auth')}                  Login ${chalk.dim('(auth = login)')}
  ${chalk.cyan('luna ks install')}            Install shell secret helpers ${chalk.dim('(ks = keystore)')}

${chalk.dim('Shortcuts cheat sheet:')}
  ${chalk.dim('r')}=run  ${chalk.dim('q')}=rag/ask  ${chalk.dim('ch')}=chain  ${chalk.dim('ls')}=list  ${chalk.dim('ix')}=index
  ${chalk.dim('s')}=status  ${chalk.dim('k')}=keys  ${chalk.dim('ks')}=keystore  ${chalk.dim('cfg')}=config  ${chalk.dim('new')}=create-agent  ${chalk.dim('i')}=init

${chalk.dim('Quick start:')}
  ${chalk.dim('1.')} ${chalk.cyan('luna i')}              — setup provider & API key
  ${chalk.dim('2.')} ${chalk.cyan('luna r code-review')}  — run your first agent
  ${chalk.dim('3.')} ${chalk.cyan('luna ch full-review')} — run a full review chain

${chalk.dim('Docs:')} ${chalk.cyan('https://docs.lunaos.ai')}
`);

program.addCommand(initCommand);
program.addCommand(listCommand);
program.addCommand(runCommand);
program.addCommand(chainCommand);
program.addCommand(indexCommand);
program.addCommand(configCommand);
program.addCommand(loginCommand);
program.addCommand(ragCommand);
program.addCommand(statusCommand);
program.addCommand(keysCommand);
program.addCommand(createAgentCommand);
program.addCommand(secCommand);
program.addCommand(keystoreCommand);

// Global error handler — catches unhandled rejections
process.on('uncaughtException', (error) => {
  handleError(error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  handleError(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

program.parse();
