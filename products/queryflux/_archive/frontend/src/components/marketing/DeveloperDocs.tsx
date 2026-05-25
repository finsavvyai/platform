import { useState } from 'react';
import { Search, Code, Database, Terminal, Book, ChevronRight, Copy, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function DeveloperDocs() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const docSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      content: [
        {
          type: 'text',
          content: 'QueryFlux provides a comprehensive API for database management, AI-powered query generation, and real-time collaboration. This guide will help you integrate QueryFlux into your applications.'
        },
        {
          type: 'code',
          language: 'bash',
          content: `# Install QueryFlux CLI
npm install -g @queryflux/cli

# Authenticate
queryflux auth login

# Initialize new project
queryflux init my-project`
        }
      ]
    },
    {
      id: 'authentication',
      title: 'Authentication',
      content: [
        {
          type: 'text',
          content: 'QueryFlux uses API keys for authentication. You can generate API keys from your account dashboard.'
        },
        {
          type: 'code',
          language: 'javascript',
          content: `const QueryFlux = require('@queryflux/sdk');

const client = new QueryFlux({
  apiKey: 'your-api-key-here',
  endpoint: 'https://api.queryflux.com'
});

// Test authentication
async function testConnection() {
  try {
    const user = await client.auth.getUser();
    console.log('Authenticated as:', user.email);
  } catch (error) {
    console.error('Authentication failed:', error.message);
  }
}`
        }
      ]
    },
    {
      id: 'database-connections',
      title: 'Database Connections',
      content: [
        {
          type: 'text',
          content: 'Connect to various database types using our unified API. QueryFlux supports 35+ database engines.'
        },
        {
          type: 'code',
          language: 'javascript',
          content: `// Connect to PostgreSQL
const pgConnection = await client.databases.connect({
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password: 'password',
  ssl: true
});

// Connect to MongoDB
const mongoConnection = await client.databases.connect({
  type: 'mongodb',
  connectionString: 'mongodb://localhost:27017/mydb'
});

// List all connections
const connections = await client.databases.list();
console.log('Active connections:', connections);`
        }
      ]
    },
    {
      id: 'query-execution',
      title: 'Query Execution',
      content: [
        {
          type: 'text',
          content: 'Execute SQL queries with automatic optimization and real-time result streaming.'
        },
        {
          type: 'code',
          language: 'javascript',
          content: `// Execute a simple query
const result = await client.query.execute(\n  connectionId,\n  'SELECT * FROM users WHERE active = true LIMIT 10'\n);\n\n// Process results\nfor (const row of result.rows) {\n  console.log('User:', row.name, row.email);\n}\n\n// Execute with parameters\nconst paramResult = await client.query.execute(\n  connectionId,\n  'SELECT * FROM users WHERE department = $1 AND salary > $2',\n  ['Engineering', 50000]\n);\n\n// Get query execution plan\nconst plan = await client.query.explain(\n  connectionId,\n  'SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id'\n);\nconsole.log('Query plan:', plan);`
        },
        {
          type: 'text',
          content: 'QueryFlux also supports natural language to SQL conversion using our AI engine:'
        },
        {
          type: 'code',
          language: 'javascript',
          content: `// Convert natural language to SQL\nconst aiQuery = await client.ai.generateQuery({\n  connectionId,\n  naturalLanguage: 'Show me the top 10 customers by total revenue this year',\n  databaseSchema: schemaObject\n});\n\nconsole.log('Generated SQL:', aiQuery.sql);\nconsole.log('Confidence:', aiQuery.confidence);\n\n// Execute the AI-generated query\nconst result = await client.query.execute(connectionId, aiQuery.sql);`
        }
      ]
    },
    {
      id: 'code-generation',
      title: 'Code Generation',
      content: [
        {
          type: 'text',
          content: 'Automatically generate APIs, ORMs, and client libraries from your database schema.'
        },
        {
          type: 'code',
          language: 'javascript',
          content: `// Generate TypeScript ORM\nconst orm = await client.code.generateORM({\n  connectionId,\n  language: 'typescript',\n  framework: 'prisma',\n  outputDirectory: './src/generated'\n});\n\n// Generate Express.js API\nconst api = await client.code.generateAPI({\n  connectionId,\n  framework: 'express',\n  language: 'typescript',\n  features: ['crud', 'authentication', 'validation']\n});\n\n// Generate React components\nconst components = await client.code.generateComponents({\n  connectionId,\n  framework: 'react',\n  language: 'typescript',\n  templates: ['table', 'form', 'detail']\n});`
        }
      ]
    },
    {
      id: 'real-time-features',
      title: 'Real-time Features',
      content: [
        {
          type: 'text',
          content: 'Subscribe to real-time database events and collaborate with your team.'
        },
        {
          type: 'code',
          language: 'javascript',
          content: `// Subscribe to database changes\nconst subscription = await client.realtime.subscribe({\n  connectionId,\n  tables: ['users', 'orders'],\n  events: ['INSERT', 'UPDATE', 'DELETE']\n});\n\nsubscription.on('change', (event) => {\n  console.log('Database change:', event);\n  // Handle real-time updates in your application\n});\n\n// Real-time collaboration\nconst session = await client.collaboration.createSession({\n  connectionId,\n  query: 'SELECT * FROM products',\n  participants: ['user1@example.com', 'user2@example.com']\n});\n\nsession.on('query-change', (change) => {\n  console.log('Query modified by:', change.user);\n  console.log('New query:', change.query);\n});`
        }
      ]
    },
    {
      id: 'error-handling',
      title: 'Error Handling',
      content: [
        {
          type: 'text',
          content: 'Implement robust error handling for production applications.'
        },
        {
          type: 'code',
          language: 'javascript',
          content: `try {\n  const result = await client.query.execute(connectionId, query);\n  return result;\n} catch (error) {\n  if (error.code === 'CONNECTION_ERROR') {\n    // Handle connection issues\n    console.error('Database connection failed:', error.message);\n    // Implement retry logic or fallback\n  } else if (error.code === 'SYNTAX_ERROR') {\n    // Handle SQL syntax errors\n    console.error('SQL syntax error:', error.details);\n    // Show user-friendly error message\n  } else if (error.code === 'PERMISSION_DENIED') {\n    // Handle permission issues\n    console.error('Permission denied:', error.resource);\n    // Prompt user to check credentials\n  } else {\n    // Handle other errors\n    console.error('Unexpected error:', error);\n  }\n  throw error; // Re-throw for upstream handling\n}`
        }
      ]
    }
  ];

  const apiEndpoints = [
    {
      method: 'POST',
      endpoint: '/auth/login',
      description: 'Authenticate with API key',
      example: `{ "apiKey": "your-api-key" }`
    },
    {
      method: 'GET',
      endpoint: '/databases',
      description: 'List all database connections',
      example: null
    },
    {
      method: 'POST',
      endpoint: '/databases/connect',
      description: 'Create new database connection',
      example: `{ "type": "postgresql", "host": "localhost", "port": 5432 }`
    },
    {
      method: 'POST',
      endpoint: '/query/execute',
      description: 'Execute SQL query',
      example: `{ "connectionId": "conn_123", "query": "SELECT * FROM users" }`
    },
    {
      method: 'POST',
      endpoint: '/ai/generate-query',
      description: 'Generate SQL from natural language',
      example: `{ "naturalLanguage": "Show active users", "connectionId": "conn_123" }`
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1
          className="text-4xl font-bold mb-4"
          style={{ color: theme.colors.text }}
        >
          Developer Documentation
        </h1>
        <p
          className="text-xl max-w-3xl"
          style={{ color: theme.colors.textSecondary }}
        >
          Everything you need to integrate QueryFlux into your applications and workflows.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="relative max-w-2xl">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
            style={{ color: theme.colors.textSecondary }}
          />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
            style={{
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
              color: theme.colors.text
            }}
          />
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <nav
            className="sticky top-8 p-6 rounded-xl border"
            style={{
              backgroundColor: theme.colors.background + '50',
              borderColor: theme.colors.border
            }}
          >
            <h3
              className="font-semibold mb-4"
              style={{ color: theme.colors.text }}
            >
              Table of Contents
            </h3>
            <ul className="space-y-2">
              {docSections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    style={{
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-16">
          {docSections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-8">
              <h2
                className="text-3xl font-bold mb-8"
                style={{ color: theme.colors.text }}
              >
                {section.title}
              </h2>

              <div className="space-y-8">
                {section.content.map((contentBlock, index) => {
                  if (contentBlock.type === 'text') {
                    return (
                      <p
                        key={index}
                        className="text-lg leading-relaxed"
                        style={{ color: theme.colors.textSecondary }}
                      >
                        {contentBlock.content}
                      </p>
                    );
                  } else if (contentBlock.type === 'code') {
                    return (
                      <div key={index} className="relative">
                        <div
                          className="flex items-center justify-between px-4 py-2 border-b rounded-t-lg"
                          style={{
                            backgroundColor: theme.colors.background + '50',
                            borderColor: theme.colors.border
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <Code className="w-4 h-4" style={{ color: theme.colors.accent }} />
                            <span
                              className="text-sm font-medium"
                              style={{ color: theme.colors.text }}
                            >
                              {contentBlock.language}
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(contentBlock.content)}
                            className="flex items-center space-x-2 px-3 py-1 rounded text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                            style={{ color: theme.colors.textSecondary }}
                          >
                            {copiedCode === contentBlock.content ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            <span>{copiedCode === contentBlock.content ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre
                          className="p-4 rounded-b-lg overflow-x-auto"
                          style={{
                            backgroundColor: theme.colors.background,
                            border: `1px solid ${theme.colors.border}`,
                            borderTop: 'none'
                          }}
                        >
                          <code
                            className="text-sm font-mono"
                            style={{ color: theme.colors.text }}
                          >
                            {contentBlock.content}
                          </code>
                        </pre>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </section>
          ))}

          {/* API Reference */}
          <section className="scroll-mt-8">
            <h2
              className="text-3xl font-bold mb-8"
              style={{ color: theme.colors.text }}
            >
              API Reference
            </h2>

            <div className="space-y-6">
              {apiEndpoints.map((endpoint, index) => (
                <div
                  key={index}
                  className="p-6 rounded-xl border"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-3 py-1 rounded text-sm font-semibold ${
                          endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                          endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <code
                        className="font-mono text-lg"
                        style={{ color: theme.colors.accent }}
                      >
                        {endpoint.endpoint}
                      </code>
                    </div>
                  </div>

                  <p
                    className="mb-4"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    {endpoint.description}
                  </p>

                  {endpoint.example && (
                    <div>
                      <h4
                        className="font-semibold mb-2"
                        style={{ color: theme.colors.text }}
                      >
                        Example
                      </h4>
                      <pre
                        className="p-3 rounded-lg text-sm font-mono"
                        style={{
                          backgroundColor: theme.colors.background + '50',
                          border: `1px solid ${theme.colors.border}`
                        }}
                      >
                        <code style={{ color: theme.colors.text }}>
                          {endpoint.example}
                        </code>
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
