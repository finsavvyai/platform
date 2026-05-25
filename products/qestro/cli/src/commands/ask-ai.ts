import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { McpClient } from '../lib/mcp-client';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';

const createAskAiCommand = (): Command => {
    const cmd = new Command('ask-ai')
        .description('Ask the MCPOverflow AI a question')
        .alias('ask')
        .argument('<prompt>', 'The question to ask the AI')
        .option('-u, --url <url>', 'MCPOverflow API URL', 'http://localhost:8080/api/v1')
        .action(async (prompt, options) => {
            try {
                logger.startCommand('ask-ai');

                const spinner = ora('Contacting MCPOverflow AI...').start();
                const client = new McpClient(options.url);

                try {
                    const answer = await client.generate(prompt);
                    spinner.succeed('Answer received');
                    console.log('\n' + chalk.green(answer) + '\n');
                } catch (error) {
                    spinner.fail('Failed to get answer');
                    throw error;
                }

                logger.endCommand('ask-ai');
            } catch (error) {
                handleError(error, 'ask-ai');
                process.exit(1);
            }
        });

    return cmd;
};

export const askAiCommand = createAskAiCommand();
