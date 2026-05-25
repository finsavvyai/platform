/**
 * Recording Commands for Questro CLI
 * Provides comprehensive test recording functionality
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { config } from '../utils/config';
import { api } from '../utils/api-client';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';
import { output, success, error, info, warning, header, progress } from '../utils/output';
import { which } from 'which';

interface Recording {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  type: 'mobile' | 'web';
  status: 'recording' | 'completed' | 'failed' | 'processing';
  platform?: string;
  device?: string;
  duration?: number;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    url?: string;
    browser?: string;
    resolution?: string;
    appPackage?: string;
    osVersion?: string;
  };
}

interface StartRecordingOptions {
  name?: string;
  description?: string;
  projectId?: string;
  type?: 'mobile' | 'web';
  url?: string;
  device?: string;
  browser?: string;
  headless?: boolean;
  resolution?: string;
  timeout?: number;
}

const createRecordingCommands = (): Command => {
  const recordingCmd = new Command('recordings')
    .description('Test recording commands')
    .alias('record')
    .alias('rec');

  // List recordings
  recordingCmd
    .command('list')
    .description('List all recordings')
    .option('-p, --project <projectId>', 'Filter by project ID')
    .option('-s, --status <status>', 'Filter by status (recording|completed|failed|processing)')
    .option('-t, --type <type>', 'Filter by type (mobile|web)')
    .option('--format <format>', 'Output format (table|json|yaml)', 'table')
    .option('--limit <number>', 'Limit number of results', '25')
    .option('--sort <field>', 'Sort by field (name|created|duration)', 'created')
    .option('--order <order>', 'Sort order (asc|desc)', 'desc')
    .action(async (options) => {
      try {
        logger.startCommand('recordings list');

        const spinner = ora('Fetching recordings...').start();

        const params: any = {
          limit: parseInt(options.limit) || 25,
          sort: options.sort,
          order: options.order,
        };

        if (options.project) params.projectId = options.project;
        if (options.status) params.status = options.status;
        if (options.type) params.type = options.type;

        const response = await api.get<Recording[]>('/recordings', { params });
        const recordings = response.data || [];

        spinner.succeed(`Found ${recordings.length} recordings`);

        if (recordings.length === 0) {
          info('No recordings found');
          return;
        }

        output.setFormat(options.format);

        if (options.format === 'table') {
          header('Recordings', `${recordings.length} recordings found`);

          const recordingData = recordings.map(recording => ({
            ID: recording.id.substring(0, 8),
            Name: recording.name,
            Type: recording.type,
            Platform: recording.platform || 'N/A',
            Status: recording.status,
            Duration: recording.duration ? `${recording.duration}s` : 'N/A',
            'File Size': recording.fileSize ? `${(recording.fileSize / 1024 / 1024).toFixed(1)}MB` : 'N/A',
            Created: new Date(recording.createdAt).toLocaleDateString(),
          }));

          output.table(recordingData, {
            sortBy: options.sort === 'duration' ? 'Duration' : options.sort === 'name' ? 'Name' : 'Created',
            sortOrder: options.order as 'asc' | 'desc',
          });
        } else {
          output.output(recordings);
        }

        logger.endCommand('recordings list');
      } catch (err) {
        handleError(err, 'recordings list');
        process.exit(1);
      }
    });

  // Start recording
  recordingCmd
    .command('start')
    .description('Start a new recording session')
    .option('-n, --name <name>', 'Recording name')
    .option('-d, --description <description>', 'Recording description')
    .option('-p, --project <projectId>', 'Project ID')
    .option('-t, --type <type>', 'Recording type (mobile|web)')
    .option('-u, --url <url>', 'URL for web recording')
    .option('--device <device>', 'Device name for mobile recording')
    .option('--browser <browser>', 'Browser for web recording (chrome|firefox|safari)')
    .option('--headless', 'Run in headless mode (web recording only)')
    .option('--resolution <resolution>', 'Screen resolution (e.g., 1920x1080)')
    .option('--timeout <seconds>', 'Recording timeout in seconds', '300')
    .option('--interactive', 'Interactive mode (default)')
    .action(async (options: StartRecordingOptions) => {
      try {
        logger.startCommand('recordings start');

        let recordingData: StartRecordingOptions = { ...options };

        // Interactive mode by default
        if (options.interactive !== false && (!options.name || !options.type)) {
          const answers = await inquirer.prompt<StartRecordingOptions>([
            {
              type: 'input',
              name: 'name',
              message: 'Recording name:',
              validate: (input) => {
                if (!input.trim()) return 'Recording name is required';
                if (input.length < 3) return 'Recording name must be at least 3 characters';
                return true;
              },
              when: !options.name,
            },
            {
              type: 'input',
              name: 'description',
              message: 'Recording description (optional):',
              when: !options.description,
            },
            {
              type: 'list',
              name: 'type',
              message: 'Recording type:',
              choices: [
                { name: 'Mobile Application', value: 'mobile' },
                { name: 'Web Application', value: 'web' },
              ],
              when: !options.type,
            },
            {
              type: 'list',
              name: 'projectId',
              message: 'Select project:',
              choices: async () => {
                try {
                  const response = await api.get('/projects');
                  return response.data?.map((project: any) => ({
                    name: `${project.name} (${project.type})`,
                    value: project.id,
                  })) || [];
                } catch {
                  return [{ name: 'No projects available', value: null }];
                }
              },
              when: !options.projectId,
            },
            {
              type: 'input',
              name: 'url',
              message: 'Application URL:',
              validate: (input) => {
                if (!input.trim()) return 'URL is required for web recording';
                try {
                  new URL(input);
                  return true;
                } catch {
                  return 'Please enter a valid URL';
                }
              },
              when: (answers) => answers.type === 'web' && !options.url,
            },
            {
              type: 'list',
              name: 'browser',
              message: 'Select browser:',
              choices: [
                { name: 'Chrome', value: 'chrome' },
                { name: 'Firefox', value: 'firefox' },
                { name: 'Safari', value: 'safari' },
              ],
              default: 'chrome',
              when: (answers) => answers.type === 'web' && !options.browser,
            },
            {
              type: 'confirm',
              name: 'headless',
              message: 'Run in headless mode?',
              default: false,
              when: (answers) => answers.type === 'web' && !options.headless,
            },
            {
              type: 'input',
              name: 'resolution',
              message: 'Screen resolution (e.g., 1920x1080):',
              validate: (input) => {
                if (!input) return true;
                const regex = /^\d+x\d+$/;
                return regex.test(input) || 'Please enter a valid resolution (e.g., 1920x1080)';
              },
              when: (answers) => answers.type === 'web' && !options.resolution,
            },
            {
              type: 'input',
              name: 'device',
              message: 'Device identifier:',
              validate: (input) => {
                if (!input.trim()) return 'Device identifier is required for mobile recording';
                return true;
              },
              when: (answers) => answers.type === 'mobile' && !options.device,
            },
          ]);

          recordingData = { ...recordingData, ...answers };
        }

        // Validate required fields
        if (!recordingData.name || !recordingData.type) {
          error('Name and type are required');
          return;
        }

        const spinner = ora('Starting recording session...').start();

        try {
          const response = await api.post<Recording>('/recordings/start', {
            name: recordingData.name,
            description: recordingData.description,
            projectId: recordingData.projectId,
            type: recordingData.type,
            metadata: {
              url: recordingData.url,
              browser: recordingData.browser,
              headless: recordingData.headless,
              resolution: recordingData.resolution,
              device: recordingData.device,
              timeout: parseInt(recordingData.timeout?.toString() || '300'),
            },
          });

          const recording = response.data!;
          spinner.succeed('Recording session started');

          success(`Recording "${recording.name}" started with ID: ${recording.id}`);
          info(`Type: ${recording.type} | Status: ${recording.status}`);

          // Start actual recording based on type
          if (recording.type === 'web') {
            await startWebRecording(recording, recordingData);
          } else {
            await startMobileRecording(recording, recordingData);
          }

        } catch (err: any) {
          spinner.fail('Failed to start recording');
          throw err;
        }

        logger.endCommand('recordings start');
      } catch (err) {
        handleError(err, 'recordings start');
        process.exit(1);
      }
    });

  // Stop recording
  recordingCmd
    .command('stop <recordingId>')
    .description('Stop a recording session')
    .option('--force', 'Force stop without confirmation')
    .action(async (recordingId: string, options) => {
      try {
        logger.startCommand('recordings stop');

        const spinner = ora('Stopping recording...').start();

        try {
          const response = await api.post<Recording>(`/recordings/${recordingId}/stop`);
          const recording = response.data!;

          spinner.succeed('Recording stopped successfully');

          success(`Recording "${recording.name}" has been stopped`);
          info(`Duration: ${recording.duration}s`);
          info(`File size: ${recording.fileSize ? `${(recording.fileSize / 1024 / 1024).toFixed(1)}MB` : 'Processing...'}`);
          info(`Status: ${recording.status}`);

        } catch (err: any) {
          spinner.fail('Failed to stop recording');
          throw err;
        }

        logger.endCommand('recordings stop');
      } catch (err) {
        handleError(err, 'recordings stop');
        process.exit(1);
      }
    });

  // Get recording details
  recordingCmd
    .command('get <recordingId>')
    .description('Get recording details')
    .option('--format <format>', 'Output format (table|json|yaml)', 'table')
    .action(async (recordingId: string, options) => {
      try {
        logger.startCommand('recordings get');

        const spinner = ora('Fetching recording details...').start();

        const response = await api.get<Recording>(`/recordings/${recordingId}`);
        const recording = response.data!;

        spinner.succeed('Recording details retrieved');

        output.setFormat(options.format);

        if (options.format === 'table') {
          header(`Recording: ${recording.name}`);

          const recordingInfo = [
            { 'Field': 'ID', 'Value': recording.id },
            { 'Field': 'Name', 'Value': recording.name },
            { 'Field': 'Description', 'Value': recording.description || 'N/A' },
            { 'Field': 'Project ID', 'Value': recording.projectId },
            { 'Field': 'Type', 'Value': recording.type },
            { 'Field': 'Platform', 'Value': recording.platform || 'N/A' },
            { 'Field': 'Device', 'Value': recording.device || 'N/A' },
            { 'Field': 'Status', 'Value': recording.status },
            { 'Field': 'Duration', 'Value': recording.duration ? `${recording.duration}s` : 'N/A' },
            { 'Field': 'File Size', 'Value': recording.fileSize ? `${(recording.fileSize / 1024 / 1024).toFixed(1)}MB` : 'N/A' },
            { 'Field': 'Created', 'Value': new Date(recording.createdAt).toLocaleString() },
            { 'Field': 'Updated', 'Value': new Date(recording.updatedAt).toLocaleString() },
          ];

          if (recording.metadata) {
            recordingInfo.push(
              { 'Field': 'URL', 'Value': recording.metadata.url || 'N/A' },
              { 'Field': 'Browser', 'Value': recording.metadata.browser || 'N/A' },
              { 'Field': 'Resolution', 'Value': recording.metadata.resolution || 'N/A' },
              { 'Field': 'App Package', 'Value': recording.metadata.appPackage || 'N/A' },
              { 'Field': 'OS Version', 'Value': recording.metadata.osVersion || 'N/A' }
            );
          }

          output.keyValue(recordingInfo);
        } else {
          output.output(recording);
        }

        logger.endCommand('recordings get');
      } catch (err) {
        handleError(err, 'recordings get');
        process.exit(1);
      }
    });

  // Delete recording
  recordingCmd
    .command('delete <recordingId>')
    .description('Delete a recording')
    .option('-f, --force', 'Force delete without confirmation')
    .action(async (recordingId: string, options) => {
      try {
        logger.startCommand('recordings delete');

        // Get recording details for confirmation
        const spinner = ora('Fetching recording details...').start();
        const response = await api.get<Recording>(`/recordings/${recordingId}`);
        const recording = response.data!;
        spinner.succeed('Recording details retrieved');

        // Confirmation step
        if (!options.force) {
          const { confirmed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmed',
              message: `Are you sure you want to delete recording "${recording.name}"? This action cannot be undone.`,
              default: false,
            },
          ]);

          if (!confirmed) {
            info('Recording deletion cancelled');
            return;
          }
        }

        spinner.start('Deleting recording...');

        await api.delete(`/recordings/${recordingId}`);

        spinner.succeed('Recording deleted successfully');

        success(`Recording "${recording.name}" has been permanently deleted`);

        logger.endCommand('recordings delete');
      } catch (err) {
        handleError(err, 'recordings delete');
        process.exit(1);
      }
    });

  // Download recording
  recordingCmd
    .command('download <recordingId>')
    .description('Download recording file')
    .option('-o, --output <path>', 'Output file path')
    .action(async (recordingId: string, options) => {
      try {
        logger.startCommand('recordings download');

        const spinner = ora('Fetching recording details...').start();
        const recordingResponse = await api.get<Recording>(`/recordings/${recordingId}`);
        const recording = recordingResponse.data!;

        if (recording.status !== 'completed') {
          spinner.fail('Recording not ready for download');
          error(`Recording status is "${recording.status}". Only completed recordings can be downloaded.`);
          return;
        }

        spinner.start('Downloading recording...');

        const outputPath = options.output || `recording-${recording.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;

        await api.download(`/recordings/${recordingId}/download`, outputPath);

        spinner.succeed('Recording downloaded successfully');

        success(`Recording saved to: ${outputPath}`);

        logger.endCommand('recordings download');
      } catch (err) {
        handleError(err, 'recordings download');
        process.exit(1);
      }
    });

  return recordingCmd;
};

// Helper functions
async function startWebRecording(recording: Recording, options: StartRecordingOptions): Promise<void> {
  try {
    // Check if Playwright is available
    const playwrightPath = await which('playwright').catch(() => null);
    if (!playwrightPath) {
      error('Playwright not found. Please install it with: npm install -g playwright');
      return;
    }

    info(`Starting web recording for: ${options.url}`);
    info(`Browser: ${options.browser || 'chrome'} | Headless: ${options.headless ? 'Yes' : 'No'}`);

    // Start Playwright recording
    const playwrightArgs = [
      'codegen',
      '--device=Desktop Chrome',
      '--output=recording.js',
      options.url!,
    ];

    if (options.headless) {
      playwrightArgs.push('--headed=false');
    }

    const playwrightProcess = spawn('npx', ['playwright', ...playwrightArgs], {
      stdio: 'inherit',
    });

    info('Playwright recording started. Press Ctrl+C to stop recording.');

    playwrightProcess.on('close', async (code) => {
      if (code === 0) {
        success('Web recording completed successfully');
      } else {
        error(`Web recording failed with code ${code}`);
      }

      // Update recording status
      try {
        await api.post(`/recordings/${recording.id}/stop`);
      } catch (err) {
        logger.error('Failed to update recording status:', err);
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      info('Stopping recording...');
      playwrightProcess.kill('SIGINT');
    });

  } catch (err) {
    error('Failed to start web recording');
    throw err;
  }
}

async function startMobileRecording(recording: Recording, options: StartRecordingOptions): Promise<void> {
  try {
    // Check if Maestro is available
    const maestroPath = await which('maestro').catch(() => null);
    if (!maestroPath) {
      error('Maestro not found. Please install it from: https://maestro.mobile.dev');
      return;
    }

    info(`Starting mobile recording for device: ${options.device}`);

    // Start Maestro recording
    const maestroArgs = [
      'record',
      '--device', options.device!,
      '--output', `recording-${recording.id}.yaml`,
    ];

    const maestroProcess = spawn('maestro', maestroArgs, {
      stdio: 'inherit',
    });

    info('Maestro recording started. Press Ctrl+C to stop recording.');

    maestroProcess.on('close', async (code) => {
      if (code === 0) {
        success('Mobile recording completed successfully');
      } else {
        error(`Mobile recording failed with code ${code}`);
      }

      // Update recording status
      try {
        await api.post(`/recordings/${recording.id}/stop`);
      } catch (err) {
        logger.error('Failed to update recording status:', err);
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      info('Stopping recording...');
      maestroProcess.kill('SIGINT');
    });

  } catch (err) {
    error('Failed to start mobile recording');
    throw err;
  }
}

export const recordingCommands = createRecordingCommands();