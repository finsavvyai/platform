import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { UpmClient, ProjectType } from '../lib/upm-client';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';

const createCreateCommand = (): Command => {
    const cmd = new Command('create')
        .description('Scaffold a new project using UPM')
        .argument('<name>', 'Name of the project')
        .action(async (name) => {
            try {
                logger.startCommand('create');

                // Ask for project type
                const { type } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'type',
                        message: 'Select project template:',
                        choices: ['python', 'node', 'go', 'rust']
                    }
                ]);

                const spinner = ora(`Scaffolding ${type} project '${name}'...`).start();
                const upm = new UpmClient();

                // 1. Init
                spinner.text = 'Initializing project structure...';
                const initResult = await upm.initProject(name, type as ProjectType);

                // 2. Install (Simulated for now as we might not be in the dir)
                spinner.text = 'Installing default dependencies...';
                const installResult = await upm.install();

                spinner.succeed(chalk.green(`Project '${name}' created successfully!`));

                console.log(chalk.gray(initResult));
                console.log(chalk.gray(installResult));
                console.log(chalk.blue(`\nTo get started:\n  cd ${name}\n  qestro ask "How do I run this?"`));

                logger.endCommand('create');
            } catch (error) {
                handleError(error, 'create');
                process.exit(1);
            }
        });

    return cmd;
};

export const createCommand = createCreateCommand();
