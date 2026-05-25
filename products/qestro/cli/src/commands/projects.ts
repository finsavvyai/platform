/**
 * Project Management Commands for Questro CLI
 * Provides comprehensive project management functionality
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { config } from '../utils/config';
import { api } from '../utils/api-client';
import { logger } from '../utils/logger';
import { handleError } from '../utils/error-handler';
import { output, table, success, error, info, warning, header } from '../utils/output';

interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  type: 'mobile' | 'web' | 'api';
  platform?: string;
  createdAt: string;
  updatedAt: string;
  team?: {
    id: string;
    name: string;
  };
  settings?: {
    environment: 'development' | 'staging' | 'production';
    framework?: string;
    version?: string;
  };
  statistics?: {
    testCount: number;
    recordingCount: number;
    lastTestRun?: string;
  };
}

interface CreateProjectOptions {
  name?: string;
  description?: string;
  type?: 'mobile' | 'web' | 'api';
  platform?: string;
  environment?: 'development' | 'staging' | 'production';
  framework?: string;
  teamId?: string;
}

const createProjectCommands = (): Command => {
  const projectCmd = new Command('projects')
    .description('Project management commands')
    .alias('proj')
    .alias('p');

  // List projects
  projectCmd
    .command('list')
    .description('List all projects')
    .option('-s, --status <status>', 'Filter by status (active|inactive|archived)')
    .option('-t, --type <type>', 'Filter by type (mobile|web|api)')
    .option('--platform <platform>', 'Filter by platform')
    .option('--team <teamId>', 'Filter by team ID')
    .option('--format <format>', 'Output format (table|json|yaml)', 'table')
    .option('--sort <field>', 'Sort by field (name|created|updated)', 'name')
    .option('--order <order>', 'Sort order (asc|desc)', 'asc')
    .option('--limit <number>', 'Limit number of results', '25')
    .action(async (options) => {
      try {
        logger.startCommand('projects list');

        const spinner = ora('Fetching projects...').start();

        const params: any = {
          limit: parseInt(options.limit) || 25,
          sort: options.sort,
          order: options.order,
        };

        if (options.status) params.status = options.status;
        if (options.type) params.type = options.type;
        if (options.platform) params.platform = options.platform;
        if (options.team) params.teamId = options.team;

        const response = await api.get<Project[]>('/projects', { params });
        const projects = response.data || [];

        spinner.succeed(`Found ${projects.length} projects`);

        if (projects.length === 0) {
          info('No projects found');
          return;
        }

        output.setFormat(options.format);

        if (options.format === 'table') {
          header('Projects', `${projects.length} projects found`);

          const projectData = projects.map(project => ({
            ID: project.id.substring(0, 8),
            Name: project.name,
            Type: project.type,
            Platform: project.platform || 'N/A',
            Status: project.status,
            Team: project.team?.name || 'Personal',
            'Tests': project.statistics?.testCount || 0,
            'Recordings': project.statistics?.recordingCount || 0,
            Created: new Date(project.createdAt).toLocaleDateString(),
          }));

          table(projectData, {
            sortBy: options.sort === 'created' ? 'Created' : options.sort === 'updated' ? 'Updated' : 'Name',
            sortOrder: options.order as 'asc' | 'desc',
          });
        } else {
          output.output(projects);
        }

        logger.endCommand('projects list');
      } catch (err) {
        handleError(err, 'projects list');
        process.exit(1);
      }
    });

  // Create project
  projectCmd
    .command('create')
    .description('Create a new project')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .option('-t, --type <type>', 'Project type (mobile|web|api)')
    .option('-p, --platform <platform>', 'Platform (iOS|Android|Web|API)')
    .option('-e, --environment <environment>', 'Environment (development|staging|production)', 'development')
    .option('-f, --framework <framework>', 'Framework or technology stack')
    .option('--team-id <teamId>', 'Team ID (for organization projects)')
    .option('--interactive', 'Interactive mode (default)')
    .action(async (options: CreateProjectOptions) => {
      try {
        logger.startCommand('projects create');

        let projectData: CreateProjectOptions = { ...options };

        // Interactive mode by default
        if (options.interactive !== false && (!options.name || !options.type)) {
          const answers = await inquirer.prompt<CreateProjectOptions>([
            {
              type: 'input',
              name: 'name',
              message: 'Project name:',
              validate: (input) => {
                if (!input.trim()) return 'Project name is required';
                if (input.length < 3) return 'Project name must be at least 3 characters';
                if (!/^[a-zA-Z0-9\-_\s]+$/.test(input)) return 'Project name can only contain letters, numbers, hyphens, underscores, and spaces';
                return true;
              },
              when: !options.name,
            },
            {
              type: 'input',
              name: 'description',
              message: 'Project description:',
              when: !options.description,
            },
            {
              type: 'list',
              name: 'type',
              message: 'Project type:',
              choices: [
                { name: 'Mobile (iOS/Android)', value: 'mobile' },
                { name: 'Web Application', value: 'web' },
                { name: 'API/Service', value: 'api' },
              ],
              when: !options.type,
            },
            {
              type: 'list',
              name: 'platform',
              message: 'Platform:',
              choices: (answers) => {
                if (answers.type === 'mobile') {
                  return [
                    { name: 'iOS', value: 'iOS' },
                    { name: 'Android', value: 'Android' },
                    { name: 'Cross-Platform', value: 'Cross-Platform' },
                  ];
                } else if (answers.type === 'web') {
                  return [
                    { name: 'React', value: 'React' },
                    { name: 'Vue', value: 'Vue' },
                    { name: 'Angular', value: 'Angular' },
                    { name: 'Other', value: 'Other' },
                  ];
                } else {
                  return [
                    { name: 'REST API', value: 'REST API' },
                    { name: 'GraphQL API', value: 'GraphQL API' },
                    { name: 'gRPC', value: 'gRPC' },
                    { name: 'Other', value: 'Other' },
                  ];
                }
              },
              when: !options.platform,
            },
            {
              type: 'list',
              name: 'environment',
              message: 'Environment:',
              choices: [
                { name: 'Development', value: 'development' },
                { name: 'Staging', value: 'staging' },
                { name: 'Production', value: 'production' },
              ],
              default: 'development',
              when: !options.environment,
            },
            {
              type: 'input',
              name: 'framework',
              message: 'Framework/Technology stack:',
              when: !options.framework,
            },
          ]);

          projectData = { ...projectData, ...answers };
        }

        const spinner = ora('Creating project...').start();

        const response = await api.post<Project>('/projects', {
          name: projectData.name,
          description: projectData.description,
          type: projectData.type,
          platform: projectData.platform,
          settings: {
            environment: projectData.environment || 'development',
            framework: projectData.framework,
          },
          ...(projectData.teamId && { teamId: projectData.teamId }),
        });

        const project = response.data!;

        spinner.succeed('Project created successfully');

        success(`Project "${project.name}" created with ID: ${project.id}`);
        info(`Type: ${project.type} | Platform: ${project.platform || 'Not specified'}`);
        info(`Status: ${project.status} | Environment: ${project.settings?.environment}`);

        logger.endCommand('projects create');
      } catch (err) {
        handleError(err, 'projects create');
        process.exit(1);
      }
    });

  // Get project details
  projectCmd
    .command('get <projectId>')
    .description('Get project details')
    .option('--format <format>', 'Output format (table|json|yaml)', 'table')
    .action(async (projectId: string, options) => {
      try {
        logger.startCommand('projects get');

        const spinner = ora('Fetching project details...').start();

        const response = await api.get<Project>(`/projects/${projectId}`);
        const project = response.data!;

        spinner.succeed('Project details retrieved');

        output.setFormat(options.format);

        if (options.format === 'table') {
          header(`Project: ${project.name}`);

          const projectInfo = [
            { 'Field': 'ID', 'Value': project.id },
            { 'Field': 'Name', 'Value': project.name },
            { 'Field': 'Description', 'Value': project.description || 'N/A' },
            { 'Field': 'Type', 'Value': project.type },
            { 'Field': 'Platform', 'Value': project.platform || 'N/A' },
            { 'Field': 'Status', 'Value': project.status },
            { 'Field': 'Environment', 'Value': project.settings?.environment || 'N/A' },
            { 'Field': 'Framework', 'Value': project.settings?.framework || 'N/A' },
            { 'Field': 'Team', 'Value': project.team?.name || 'Personal' },
            { 'Field': 'Created', 'Value': new Date(project.createdAt).toLocaleString() },
            { 'Field': 'Updated', 'Value': new Date(project.updatedAt).toLocaleString() },
          ];

          if (project.statistics) {
            projectInfo.push(
              { 'Field': 'Test Count', 'Value': project.statistics.testCount || 0 },
              { 'Field': 'Recording Count', 'Value': project.statistics.recordingCount || 0 },
              { 'Field': 'Last Test Run', 'Value': project.statistics.lastTestRun ? new Date(project.statistics.lastTestRun).toLocaleDateString() : 'Never' }
            );
          }

          output.keyValue(projectInfo);
        } else {
          output.output(project);
        }

        logger.endCommand('projects get');
      } catch (err) {
        handleError(err, 'projects get');
        process.exit(1);
      }
    });

  // Update project
  projectCmd
    .command('update <projectId>')
    .description('Update project details')
    .option('-n, --name <name>', 'New project name')
    .option('-d, --description <description>', 'New project description')
    .option('-s, --status <status>', 'New status (active|inactive|archived)')
    .option('-p, --platform <platform>', 'New platform')
    .option('-e, --environment <environment>', 'New environment')
    .option('-f, --framework <framework>', 'New framework')
    .action(async (projectId: string, options) => {
      try {
        logger.startCommand('projects update');

        // Get current project details
        const spinner = ora('Fetching current project details...').start();
        const currentResponse = await api.get<Project>(`/projects/${projectId}`);
        const currentProject = currentResponse.data!;
        spinner.succeed('Current details retrieved');

        // Prepare update data
        const updateData: any = {};

        if (options.name) updateData.name = options.name;
        if (options.description) updateData.description = options.description;
        if (options.status) updateData.status = options.status;
        if (options.platform || options.environment || options.framework) {
          updateData.settings = {
            ...currentProject.settings,
            ...(options.platform && { platform: options.platform }),
            ...(options.environment && { environment: options.environment }),
            ...(options.framework && { framework: options.framework }),
          };
        }

        if (Object.keys(updateData).length === 0) {
          warning('No updates specified');
          return;
        }

        // Confirm update
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: `Update project "${currentProject.name}" with the specified changes?`,
            default: true,
          },
        ]);

        if (!confirmed) {
          info('Update cancelled');
          return;
        }

        spinner.start('Updating project...');

        const updateResponse = await api.patch<Project>(`/projects/${projectId}`, updateData);
        const updatedProject = updateResponse.data!;

        spinner.succeed('Project updated successfully');

        success(`Project "${updatedProject.name}" has been updated`);
        info(`Last updated: ${new Date(updatedProject.updatedAt).toLocaleString()}`);

        logger.endCommand('projects update');
      } catch (err) {
        handleError(err, 'projects update');
        process.exit(1);
      }
    });

  // Delete project
  projectCmd
    .command('delete <projectId>')
    .description('Delete a project')
    .option('-f, --force', 'Force delete without confirmation')
    .action(async (projectId: string, options) => {
      try {
        logger.startCommand('projects delete');

        // Get project details for confirmation
        const spinner = ora('Fetching project details...').start();
        const response = await api.get<Project>(`/projects/${projectId}`);
        const project = response.data!;
        spinner.succeed('Project details retrieved');

        // Confirmation step
        if (!options.force) {
          const { confirmed, projectName } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmed',
              message: `Are you sure you want to delete project "${project.name}"? This action cannot be undone.`,
              default: false,
            },
            {
              type: 'input',
              name: 'projectName',
              message: `Type "${project.name}" to confirm deletion:`,
              validate: (input) => {
                return input === project.name || 'Project name does not match';
              },
              when: (answers) => answers.confirmed,
            },
          ]);

          if (!confirmed || projectName !== project.name) {
            info('Project deletion cancelled');
            return;
          }
        }

        spinner.start('Deleting project...');

        await api.delete(`/projects/${projectId}`);

        spinner.succeed('Project deleted successfully');

        success(`Project "${project.name}" has been permanently deleted`);
        warning('All associated tests, recordings, and data have been removed');

        logger.endCommand('projects delete');
      } catch (err) {
        handleError(err, 'projects delete');
        process.exit(1);
      }
    });

  // Set default project
  projectCmd
    .command('set-default <projectId>')
    .description('Set a project as the default for the current profile')
    .action(async (projectId: string) => {
      try {
        logger.startCommand('projects set-default');

        const spinner = ora('Verifying project...').start();

        // Verify project exists
        const response = await api.get<Project>(`/projects/${projectId}`);
        const project = response.data!;

        spinner.succeed('Project verified');

        // Set as default
        config.set('defaults.project', projectId);

        success(`Project "${project.name}" set as default`);
        info(`This project will be used as the default for all commands`);

        logger.endCommand('projects set-default');
      } catch (err) {
        handleError(err, 'projects set-default');
        process.exit(1);
      }
    });

  // Get default project
  projectCmd
    .command('get-default')
    .description('Get the default project for the current profile')
    .action(async () => {
      try {
        const defaultProjectId = config.get('defaults.project');

        if (!defaultProjectId) {
          warning('No default project set');
          info('Use "qestro projects set-default <projectId>" to set a default project');
          return;
        }

        const spinner = ora('Fetching default project details...').start();

        const response = await api.get<Project>(`/projects/${defaultProjectId}`);
        const project = response.data!;

        spinner.succeed('Default project retrieved');

        header('Default Project');
        output.keyValue({
          'Project ID': project.id,
          'Name': project.name,
          'Type': project.type,
          'Status': project.status,
          'Created': new Date(project.createdAt).toLocaleDateString(),
        });
      } catch (err) {
        handleError(err, 'projects get-default');
        process.exit(1);
      }
    });

  // Project statistics
  projectCmd
    .command('stats [projectId]')
    .description('Show project statistics')
    .option('--days <number>', 'Number of days to include in statistics', '30')
    .action(async (projectId?: string, options) => {
      try {
        logger.startCommand('projects stats');

        let targetProjectId = projectId;

        // Use default project if not specified
        if (!targetProjectId) {
          targetProjectId = config.get('defaults.project');
          if (!targetProjectId) {
            error('No project specified and no default project set');
            info('Use "qestro projects set-default <projectId>" to set a default project');
            return;
          }
        }

        const spinner = ora('Fetching project statistics...').start();

        const response = await api.get(`/projects/${targetProjectId}/statistics`, {
          params: { days: parseInt(options.days) },
        });

        const stats = response.data!;

        spinner.succeed('Statistics retrieved');

        header(`Project Statistics - Last ${options.days} days`);

        const statsData = [
          { 'Metric': 'Total Tests', 'Value': stats.totalTests || 0 },
          { 'Metric': 'Passed Tests', 'Value': stats.passedTests || 0 },
          { 'Metric': 'Failed Tests', 'Value': stats.failedTests || 0 },
          { 'Metric': 'Success Rate', 'Value': `${stats.successRate || 0}%` },
          { 'Metric': 'Total Recordings', 'Value': stats.totalRecordings || 0 },
          { 'Metric': 'Avg Test Duration', 'Value': `${stats.avgTestDuration || 0}s` },
          { 'Metric': 'Last Test Run', 'Value': stats.lastTestRun ? new Date(stats.lastTestRun).toLocaleString() : 'Never' },
        ];

        output.keyValue(statsData);

        logger.endCommand('projects stats');
      } catch (err) {
        handleError(err, 'projects stats');
        process.exit(1);
      }
    });

  return projectCmd;
};

export const projectCommands = createProjectCommands();