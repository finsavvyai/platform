/**
 * OpenSyber MCP Tool Definitions
 *
 * Defines all available tools and their JSON schemas for the MCP server.
 */

export const TOOLS = [
  {
    name: 'opensyber_scan_dependency',
    description:
      'Check if an npm package is safe to install. Returns a safety assessment ' +
      '(safe / suspicious / malicious) with detailed reasons and known CVEs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        package: {
          type: 'string',
          description: 'npm package name (e.g. "lodash", "@types/node")',
        },
        version: {
          type: 'string',
          description: 'Specific version to check (e.g. "4.17.21"). Defaults to latest.',
        },
      },
      required: ['package'],
    },
  },
  {
    name: 'opensyber_check_security',
    description:
      'Get a security score for a project directory. Returns a score breakdown ' +
      'across 8 categories: dependencies, secrets, auth, input validation, ' +
      'encryption, logging, access control, and infrastructure.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project root. Defaults to current directory.',
        },
      },
    },
  },
  {
    name: 'opensyber_query_threats',
    description:
      'Get current AI agent threat intelligence. Returns recent threats ' +
      'targeting AI agents including prompt injection, supply chain attacks, ' +
      'and model exfiltration attempts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium'],
          description: 'Filter by minimum severity level. Defaults to "high".',
        },
      },
    },
  },
  {
    name: 'opensyber_list_skills',
    description:
      'Browse the OpenSyber audited skill marketplace. Returns available ' +
      'skills that AI agents can install for security monitoring, scanning, ' +
      'and compliance tasks.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description:
            'Filter by category (e.g. "monitoring", "scanning", "compliance", "networking").',
        },
      },
    },
  },
  {
    name: 'opensyber_protect',
    description:
      'Generate a security configuration snippet for a web framework. ' +
      'Returns integration code with TokenForge device binding, rate limiting, ' +
      'CORS, and CSP headers.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        framework: {
          type: 'string',
          enum: ['express', 'hono', 'nextjs', 'fastify'],
          description: 'Target web framework for the security config.',
        },
      },
      required: ['framework'],
    },
  },
] as const;
