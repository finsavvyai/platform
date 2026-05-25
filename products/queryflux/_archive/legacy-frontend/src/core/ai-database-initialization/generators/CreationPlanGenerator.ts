/**
 * Creation Plan Generator for Database Initialization
 *
 * This component generates detailed, step-by-step plans for creating
 * and configuring databases, including infrastructure setup,
 * configuration, validation, and rollback procedures.
 */

import {
  DatabaseCreationPlan,
  AIDatabaseAnalysis,
  DatabaseRecommendation,
  CreationStep,
  CommandStep,
  ValidationStep,
  Prerequisite,
  RollbackStep,
  AIDatabaseInitializationConfig
} from '../types';

export class CreationPlanGenerator {
  private config: AIDatabaseInitializationConfig;

  constructor(config: AIDatabaseInitializationConfig) {
    this.config = config;
  }

  /**
   * Generate complete creation plan
   */
  async generate(
    analysis: AIDatabaseAnalysis,
    recommendation: DatabaseRecommendation
  ): Promise<DatabaseCreationPlan> {
    const planId = this.generatePlanId();

    const steps = await this.generateCreationSteps(analysis, recommendation);
    const prerequisites = this.generatePrerequisites(recommendation);
    const rollbackPlan = this.generateRollbackPlan(steps);
    const estimatedDuration = this.calculateEstimatedDuration(steps);
    const estimatedCost = recommendation.estimatedCost;

    return {
      id: planId,
      analysis,
      selectedDatabase: recommendation,
      steps,
      estimatedDuration,
      estimatedCost,
      prerequisites,
      rollbackPlan
    };
  }

  /**
   * Generate creation steps
   */
  private async generateCreationSteps(
    analysis: AIDatabaseAnalysis,
    recommendation: DatabaseRecommendation
  ): Promise<CreationStep[]> {
    const steps: CreationStep[] = [];
    const dbType = recommendation.databaseType;

    // Step 1: Prerequisites and Environment Setup
    steps.push({
      id: 'prerequisites',
      name: 'Prerequisites and Environment Setup',
      description: 'Verify system requirements and prepare the environment',
      type: 'infrastructure',
      order: 1,
      estimatedDuration: 10,
      dependencies: [],
      commands: [
        {
          command: 'check_system_requirements',
          context: 'shell',
          parameters: {
            min_memory: '4GB',
            min_disk: '50GB',
            os_type: 'linux'
          }
        }
      ],
      validation: [
        {
          type: 'connectivity',
          test: 'system_resources_check',
          expectedResult: 'sufficient_resources',
          tolerance: 0
        }
      ]
    });

    // Step 2: Database Server Installation
    steps.push({
      id: 'install_database',
      name: `Install ${dbType} Server`,
      description: `Install and configure ${dbType} database server`,
      type: 'infrastructure',
      order: 2,
      estimatedDuration: this.getInstallationDuration(dbType),
      dependencies: ['prerequisites'],
      commands: this.getInstallationCommands(dbType),
      validation: [
        {
          type: 'connectivity',
          test: 'database_service_status',
          expectedResult: 'running',
          tolerance: 0
        }
      ]
    });

    // Step 3: Database Creation
    steps.push({
      id: 'create_database',
      name: 'Create Database Instance',
      description: `Create the main database instance and configure basic settings`,
      type: 'configuration',
      order: 3,
      estimatedDuration: 5,
      dependencies: ['install_database'],
      commands: [
        {
          command: `CREATE DATABASE ${recommendation.configuration.database}`,
          context: 'sql',
          parameters: {
            encoding: 'UTF8',
            collation: 'en_US.UTF-8'
          }
        }
      ],
      validation: [
        {
          type: 'functionality',
          test: 'database_exists',
          expectedResult: 'true',
          tolerance: 0
        }
      ]
    });

    // Step 4: User and Security Configuration
    steps.push({
      id: 'configure_security',
      name: 'Configure Users and Security',
      description: 'Create database users and configure security settings',
      type: 'configuration',
      order: 4,
      estimatedDuration: 10,
      dependencies: ['create_database'],
      commands: this.getSecurityCommands(recommendation),
      validation: [
        {
          type: 'security',
          test: 'user_authentication',
          expectedResult: 'success',
          tolerance: 0
        }
      ]
    });

    // Step 5: Schema and Tables Creation
    steps.push({
      id: 'create_schema',
      name: 'Create Schema and Tables',
      description: 'Create database schema and initialize tables based on analysis',
      type: 'migration',
      order: 5,
      estimatedDuration: 15,
      dependencies: ['configure_security'],
      commands: this.getSchemaCommands(analysis, dbType),
      validation: [
        {
          type: 'data_integrity',
          test: 'schema_validation',
          expectedResult: 'valid',
          tolerance: 0
        }
      ]
    });

    // Step 6: Indexes and Performance Optimization
    steps.push({
      id: 'optimize_performance',
      name: 'Configure Indexes and Performance',
      description: 'Create indexes and apply performance optimizations',
      type: 'configuration',
      order: 6,
      estimatedDuration: 20,
      dependencies: ['create_schema'],
      commands: this.getOptimizationCommands(recommendation),
      validation: [
        {
          type: 'performance',
          test: 'query_performance_test',
          expectedResult: '<100ms',
          tolerance: 20
        }
      ]
    });

    // Step 7: Backup and Monitoring Setup
    steps.push({
      id: 'setup_monitoring',
      name: 'Configure Backup and Monitoring',
      description: 'Set up backup schedules and monitoring systems',
      type: 'configuration',
      order: 7,
      estimatedDuration: 15,
      dependencies: ['optimize_performance'],
      commands: this.getMonitoringCommands(recommendation),
      validation: [
        {
          type: 'functionality',
          test: 'monitoring_status',
          expectedResult: 'active',
          tolerance: 0
        }
      ]
    });

    // Step 8: Data Migration (if applicable)
    if (analysis.inputType === 'dump_file') {
      steps.push({
        id: 'migrate_data',
        name: 'Migrate Existing Data',
        description: 'Import data from dump file',
        type: 'migration',
        order: 8,
        estimatedDuration: 30,
        dependencies: ['create_schema'],
        commands: [
          {
            command: 'import_dump_file',
            context: 'shell',
            parameters: {
              file_path: 'path/to/dump.file',
              database: recommendation.configuration.database
            }
          }
        ],
        validation: [
          {
            type: 'data_integrity',
            test: 'row_count_validation',
            expectedResult: 'matches_expected',
            tolerance: 5
          }
        ]
      });
    }

    // Step 9: Final Testing and Validation
    steps.push({
      id: 'final_validation',
      name: 'Final Testing and Validation',
      description: 'Perform comprehensive testing of the database setup',
      type: 'validation',
      order: 9,
      estimatedDuration: 15,
      dependencies: steps.slice(6).map(s => s.id),
      commands: [
        {
          command: 'run_comprehensive_tests',
          context: 'shell',
          parameters: {
            test_suite: 'database_initialization',
            timeout: 600
          }
        }
      ],
      validation: [
        {
          type: 'functionality',
          test: 'all_tests_passed',
          expectedResult: 'true',
          tolerance: 0
        }
      ]
    });

    // Step 10: Documentation
    steps.push({
      id: 'documentation',
      name: 'Generate Documentation',
      description: 'Create documentation for the database setup',
      type: 'documentation',
      order: 10,
      estimatedDuration: 10,
      dependencies: ['final_validation'],
      commands: [
        {
          command: 'generate_database_docs',
          context: 'shell',
          parameters: {
            output_format: 'html',
            include_diagrams: true
          }
        }
      ],
      validation: [
        {
          type: 'functionality',
          test: 'documentation_generated',
          expectedResult: 'true',
          tolerance: 0
        }
      ]
    });

    return steps;
  }

  /**
   * Generate prerequisites
   */
  private generatePrerequisites(recommendation: DatabaseRecommendation): Prerequisite[] {
    const prerequisites: Prerequisite[] = [
      {
        type: 'software',
        description: 'Docker or container runtime (if using containerized deployment)',
        required: false,
        verificationMethod: 'docker --version'
      },
      {
        type: 'software',
        description: 'Database client tools for ' + recommendation.databaseType,
        required: true,
        verificationMethod: this.getClientVerificationCommand(recommendation.databaseType)
      },
      {
        type: 'hardware',
        description: 'Minimum 4GB RAM, 50GB disk space',
        required: true,
        verificationMethod: 'free -h && df -h'
      },
      {
        type: 'network',
        description: 'Outbound internet connectivity for package downloads',
        required: true,
        verificationMethod: 'ping -c 1 google.com'
      },
      {
        type: 'permissions',
        description: 'Administrative/sudo access for system-level installations',
        required: false,
        verificationMethod: 'sudo -n true'
      }
    ];

    return prerequisites;
  }

  /**
   * Generate rollback plan
   */
  private generateRollbackPlan(steps: CreationStep[]): RollbackStep[] {
    const rollbackSteps: RollbackStep[] = [];

    // Reverse order of steps for rollback
    const reversedSteps = [...steps].reverse();

    reversedSteps.forEach(step => {
      if (step.type === 'migration' || step.type === 'configuration') {
        rollbackSteps.push({
          description: `Rollback ${step.name}`,
          command: this.getRollbackCommand(step),
          context: 'shell',
          order: rollbackSteps.length + 1
        });
      }
    });

    return rollbackSteps;
  }

  /**
   * Get installation commands for different database types
   */
  private getInstallationCommands(dbType: string): CommandStep[] {
    const commandMap: Record<string, CommandStep[]> = {
      postgresql: [
        {
          command: 'apt-get update && apt-get install -y postgresql postgresql-contrib',
          context: 'shell',
          parameters: { version: '14' }
        },
        {
          command: 'systemctl start postgresql && systemctl enable postgresql',
          context: 'shell'
        }
      ],
      mysql: [
        {
          command: 'apt-get update && apt-get install -y mysql-server',
          context: 'shell',
          parameters: { version: '8.0' }
        },
        {
          command: 'systemctl start mysql && systemctl enable mysql',
          context: 'shell'
        }
      ],
      mongodb: [
        {
          command: 'wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -',
          context: 'shell'
        },
        {
          command: 'apt-get install -y mongodb-org',
          context: 'shell'
        },
        {
          command: 'systemctl start mongod && systemctl enable mongod',
          context: 'shell'
        }
      ],
      redis: [
        {
          command: 'apt-get install -y redis-server',
          context: 'shell'
        },
        {
          command: 'systemctl start redis-server && systemctl enable redis-server',
          context: 'shell'
        }
      ]
    };

    return commandMap[dbType.toLowerCase()] || [
      {
        command: `# Manual installation required for ${dbType}`,
        context: 'shell',
        errorMessage: 'Please refer to official documentation for installation instructions'
      }
    ];
  }

  /**
   * Get security configuration commands
   */
  private getSecurityCommands(recommendation: DatabaseRecommendation): CommandStep[] {
    const dbType = recommendation.databaseType.toLowerCase();
    const config = recommendation.configuration;

    return [
      {
        command: `CREATE USER ${config.user} WITH PASSWORD '${config.password || 'secure_password'}'`,
        context: 'sql',
        parameters: { encrypted_password: true }
      },
      {
        command: `GRANT ALL PRIVILEGES ON DATABASE ${config.database} TO ${config.user}`,
        context: 'sql'
      },
      {
        command: 'REVOKE ALL ON SCHEMA public FROM PUBLIC',
        context: 'sql'
      }
    ];
  }

  /**
   * Get schema creation commands
   */
  private getSchemaCommands(analysis: AIDatabaseAnalysis, dbType: string): CommandStep[] {
    const commands: CommandStep[] = [];

    // Add commands based on dump file analysis if available
    if (analysis.inputType === 'dump_file') {
      commands.push({
        command: 'apply_schema_from_analysis',
        context: 'sql',
        parameters: {
          table_count: analysis.extractedRequirements.length,
          estimated_complexity: 'medium'
        }
      });
    } else {
      // Generate basic schema based on requirements
      commands.push({
        command: 'create_basic_schema',
        context: 'sql',
        parameters: {
          tables: this.generateTableDefinitions(analysis)
        }
      });
    }

    return commands;
  }

  /**
   * Get optimization commands
   */
  private getOptimizationCommands(recommendation: DatabaseRecommendation): CommandStep[] {
    const commands: CommandStep[] = [];

    recommendation.configuration.optimizations.forEach(opt => {
      commands.push({
        command: `apply_optimization_${opt.type}`,
        context: 'sql',
        parameters: opt.parameters
      });
    });

    return commands;
  }

  /**
   * Get monitoring setup commands
   */
  private getMonitoringCommands(recommendation: DatabaseRecommendation): CommandStep[] {
    return [
      {
        command: 'setup_backup_schedule',
        context: 'shell',
        parameters: recommendation.configuration.backupStrategy
      },
      {
        command: 'configure_monitoring',
        context: 'shell',
        parameters: recommendation.configuration.monitoring
      },
      {
        command: 'setup_alerts',
        context: 'shell',
        parameters: {
          alerts: recommendation.configuration.monitoring.alerts
        }
      }
    ];
  }

  /**
   * Calculate estimated duration
   */
  private calculateEstimatedDuration(steps: CreationStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedDuration, 0);
  }

  /**
   * Get installation duration by database type
   */
  private getInstallationDuration(dbType: string): number {
    const durationMap: Record<string, number> = {
      postgresql: 15,
      mysql: 12,
      mongodb: 18,
      redis: 5,
      sqlserver: 25,
      oracle: 30
    };

    return durationMap[dbType.toLowerCase()] || 20;
  }

  /**
   * Get client verification command
   */
  private getClientVerificationCommand(dbType: string): string {
    const commandMap: Record<string, string> = {
      postgresql: 'psql --version',
      mysql: 'mysql --version',
      mongodb: 'mongosh --version',
      redis: 'redis-cli --version',
      sqlserver: 'sqlcmd --version'
    };

    return commandMap[dbType.toLowerCase()] || 'echo "Client verification not available"';
  }

  /**
   * Get rollback command for a step
   */
  private getRollbackCommand(step: CreationStep): string {
    switch (step.id) {
      case 'create_database':
        return 'DROP DATABASE IF EXISTS created_database;';
      case 'configure_security':
        return 'DROP USER IF EXISTS created_user;';
      case 'create_schema':
        return 'DROP SCHEMA IF EXISTS created_schema CASCADE;';
      case 'optimize_performance':
        return 'DROP INDEX IF EXISTS created_indexes;';
      default:
        return `# Rollback for ${step.name} - manual intervention may be required`;
    }
  }

  /**
   * Generate table definitions from analysis
   */
  private generateTableDefinitions(analysis: AIDatabaseAnalysis): string {
    // This would generate SQL table definitions based on the requirements
    // For now, return a placeholder
    return 'users, products, orders'; // Simplified example
  }

  /**
   * Generate plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export plan as different formats
   */
  exportAsJSON(plan: DatabaseCreationPlan): string {
    return JSON.stringify(plan, null, 2);
  }

  exportAsMarkdown(plan: DatabaseCreationPlan): string {
    let markdown = `# Database Creation Plan: ${plan.selectedDatabase.databaseType}\n\n`;

    markdown += `**Estimated Duration:** ${plan.estimatedDuration} minutes\n`;
    markdown += `**Estimated Cost:** $${plan.estimatedCost.monthly}/month\n\n`;

    markdown += `## Prerequisites\n\n`;
    plan.prerequisites.forEach(prereq => {
      markdown += `- ${prereq.description} ${prereq.required ? '(Required)' : '(Optional)'}\n`;
    });

    markdown += `\n## Creation Steps\n\n`;
    plan.steps.forEach(step => {
      markdown += `### ${step.order}. ${step.name}\n`;
      markdown += `**Duration:** ${step.estimatedDuration} minutes\n`;
      markdown += `**Description:** ${step.description}\n\n`;

      if (step.commands.length > 0) {
        markdown += `**Commands:**\n`;
        step.commands.forEach(cmd => {
          markdown += `- \`${cmd.command}\` (${cmd.context})\n`;
        });
        markdown += '\n';
      }

      if (step.validation.length > 0) {
        markdown += `**Validation:**\n`;
        step.validation.forEach(validation => {
          markdown += `- ${validation.type}: ${validation.test}\n`;
        });
        markdown += '\n';
      }
    });

    markdown += `## Rollback Plan\n\n`;
    plan.rollbackPlan.forEach(rollback => {
      markdown += `${rollback.order}. ${rollback.description}\n`;
      markdown += `   Command: \`${rollback.command}\`\n\n`;
    });

    return markdown;
  }

  /**
   * Get step-by-step execution guide
   */
  getExecutionGuide(plan: DatabaseCreationPlan): string {
    let guide = `Database Creation Execution Guide\n`;
    guide += `===================================\n\n`;

    guide += `This guide will walk you through creating a ${plan.selectedDatabase.databaseType} database.\n\n`;

    guide += `Before you begin:\n`;
    guide += `- Estimated time: ${plan.estimatedDuration} minutes\n`;
    guide += `- Estimated cost: $${plan.estimatedCost.monthly}/month\n`;
    guide += `- Verify all prerequisites are met\n\n`;

    plan.steps.forEach(step => {
      guide += `Step ${step.order}: ${step.name}\n`;
      guide += `${'='.repeat(50)}\n`;
      guide += `Description: ${step.description}\n`;
      guide += `Estimated time: ${step.estimatedDuration} minutes\n\n`;

      if (step.dependencies.length > 0) {
        guide += `Prerequisites: ${step.dependencies.join(', ')}\n\n`;
      }

      if (step.commands.length > 0) {
        guide += `Commands to execute:\n`;
        step.commands.forEach((cmd, index) => {
          guide += `${index + 1}. ${cmd.command}\n`;
          if (cmd.context !== 'shell') {
            guide += `   Context: ${cmd.context}\n`;
          }
          if (cmd.parameters) {
            guide += `   Parameters: ${JSON.stringify(cmd.parameters, null, 2)}\n`;
          }
        });
        guide += '\n';
      }

      if (step.validation.length > 0) {
        guide += `Validation steps:\n`;
        step.validation.forEach((validation, index) => {
          guide += `${index + 1}. ${validation.type}: ${validation.test}\n`;
          guide += `   Expected: ${validation.expectedResult}\n`;
        });
        guide += '\n';
      }

      guide += `---\n\n`;
    });

    return guide;
  }
}
