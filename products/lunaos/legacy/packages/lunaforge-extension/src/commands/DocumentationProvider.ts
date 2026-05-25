/**
 * Command Documentation Provider
 * Generates and provides comprehensive documentation for all LunaForge commands
 */

import { CommandRegistration } from './types';

export class CommandDocumentation {
  private docs: Map<string, any> = new Map();

  constructor() {
    this.generateDocumentation();
  }

  /**
   * Get documentation for a specific command
   */
  getCommandDocs(commandId: string): any {
    return this.docs.get(commandId) || this.generateDefaultDocs(commandId);
  }

  /**
   * Get documentation for all commands
   */
  getAllDocumentation(): any[] {
    return Array.from(this.docs.values());
  }

  /**
   * Generate comprehensive command documentation
   */
  private generateDocumentation(): void {
    const commandDocs = [
      {
        id: 'lunaforge.buildGraph',
        title: 'Build Project Graph',
        description: 'Build or rebuild the complete project dependency graph by analyzing all files and their relationships.',
        usage: 'lunaforge.buildGraph',
        examples: [
          'lunaforge.buildGraph',
          'Run from command palette: LunaForge: Build Project Graph'
        ],
        category: 'Graph',
        since: '2.0.0'
      },
      {
        id: 'lunaforge.refreshGraph',
        title: 'Refresh Graph',
        description: 'Refresh the current project graph with latest file changes without rebuilding from scratch.',
        usage: 'lunaforge.refreshGraph',
        examples: [
          'lunaforge.refreshGraph',
          'Use when you\'ve made changes and want to update the graph quickly'
        ],
        category: 'Graph',
        since: '2.0.0'
      },
      {
        id: 'lunaforge.openControlCenter',
        title: 'Open Control Center',
        description: 'Open the LunaForge Control Center dashboard with real-time graph metrics, mode management, and configuration options.',
        usage: 'lunaforge.openControlCenter',
        examples: [
          'lunaforge.openControlCenter',
          'Run from command palette: LunaForge: Open Control Center'
        ],
        category: 'Control Center',
        since: '2.1.0'
      },
      {
        id: 'lunaforge.analyzeFile',
        title: 'Analyze Current File',
        description: 'Perform detailed analysis of the currently active file, including dependencies, complexity metrics, and improvement suggestions.',
        usage: 'lunaforge.analyzeFile',
        examples: [
          'lunaforge.analyzeFile',
          'Open any file and run this command for instant analysis'
        ],
        category: 'Analysis',
        since: '2.0.0',
        arguments: [
          {
            name: 'file',
            description: 'File path to analyze (optional, defaults to current file)',
            type: 'string',
            required: false
          }
        ]
      },
      {
        id: 'lunaforge.requestPlan',
        title: 'Request Analysis Plan',
        description: 'Request an AI-powered analysis plan for your project with specific refactoring suggestions and improvement recommendations.',
        usage: 'lunaforge.requestPlan [summary]',
        examples: [
          'lunaforge.requestPlan "Optimize performance bottlenecks"',
          'lunaforge.requestPlan "Improve code organization"',
          'lunaforge.requestPlan "Add missing error handling"'
        ],
        category: 'Analysis',
        since: '2.2.0',
        arguments: [
          {
            name: 'summary',
            description: 'Description of what you want to analyze or improve',
            type: 'string',
            required: false
          }
        ]
      },
      {
        id: 'lunaforge.enterLicense',
        title: 'Enter License Key',
        description: 'Enter or update your LunaForge license key to unlock premium features and capabilities.',
        usage: 'lunaforge.enterLicense',
        examples: [
          'lunaforge.enterLicense',
          'Enter your license key when prompted in the input dialog'
        ],
        category: 'License',
        since: '2.0.0',
        arguments: [
          {
            name: 'key',
            description: 'Your LunaForge license key',
            type: 'string',
            required: false
          }
        ]
      },
      {
        id: 'lunaforge.listModes',
        title: 'List Available Modes',
        description: 'Display all available LunaForge analysis modes with their current status and descriptions.',
        usage: 'lunaforge.listModes',
        examples: [
          'lunaforge.listModes',
          'See all available modes: Galaxy, CodeFlow, TimeTravel, etc.'
        ],
        category: 'Modes',
        since: '2.0.0'
      },
      {
        id: 'lunaforge.activateMode',
        title: 'Activate Mode',
        description: 'Activate a specific LunaForge analysis mode for enhanced code intelligence capabilities.',
        usage: 'lunaforge.activateMode [modeId]',
        examples: [
          'lunaforge.activateMode galaxy',
          'lunaforge.activateMode codeflow',
          'lunaforge.activateMode timetravel'
        ],
        category: 'Modes',
        since: '2.0.0',
        arguments: [
          {
            name: 'modeId',
            description: 'ID of the mode to activate',
            type: 'string',
            required: false,
            options: ['galaxy', 'codeflow', 'timetravel', 'autopsy', 'composer', 'prophecy', 'parallel-universe', 'guardian', 'ritual', 'dream', 'mythic']
          }
        ]
      },
      {
        id: 'lunaforge.exportGraph',
        title: 'Export Graph',
        description: 'Export the project dependency graph to various formats for external analysis or documentation.',
        usage: 'lunaforge.exportGraph [format]',
        examples: [
          'lunaforge.exportGraph json',
          'lunaforge.exportGraph dot',
          'lunaforge.exportGraph svg'
        ],
        category: 'Graph',
        since: '2.1.0',
        arguments: [
          {
            name: 'format',
            description: 'Export format',
            type: 'string',
            required: false,
            default: 'json',
            options: ['json', 'dot', 'svg', 'csv']
          }
        ]
      },
      {
        id: 'lunaforge.showCommandPalette',
        title: 'Show Command Palette',
        description: 'Display all available LunaForge commands in a searchable quick pick menu.',
        usage: 'lunaforge.showCommandPalette [filter]',
        examples: [
          'lunaforge.showCommandPalette',
          'lunaforge.showCommandPalette graph',
          'lunaforge.showCommandPalette analyze'
        ],
        category: 'Core',
        since: '2.1.0',
        arguments: [
          {
            name: 'filter',
            description: 'Text filter to search commands',
            type: 'string',
            required: false
          }
        ]
      }
    ];

    commandDocs.forEach(doc => {
      this.docs.set(doc.id, doc);
    });
  }

  /**
   * Generate default documentation for commands without specific docs
   */
  private generateDefaultDocs(commandId: string): any {
    if (!commandId) {
      return {
        title: 'Unknown Command',
        description: 'No documentation available',
        usage: 'N/A'
      };
    }

    const title = commandId.replace('lunaforge.', '')
      .split(/(?=[A-Z])/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      id: commandId,
      title,
      description: `LunaForge command: ${title}`,
      usage: commandId,
      examples: [commandId],
      category: 'General',
      since: '2.0.0'
    };
  }

  /**
   * Generate documentation for command registration
   */
  generateDocsForRegistration(registration: CommandRegistration): any {
    return {
      id: registration.id,
      title: registration.title,
      description: registration.description,
      usage: registration.id,
      examples: [
        registration.id,
        `Run from command palette: ${registration.title}`
      ],
      category: registration.category || 'General',
      since: '2.0.0',
      keywords: registration.keywords || []
    };
  }

  /**
   * Generate markdown documentation for all commands
   */
  generateMarkdownDocs(): string {
    const docs = this.getAllDocumentation();
    const categories = [...new Set(docs.map(doc => doc.category))];

    let markdown = `# LunaForge Command Reference\n\n`;
    markdown += `Complete reference for all ${docs.length} LunaForge commands.\n\n`;

    categories.forEach(category => {
      const categoryDocs = docs.filter(doc => doc.category === category);

      markdown += `## ${category}\n\n`;

      categoryDocs.forEach(doc => {
        markdown += `### ${doc.title}\n\n`;
        markdown += `**ID:** \`${doc.id}\`\n\n`;
        markdown += `${doc.description}\n\n`;

        if (doc.usage) {
          markdown += `**Usage:**\n\`\`\`\n${doc.usage}\n\`\`\`\n\n`;
        }

        if (doc.examples && doc.examples.length > 0) {
          markdown += `**Examples:**\n`;
          doc.examples.forEach((example: string) => {
            markdown += `- \`${example}\`\n`;
          });
          markdown += '\n';
        }

        if (doc.arguments && doc.arguments.length > 0) {
          markdown += `**Arguments:**\n`;
          doc.arguments.forEach((arg: any) => {
            markdown += `- \`${arg.name}\` (${arg.type}${arg.required ? ', required' : ''}): ${arg.description}\n`;
          });
          markdown += '\n';
        }

        markdown += `**Category:** ${doc.category}  \n`;
        markdown += `**Since:** ${doc.since}\n\n`;
        markdown += `---\n\n`;
      });
    });

    return markdown;
  }

  /**
   * Search documentation
   */
  searchDocumentation(query: string): any[] {
    const docs = this.getAllDocumentation();
    const lowercaseQuery = query.toLowerCase();

    return docs.filter(doc => {
      return (
        doc.title.toLowerCase().includes(lowercaseQuery) ||
        doc.description.toLowerCase().includes(lowercaseQuery) ||
        doc.category.toLowerCase().includes(lowercaseQuery) ||
        doc.id.toLowerCase().includes(lowercaseQuery) ||
        (doc.keywords && doc.keywords.some((keyword: string) => keyword.toLowerCase().includes(lowercaseQuery)))
      );
    });
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): any[] {
    return this.getAllDocumentation().filter(doc => doc.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return [...new Set(this.getAllDocumentation().map(doc => doc.category))];
  }
}