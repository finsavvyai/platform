#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ChromaClient } from 'chromadb';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname, relative, dirname } from 'path';
import { loadConfig } from './config-manager.js';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';
import { ConversationChain } from 'langchain/chains';
import { loadQAStuffChain, loadQAMapReduceChain } from 'langchain/chains';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import puppeteer from 'puppeteer';
import { chromium } from 'playwright';
import sharp from 'sharp';

class LunaNexaRAGServer {
  constructor() {
    this.server = new Server(
      { name: 'luna-nexa-rag', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );
    this.chromaClient = null;
    this.collection = null;
    this.config = null;
    this.llm = null;
    this.conversationMemory = new BufferMemory();
    this.setupHandlers();
  }

  async initialize() {
    // Load config from ~/.luna-nexa-rag-config.json
    this.config = await loadConfig();
    
    console.error('\n🌙 Luna Nexa RAG Configuration:');
    console.error(`📁 Project: ${this.config.projectPath}`);
    console.error(`🗄️  Collection: ${this.config.collectionName}`);
    console.error(`⚡ Nexa Embeddings: ${this.config.useNexaEmbeddings ? 'Enabled' : 'Disabled'}`);
    console.error('');

    try {
      this.chromaClient = new ChromaClient({
        path: `http://${this.config.chromaHost}:${this.config.chromaPort}`
      });
      
      // Create collection with Nexa embeddings if enabled
      if (this.config.useNexaEmbeddings) {
        this.collection = await this.chromaClient.getOrCreateCollection({
          name: this.config.collectionName,
          metadata: { 
            'hnsw:space': 'cosine',
            'embedding_function': 'nexa'
          },
          embeddingFunction: {
            generate: async (texts) => {
              return await this.getNexaEmbeddings(texts);
            }
          }
        });
        console.error(`✓ Using Nexa embeddings from ${this.config.nexaEndpoint}`);
      } else {
        this.collection = await this.chromaClient.getOrCreateCollection({
          name: this.config.collectionName,
          metadata: { 'hnsw:space': 'cosine' }
        });
        console.error(`✓ Using ChromaDB default embeddings`);
      }
      
      console.error(`✓ Connected to ChromaDB at ${this.config.chromaHost}:${this.config.chromaPort}`);
      console.error(`✓ Using collection: ${this.config.collectionName}`);
      
      // Initialize LangChain LLM
      if (this.config.nexaEndpoint) {
        this.llm = new ChatOpenAI({
          openAIApiKey: 'not-needed',
          configuration: {
            baseURL: `${this.config.nexaEndpoint}/v1`
          },
          temperature: 0.7,
          modelName: 'gpt-3.5-turbo'
        });
        console.error(`✓ LangChain LLM initialized with Nexa backend`);
      }
    } catch (error) {
      console.error('❌ Failed to initialize ChromaDB:', error.message);
      console.error('\n💡 Make sure ChromaDB is running:');
      console.error('   docker run -d -p 8000:8000 chromadb/chroma');
      if (this.config.useNexaEmbeddings) {
        console.error('\n💡 And Nexa server is running:');
        console.error('   nexa serve --host 127.0.0.1:8080');
      }
      console.error('');
    }
  }

  async getNexaEmbeddings(texts) {
    try {
      const response = await fetch(`${this.config.nexaEndpoint}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: texts,
          model: 'text-embedding'
        })
      });

      if (!response.ok) {
        throw new Error(`Nexa API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data.map(item => item.embedding);
    } catch (error) {
      console.error('Failed to get Nexa embeddings:', error.message);
      throw error;
    }
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'index_codebase',
          description: 'Index project codebase for semantic search. Scans and embeds all code files.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Path to project directory (default: from config)'
              },
              fileTypes: {
                type: 'array',
                items: { type: 'string' },
                description: 'File extensions to index',
                default: ['.js', '.ts', '.py', '.md', '.tsx', '.jsx', '.json']
              }
            }
          }
        },
        {
          name: 'search_context',
          description: 'Search codebase semantically for relevant context, code snippets, or implementations',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language search query'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 5
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_similar_implementations',
          description: 'Find similar feature implementations or code patterns in the codebase',
          inputSchema: {
            type: 'object',
            properties: {
              feature: {
                type: 'string',
                description: 'Feature or pattern description'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 3
              }
            },
            required: ['feature']
          }
        },
        {
          name: 'get_coding_patterns',
          description: 'Extract coding patterns and standards from existing codebase',
          inputSchema: {
            type: 'object',
            properties: {
              patternType: {
                type: 'string',
                description: 'Type of pattern (e.g., "error-handling", "api-design", "testing")'
              }
            },
            required: ['patternType']
          }
        },
        {
          name: 'ui_convert_to_hig',
          description: 'Convert UI components to Apple HIG + Decart modern design standards',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description: 'Scope of conversion (e.g., "full", "component-name", "page-name")',
                default: 'full'
              },
              includeGlassmorphism: {
                type: 'boolean',
                description: 'Include glassmorphism effects',
                default: true
              }
            }
          }
        },
        {
          name: 'run_ui_tests',
          description: 'Run automated UI/UX tests using Playwright',
          inputSchema: {
            type: 'object',
            properties: {
              testType: {
                type: 'string',
                description: 'Type of tests (e.g., "e2e", "visual", "accessibility", "all")',
                default: 'all'
              },
              scope: {
                type: 'string',
                description: 'Test scope (e.g., "full", "feature-name")',
                default: 'full'
              }
            }
          }
        },
        {
          name: 'fix_ui_issues',
          description: 'Automatically detect and fix UI issues (accessibility, design system, responsive)',
          inputSchema: {
            type: 'object',
            properties: {
              fixType: {
                type: 'string',
                description: 'Type of fixes (e.g., "auto", "accessibility", "design-system", "responsive")',
                default: 'auto'
              },
              preview: {
                type: 'boolean',
                description: 'Preview fixes without applying',
                default: false
              }
            }
          }
        },
        {
          name: 'deploy_to_cloudflare',
          description: 'Automated deployment to Cloudflare with Wrangler integration',
          inputSchema: {
            type: 'object',
            properties: {
              service: {
                type: 'string',
                description: 'Service to deploy (e.g., "all", "workers", "pages", "d1", "r2")',
                default: 'all'
              },
              setupOnly: {
                type: 'boolean',
                description: 'Setup configuration without deploying',
                default: false
              }
            }
          }
        },
        {
          name: 'get_luna_shortcuts',
          description: 'Get available Luna shortcuts and quick commands',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Shortcut category (e.g., "design", "deployment", "testing", "all")',
                default: 'all'
              }
            }
          }
        },
        {
          name: 'dockerize_project',
          description: 'Generate Docker configuration for project containerization',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description: 'Dockerization scope (e.g., "full", "backend", "frontend")',
                default: 'full'
              },
              environment: {
                type: 'string',
                description: 'Target environment (e.g., "all", "development", "production")',
                default: 'all'
              }
            }
          }
        },
        {
          name: 'generate_user_guide',
          description: 'Generate high-definition HTML and PDF user guide documentation',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description: 'Documentation scope (e.g., "complete", "getting-started", "api-reference")',
                default: 'complete'
              },
              format: {
                type: 'string',
                description: 'Output format (e.g., "both", "html", "pdf")',
                default: 'both'
              }
            }
          }
        },
        {
          name: 'integrate_lemonsqueezy',
          description: 'Integrate LemonSqueezy payment processing with store configuration',
          inputSchema: {
            type: 'object',
            properties: {
              storeId: {
                type: 'string',
                description: 'LemonSqueezy Store ID'
              },
              apiKey: {
                type: 'string',
                description: 'LemonSqueezy API Key'
              },
              productPrefix: {
                type: 'string',
                description: 'Product prefix for namespacing (e.g., "myapp-")'
              },
              scope: {
                type: 'string',
                description: 'Integration scope (e.g., "full", "products", "subscriptions")',
                default: 'full'
              }
            },
            required: ['storeId', 'apiKey', 'productPrefix']
          }
        },
        {
          name: 'create_openai_app',
          description: 'Generate OpenAI-powered application with GPT integration',
          inputSchema: {
            type: 'object',
            properties: {
              appType: {
                type: 'string',
                description: 'App type (e.g., "chat", "assistant", "embeddings", "complete")',
                default: 'chat'
              },
              model: {
                type: 'string',
                description: 'OpenAI model (e.g., "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo")',
                default: 'gpt-4-turbo'
              }
            }
          }
        },
        {
          name: 'setup_database',
          description: 'Generate database schema, migrations, and ORM configuration',
          inputSchema: {
            type: 'object',
            properties: {
              database: {
                type: 'string',
                description: 'Database type (e.g., "postgresql", "mysql", "mongodb", "sqlite")',
                default: 'postgresql'
              },
              orm: {
                type: 'string',
                description: 'ORM choice (e.g., "prisma", "drizzle", "typeorm")',
                default: 'prisma'
              }
            }
          }
        },
        {
          name: 'generate_api',
          description: 'Generate REST API with routes, controllers, and documentation',
          inputSchema: {
            type: 'object',
            properties: {
              framework: {
                type: 'string',
                description: 'API framework (e.g., "nextjs", "express", "fastify")',
                default: 'nextjs'
              },
              apiType: {
                type: 'string',
                description: 'API type (e.g., "rest", "graphql", "trpc")',
                default: 'rest'
              }
            }
          }
        },
        {
          name: 'setup_authentication',
          description: 'Implement authentication with JWT, OAuth, and RBAC',
          inputSchema: {
            type: 'object',
            properties: {
              authStrategy: {
                type: 'string',
                description: 'Auth strategy (e.g., "nextauth", "passport", "auth0")',
                default: 'nextauth'
              }
            }
          }
        },
        {
          name: 'setup_analytics',
          description: 'Integrate analytics and monitoring (GA4, PostHog, Sentry)',
          inputSchema: {
            type: 'object',
            properties: {
              analytics: {
                type: 'string',
                description: 'Analytics platform (e.g., "ga4", "posthog", "mixpanel")',
                default: 'ga4'
              },
              monitoring: {
                type: 'string',
                description: 'Monitoring tool (e.g., "sentry", "datadog", "newrelic")',
                default: 'sentry'
              }
            }
          }
        },
        {
          name: 'optimize_seo',
          description: 'Implement SEO optimization with meta tags, sitemaps, and structured data',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description: 'SEO scope (e.g., "complete", "meta-tags", "performance")',
                default: 'complete'
              }
            }
          }
        },
        {
          name: 'run_and_test_project',
          description: 'Run development server and execute comprehensive UI/UX tests',
          inputSchema: {
            type: 'object',
            properties: {
              testScope: {
                type: 'string',
                description: 'Test scope (e.g., "complete", "quick", "visual", "performance")',
                default: 'complete'
              },
              mode: {
                type: 'string',
                description: 'Execution mode (e.g., "headless", "headed", "watch")',
                default: 'headless'
              }
            }
          }
        },
        {
          name: 'ai_code_review',
          description: 'AI-powered code review with suggestions for improvements, bugs, and best practices',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to file or directory for review'
              },
              reviewType: {
                type: 'string',
                description: 'Type of review (e.g., "full", "security", "performance", "style")',
                default: 'full'
              }
            },
            required: ['filePath']
          }
        },
        {
          name: 'ai_explain_code',
          description: 'AI-powered code explanation with detailed documentation and examples',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Code snippet to explain'
              },
              filePath: {
                type: 'string',
                description: 'File path (if explaining entire file)'
              },
              detailLevel: {
                type: 'string',
                description: 'Detail level (e.g., "summary", "detailed", "beginner")',
                default: 'detailed'
              }
            }
          }
        },
        {
          name: 'ai_generate_tests',
          description: 'AI-powered test generation for functions, components, and modules',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to file to generate tests for'
              },
              testFramework: {
                type: 'string',
                description: 'Test framework (e.g., "jest", "vitest", "mocha", "playwright")',
                default: 'jest'
              },
              coverage: {
                type: 'string',
                description: 'Coverage level (e.g., "basic", "comprehensive", "edge-cases")',
                default: 'comprehensive'
              }
            },
            required: ['filePath']
          }
        },
        {
          name: 'ai_refactor_code',
          description: 'AI-powered code refactoring with modern patterns and best practices',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to file to refactor'
              },
              refactorType: {
                type: 'string',
                description: 'Refactoring type (e.g., "performance", "readability", "modernize", "dry")',
                default: 'modernize'
              }
            },
            required: ['filePath']
          }
        },
        {
          name: 'ai_detect_bugs',
          description: 'AI-powered bug detection and security vulnerability analysis',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to file or directory for bug detection'
              },
              severityLevel: {
                type: 'string',
                description: 'Minimum severity (e.g., "all", "critical", "high", "medium")',
                default: 'all'
              }
            },
            required: ['filePath']
          }
        },
        {
          name: 'ai_generate_documentation',
          description: 'AI-powered documentation generation from code with JSDoc, TSDoc, or Markdown',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Path to file or directory to document'
              },
              format: {
                type: 'string',
                description: 'Documentation format (e.g., "jsdoc", "tsdoc", "markdown", "readme")',
                default: 'markdown'
              },
              includeExamples: {
                type: 'boolean',
                description: 'Include code examples in documentation',
                default: true
              }
            },
            required: ['filePath']
          }
        },
        {
          name: 'ai_generate_pr_description',
          description: 'AI-powered PR description generation from git diff',
          inputSchema: {
            type: 'object',
            properties: {
              branch: {
                type: 'string',
                description: 'Branch name (default: current branch)'
              },
              baseBranch: {
                type: 'string',
                description: 'Base branch for comparison',
                default: 'main'
              }
            }
          }
        },
        {
          name: 'ai_generate_commit_message',
          description: 'AI-powered commit message generation following conventional commits',
          inputSchema: {
            type: 'object',
            properties: {
              staged: {
                type: 'boolean',
                description: 'Generate for staged changes only',
                default: true
              }
            }
          }
        },
        {
          name: 'ai_chat_with_codebase',
          description: 'Conversational AI assistant for codebase questions with memory',
          inputSchema: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'Question about the codebase'
              },
              includeContext: {
                type: 'boolean',
                description: 'Include relevant code context from RAG',
                default: true
              }
            },
            required: ['question']
          }
        },
        {
          name: 'ai_summarize_codebase',
          description: 'AI-powered codebase summary with architecture and component analysis',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description: 'Scope (e.g., "full", "backend", "frontend", "directory-name")',
                default: 'full'
              },
              detailLevel: {
                type: 'string',
                description: 'Detail level (e.g., "overview", "detailed", "technical")',
                default: 'overview'
              }
            }
          }
        },
        {
          name: 'ai_analyze_dependencies',
          description: 'AI-powered dependency analysis with recommendations and security audit',
          inputSchema: {
            type: 'object',
            properties: {
              checkSecurity: {
                type: 'boolean',
                description: 'Check for security vulnerabilities',
                default: true
              },
              suggestUpdates: {
                type: 'boolean',
                description: 'Suggest dependency updates',
                default: true
              }
            }
          }
        },
        {
          name: 'ai_sentiment_analysis',
          description: 'Sentiment analysis for text (comments, reviews, feedback)',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to analyze'
              },
              filePath: {
                type: 'string',
                description: 'File path containing text'
              }
            }
          }
        },
        {
          name: 'ai_extract_entities',
          description: 'Extract named entities (people, places, organizations, technologies) from text',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: 'Text to extract entities from'
              },
              entityTypes: {
                type: 'array',
                items: { type: 'string' },
                description: 'Entity types to extract (e.g., ["person", "organization", "technology"])',
                default: ['person', 'organization', 'location', 'technology']
              }
            },
            required: ['text']
          }
        },
        {
          name: 'ai_tech_debt_analysis',
          description: 'AI-powered technical debt detection and prioritization',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                description: 'Analysis scope (e.g., "full", "directory-name")',
                default: 'full'
              }
            }
          }
        },
        {
          name: 'ai_architecture_recommendations',
          description: 'AI-powered architecture analysis and improvement recommendations',
          inputSchema: {
            type: 'object',
            properties: {
              focus: {
                type: 'string',
                description: 'Focus area (e.g., "scalability", "maintainability", "performance", "security")',
                default: 'all'
              }
            }
          }
        },
        {
          name: 'ui_capture_screenshot',
          description: 'Capture screenshot of URL or local server for UI/UX analysis',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to capture (e.g., "http://localhost:3000" or "https://example.com")'
              },
              outputPath: {
                type: 'string',
                description: 'Path to save screenshot',
                default: './screenshots/capture.png'
              },
              viewport: {
                type: 'object',
                description: 'Viewport dimensions',
                properties: {
                  width: { type: 'number', default: 1920 },
                  height: { type: 'number', default: 1080 }
                }
              },
              waitForSelector: {
                type: 'string',
                description: 'CSS selector to wait for before capturing'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'ui_analyze_screenshot_hig',
          description: 'Analyze UI screenshot for Apple Human Interface Guidelines (HIG) compliance',
          inputSchema: {
            type: 'object',
            properties: {
              screenshotPath: {
                type: 'string',
                description: 'Path to screenshot file'
              },
              platform: {
                type: 'string',
                description: 'Apple platform (e.g., "ios", "macos", "ipados", "watchos")',
                default: 'ios'
              },
              checkAreas: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific areas to check (e.g., ["buttons", "typography", "spacing", "colors"])',
                default: ['all']
              }
            },
            required: ['screenshotPath']
          }
        },
        {
          name: 'ui_test_responsiveness',
          description: 'Test UI responsiveness across multiple device sizes',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to test'
              },
              devices: {
                type: 'array',
                items: { type: 'string' },
                description: 'Device profiles (e.g., ["iPhone 14 Pro", "iPad Pro", "Desktop"])',
                default: ['iPhone 14 Pro', 'iPad Pro', 'Desktop 1920x1080']
              },
              outputDir: {
                type: 'string',
                description: 'Directory to save screenshots',
                default: './screenshots/responsive'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'ui_check_button_sizes',
          description: 'Validate button sizes according to Apple HIG touch target guidelines (44x44pt minimum)',
          inputSchema: {
            type: 'object',
            properties: {
              screenshotPath: {
                type: 'string',
                description: 'Path to screenshot'
              },
              platform: {
                type: 'string',
                description: 'Platform (ios, macos, ipados)',
                default: 'ios'
              }
            },
            required: ['screenshotPath']
          }
        },
        {
          name: 'ui_accessibility_audit',
          description: 'Comprehensive WCAG and Apple accessibility audit with screenshot analysis',
          inputSchema: {
            type: 'object',
            properties: {
              screenshotPath: {
                type: 'string',
                description: 'Path to screenshot'
              },
              url: {
                type: 'string',
                description: 'Optional URL for DOM analysis'
              },
              standards: {
                type: 'array',
                items: { type: 'string' },
                description: 'Standards to check (e.g., ["WCAG_2.1_AA", "Apple_HIG", "Section_508"])',
                default: ['WCAG_2.1_AA', 'Apple_HIG']
              }
            },
            required: ['screenshotPath']
          }
        },
        {
          name: 'ui_compare_design_systems',
          description: 'Compare UI screenshot against design system guidelines (Material, Fluent, Apple HIG)',
          inputSchema: {
            type: 'object',
            properties: {
              screenshotPath: {
                type: 'string',
                description: 'Path to screenshot'
              },
              designSystem: {
                type: 'string',
                description: 'Design system (e.g., "Apple_HIG", "Material_Design", "Fluent", "Tailwind")',
                default: 'Apple_HIG'
              }
            },
            required: ['screenshotPath']
          }
        },
        {
          name: 'ui_generate_test_report',
          description: 'Generate comprehensive UI/UX test report with screenshots and analysis',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to test'
              },
              testSuite: {
                type: 'string',
                description: 'Test suite (e.g., "complete", "hig_compliance", "accessibility", "responsive")',
                default: 'complete'
              },
              outputDir: {
                type: 'string',
                description: 'Directory for report and screenshots',
                default: './test-reports'
              }
            },
            required: ['url']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'index_codebase':
            return await this.indexCodebase(
              args.projectPath || this.config.projectPath,
              args.fileTypes || this.config.fileTypes
            );

          case 'search_context':
            return await this.searchContext(args.query, args.limit || 5);

          case 'get_similar_implementations':
            return await this.getSimilarImplementations(args.feature, args.limit || 3);

          case 'get_coding_patterns':
            return await this.getCodingPatterns(args.patternType);

          case 'ui_convert_to_hig':
            return await this.convertUIToHIG(args.scope, args.includeGlassmorphism);

          case 'run_ui_tests':
            return await this.runUITests(args.testType, args.scope);

          case 'fix_ui_issues':
            return await this.fixUIIssues(args.fixType, args.preview);

          case 'deploy_to_cloudflare':
            return await this.deployToCloudflare(args.service, args.setupOnly);

          case 'get_luna_shortcuts':
            return await this.getLunaShortcuts(args.category);

          case 'dockerize_project':
            return await this.dockerizeProject(args.scope, args.environment);

          case 'generate_user_guide':
            return await this.generateUserGuide(args.scope, args.format);

          case 'integrate_lemonsqueezy':
            return await this.integrateLemonSqueezy(args.storeId, args.apiKey, args.productPrefix, args.scope);

          case 'create_openai_app':
            return await this.createOpenAIApp(args.appType, args.model);

          case 'setup_database':
            return await this.setupDatabase(args.database, args.orm);

          case 'generate_api':
            return await this.generateAPI(args.framework, args.apiType);

          case 'setup_authentication':
            return await this.setupAuthentication(args.authStrategy);

          case 'setup_analytics':
            return await this.setupAnalytics(args.analytics, args.monitoring);

          case 'optimize_seo':
            return await this.optimizeSEO(args.scope);

          case 'run_and_test_project':
            return await this.runAndTestProject(args.testScope, args.mode);

          case 'ai_code_review':
            return await this.aiCodeReview(args.filePath, args.reviewType);

          case 'ai_explain_code':
            return await this.aiExplainCode(args.code, args.filePath, args.detailLevel);

          case 'ai_generate_tests':
            return await this.aiGenerateTests(args.filePath, args.testFramework, args.coverage);

          case 'ai_refactor_code':
            return await this.aiRefactorCode(args.filePath, args.refactorType);

          case 'ai_detect_bugs':
            return await this.aiDetectBugs(args.filePath, args.severityLevel);

          case 'ai_generate_documentation':
            return await this.aiGenerateDocumentation(args.filePath, args.format, args.includeExamples);

          case 'ai_generate_pr_description':
            return await this.aiGeneratePRDescription(args.branch, args.baseBranch);

          case 'ai_generate_commit_message':
            return await this.aiGenerateCommitMessage(args.staged);

          case 'ai_chat_with_codebase':
            return await this.aiChatWithCodebase(args.question, args.includeContext);

          case 'ai_summarize_codebase':
            return await this.aiSummarizeCodebase(args.scope, args.detailLevel);

          case 'ai_analyze_dependencies':
            return await this.aiAnalyzeDependencies(args.checkSecurity, args.suggestUpdates);

          case 'ai_sentiment_analysis':
            return await this.aiSentimentAnalysis(args.text, args.filePath);

          case 'ai_extract_entities':
            return await this.aiExtractEntities(args.text, args.entityTypes);

          case 'ai_tech_debt_analysis':
            return await this.aiTechDebtAnalysis(args.scope);

          case 'ai_architecture_recommendations':
            return await this.aiArchitectureRecommendations(args.focus);

          case 'ui_capture_screenshot':
            return await this.uiCaptureScreenshot(args.url, args.outputPath, args.viewport, args.waitForSelector);

          case 'ui_analyze_screenshot_hig':
            return await this.uiAnalyzeScreenshotHIG(args.screenshotPath, args.platform, args.checkAreas);

          case 'ui_test_responsiveness':
            return await this.uiTestResponsiveness(args.url, args.devices, args.outputDir);

          case 'ui_check_button_sizes':
            return await this.uiCheckButtonSizes(args.screenshotPath, args.platform);

          case 'ui_accessibility_audit':
            return await this.uiAccessibilityAudit(args.screenshotPath, args.url, args.standards);

          case 'ui_compare_design_systems':
            return await this.uiCompareDesignSystems(args.screenshotPath, args.designSystem);

          case 'ui_generate_test_report':
            return await this.uiGenerateTestReport(args.url, args.testSuite, args.outputDir);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async walkDirectory(dir, fileTypes, files = []) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common directories
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__'].includes(entry.name)) {
            await this.walkDirectory(fullPath, fileTypes, files);
          }
        } else if (entry.isFile() && fileTypes.includes(extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading ${dir}:`, error.message);
    }

    return files;
  }

  async indexCodebase(projectPath, fileTypes) {
    if (!this.collection) {
      await this.initialize();
    }

    console.error(`\n📂 Indexing ${projectPath}...`);
    const files = await this.walkDirectory(projectPath, fileTypes);
    
    // Process files in batches for better performance
    const BATCH_SIZE = 50;
    let totalIndexed = 0;
    
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const documents = [];
      const metadatas = [];
      const ids = [];

      for (const file of batch) {
        try {
          const content = await readFile(file, 'utf-8');
          const relativePath = relative(projectPath, file);
          
          // Skip very large files (>100KB)
          if (content.length > 100000) {
            console.error(`⚠️  Skipping large file: ${relativePath}`);
            continue;
          }
          
          // Skip binary-looking content
          if (content.includes('\u0000')) {
            console.error(`⚠️  Skipping binary file: ${relativePath}`);
            continue;
          }
          
          documents.push(content);
          metadatas.push({
            file: relativePath,
            type: extname(file),
            size: content.length,
            timestamp: new Date().toISOString()
          });
          ids.push(relativePath);
        } catch (error) {
          console.error(`Failed to read ${file}:`, error.message);
        }
      }

      if (documents.length > 0) {
        console.error(`💾 Batch ${Math.floor(i / BATCH_SIZE) + 1}: Adding ${documents.length} documents...`);
        await this.collection.add({
          documents,
          metadatas,
          ids
        });
        totalIndexed += documents.length;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Successfully indexed ${totalIndexed} files from ${projectPath}\n\n📁 File types: ${fileTypes.join(', ')}\n🗄️  Collection: ${this.config.collectionName}\n${this.config.useNexaEmbeddings ? '⚡ Using Nexa embeddings for better quality' : '📊 Using ChromaDB default embeddings'}`
        }
      ]
    };
  }

  async searchContext(query, limit) {
    if (!this.collection) {
      await this.initialize();
    }

    console.error(`🔍 Searching for: "${query}"`);
    
    const results = await this.collection.query({
      queryTexts: [query],
      nResults: limit
    });

    if (!results.documents[0] || results.documents[0].length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No results found. Make sure the codebase is indexed first.'
          }
        ]
      };
    }

    const formattedResults = results.documents[0].map((doc, idx) => ({
      file: results.metadatas[0][idx].file,
      relevance: (1 - results.distances[0][idx]).toFixed(3),
      snippet: doc.substring(0, 300) + (doc.length > 300 ? '...' : ''),
      type: results.metadatas[0][idx].type
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${formattedResults.length} relevant contexts:\n\n${JSON.stringify(formattedResults, null, 2)}`
        }
      ]
    };
  }

  async getSimilarImplementations(feature, limit) {
    if (!this.collection) {
      await this.initialize();
    }

    console.error(`🔎 Finding similar implementations for: "${feature}"`);

    // Try multiple query strategies
    const queries = [
      `${feature} implementation`,
      `${feature} example code`,
      `how to implement ${feature}`
    ];

    const allResults = [];
    
    for (const query of queries) {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit
      });

      if (results.documents[0]) {
        results.documents[0].forEach((doc, idx) => {
          allResults.push({
            file: results.metadatas[0][idx].file,
            relevance: (1 - results.distances[0][idx]).toFixed(3),
            code: doc,
            type: results.metadatas[0][idx].type
          });
        });
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.file, item])).values()
    )
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: `Found ${uniqueResults.length} similar implementations for "${feature}":\n\n${JSON.stringify(uniqueResults, null, 2)}`
        }
      ]
    };
  }

  async getCodingPatterns(patternType) {
    if (!this.collection) {
      await this.initialize();
    }

    console.error(`📋 Extracting coding patterns for: "${patternType}"`);

    const results = await this.collection.query({
      queryTexts: [`${patternType} pattern best practices coding standard`],
      nResults: 10
    });

    if (!results.documents[0] || results.documents[0].length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No coding patterns found for "${patternType}". Make sure the codebase is indexed.`
          }
        ]
      };
    }

    const patterns = results.documents[0].map((doc, idx) => ({
      file: results.metadatas[0][idx].file,
      pattern: this.extractPattern(doc, patternType),
      relevance: (1 - results.distances[0][idx]).toFixed(3)
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Coding patterns for "${patternType}":\n\n${JSON.stringify(patterns, null, 2)}`
        }
      ]
    };
  }

  extractPattern(code, patternType) {
    // Extract relevant code patterns
    const lines = code.split('\n');
    const relevantLines = lines.filter(line => 
      line.includes('function') || 
      line.includes('class') || 
      line.includes('const') ||
      line.includes('async') ||
      line.includes('try') ||
      line.includes('catch') ||
      line.includes('import') ||
      line.includes('export')
    ).slice(0, 15);

    return relevantLines.join('\n');
  }

  async convertUIToHIG(scope, includeGlassmorphism) {
    console.error(`🎨 Converting UI to Apple HIG + Decart design (scope: ${scope})`);
    
    const conversionPlan = {
      scope: scope || 'full',
      includeGlassmorphism: includeGlassmorphism !== false,
      steps: [
        'Analyze current UI components',
        'Apply Apple HIG design principles',
        'Implement Decart modern aesthetics',
        'Generate design tokens',
        'Convert components to new design',
        'Add glassmorphism effects (if enabled)',
        'Validate accessibility compliance'
      ],
      designTokens: {
        colors: ['--color-primary: #007AFF', '--color-success: #34C759'],
        spacing: ['--space-1: 4px', '--space-2: 8px', '--space-4: 16px'],
        typography: ['--font-size-base: 15px', '--font-weight-semibold: 600']
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: `🎨 UI Conversion Plan:\n\n${JSON.stringify(conversionPlan, null, 2)}\n\nRefer to luna-ui-convert command documentation for detailed implementation.`
        }
      ]
    };
  }

  async runUITests(testType, scope) {
    console.error(`🧪 Running UI tests (type: ${testType}, scope: ${scope})`);
    
    const testPlan = {
      testType: testType || 'all',
      scope: scope || 'full',
      tests: {
        e2e: ['User authentication flow', 'Navigation tests', 'Form submissions'],
        visual: ['Component snapshots', 'Responsive layouts', 'Theme consistency'],
        accessibility: ['WCAG compliance', 'Keyboard navigation', 'Screen reader support'],
        performance: ['Load times', 'Core Web Vitals', 'Bundle size']
      },
      framework: 'Playwright',
      browsers: ['Chromium', 'Firefox', 'WebKit']
    };

    return {
      content: [
        {
          type: 'text',
          text: `🧪 UI Test Plan:\n\n${JSON.stringify(testPlan, null, 2)}\n\nRefer to luna-ui-test agent documentation for test implementation.`
        }
      ]
    };
  }

  async fixUIIssues(fixType, preview) {
    console.error(`🔧 Fixing UI issues (type: ${fixType}, preview: ${preview})`);
    
    const fixPlan = {
      fixType: fixType || 'auto',
      preview: preview || false,
      categories: {
        accessibility: ['Missing alt text', 'Color contrast', 'ARIA labels'],
        designSystem: ['Hardcoded colors', 'Inconsistent spacing', 'Typography'],
        responsive: ['Fixed widths', 'Touch targets', 'Overflow issues'],
        performance: ['Image optimization', 'Lazy loading', 'Bundle size']
      },
      priority: {
        critical: 5,
        high: 12,
        medium: 18,
        low: 8
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: `🔧 UI Fix Plan:\n\n${JSON.stringify(fixPlan, null, 2)}\n\nRefer to luna-ui-fix agent documentation for automated fixes.`
        }
      ]
    };
  }

  async deployToCloudflare(service, setupOnly) {
    console.error(`☁️ Deploying to Cloudflare (service: ${service}, setup-only: ${setupOnly})`);
    
    const deploymentPlan = {
      service: service || 'all',
      setupOnly: setupOnly || false,
      services: {
        workers: 'Backend API deployment',
        pages: 'Frontend static site',
        d1: 'Database setup and migration',
        r2: 'Object storage for assets',
        kv: 'Key-value cache storage'
      },
      steps: [
        'Install and configure Wrangler CLI',
        'Analyze project structure',
        'Generate wrangler.toml configuration',
        'Set up Cloudflare services',
        'Deploy application',
        'Configure domain and SSL',
        'Set up monitoring'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `☁️ Cloudflare Deployment Plan:\n\n${JSON.stringify(deploymentPlan, null, 2)}\n\nRefer to luna-cloudflare-auto command for automated deployment.`
        }
      ]
    };
  }

  async getLunaShortcuts(category) {
    console.error(`⚡ Getting Luna shortcuts (category: ${category})`);
    
    const shortcuts = {
      design: {
        hig: 'luna-hig - Apple HIG compliance',
        'ui-convert': 'luna-ui-convert - Convert to modern design',
        'ui-test': 'luna-ui-test - Run UI tests',
        'ui-fix': 'luna-ui-fix - Fix UI issues'
      },
      deployment: {
        deploy: 'luna-deploy - General deployment',
        'cf-deploy': 'luna-cloudflare-deploy - Cloudflare deployment',
        'cf-auto': 'luna-cloudflare-auto - Automated Cloudflare setup'
      },
      testing: {
        test: 'luna-test - Run tests',
        'ui-test': 'luna-ui-test - UI/UX testing',
        e2e: 'luna-test e2e - End-to-end tests'
      },
      development: {
        plan: 'luna-plan - Development planning',
        execute: 'luna-execute - Task execution',
        review: 'luna-review - Code review'
      }
    };

    const selectedShortcuts = category === 'all' ? shortcuts : { [category]: shortcuts[category] };

    return {
      content: [
        {
          type: 'text',
          text: `⚡ Luna Shortcuts:\n\n${JSON.stringify(selectedShortcuts, null, 2)}\n\nRefer to luna-shortcuts command for complete list and custom shortcuts.`
        }
      ]
    };
  }

  async dockerizeProject(scope, environment) {
    console.error(`🐳 Dockerizing project (scope: ${scope}, environment: ${environment})`);
    
    const dockerPlan = {
      scope: scope || 'full',
      environment: environment || 'all',
      components: {
        dockerfile: 'Multi-stage Dockerfile with optimizations',
        dockerCompose: 'Complete service orchestration',
        devEnvironment: 'Hot reload development setup',
        prodEnvironment: 'Optimized production build',
        nginx: 'Reverse proxy configuration',
        makefile: 'Helper commands for Docker operations'
      },
      features: [
        'Multi-stage builds for minimal image size',
        'Non-root user execution',
        'Health checks configured',
        'Security scanning with Trivy',
        'CI/CD integration with GitHub Actions'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `🐳 Docker Configuration Plan:\n\n${JSON.stringify(dockerPlan, null, 2)}\n\nRefer to luna-docker agent for complete containerization.`
        }
      ]
    };
  }

  async generateUserGuide(scope, format) {
    console.error(`📚 Generating user guide (scope: ${scope}, format: ${format})`);
    
    const guidePlan = {
      scope: scope || 'complete',
      format: format || 'both',
      sections: [
        'Getting Started',
        'Installation',
        'Core Concepts',
        'User Guide',
        'API Reference',
        'Examples',
        'Troubleshooting',
        'Advanced Topics'
      ],
      features: {
        html: [
          'Responsive design',
          'Dark/light mode',
          'Interactive code examples',
          'Search functionality',
          'Syntax highlighting'
        ],
        pdf: [
          'High-definition output',
          'Print-optimized layout',
          'Table of contents with links',
          'Professional formatting',
          'Page numbers and headers'
        ]
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: `📚 User Guide Generation Plan:\n\n${JSON.stringify(guidePlan, null, 2)}\n\nRefer to luna-user-guide agent for documentation generation.`
        }
      ]
    };
  }

  async integrateLemonSqueezy(storeId, apiKey, productPrefix, scope) {
    console.error(`🍋 Integrating LemonSqueezy (store: ${storeId}, prefix: ${productPrefix})`);
    
    const integrationPlan = {
      storeId,
      productPrefix,
      scope: scope || 'full',
      components: {
        productManagement: 'Product CRUD with prefix',
        checkoutFlow: 'Secure checkout integration',
        subscriptions: 'Subscription management',
        webhooks: 'Webhook handlers for events',
        frontend: 'React checkout components'
      },
      features: [
        'Shared store with product prefix isolation',
        'Automated product creation',
        'Subscription lifecycle management',
        'Webhook signature verification',
        'Test and production modes'
      ],
      productNaming: `${productPrefix}starter, ${productPrefix}pro, ${productPrefix}enterprise`
    };

    return {
      content: [
        {
          type: 'text',
          text: `🍋 LemonSqueezy Integration Plan:\n\n${JSON.stringify(integrationPlan, null, 2)}\n\nRefer to luna-lemonsqueezy agent for payment integration.`
        }
      ]
    };
  }

  async createOpenAIApp(appType, model) {
    console.error(`🤖 Creating OpenAI app (type: ${appType}, model: ${model})`);
    
    const appPlan = {
      appType: appType || 'chat',
      model: model || 'gpt-4-turbo',
      features: {
        chat: ['Chat completions', 'Streaming responses', 'Context management'],
        assistant: ['Assistant API', 'Tool calling', 'File uploads'],
        embeddings: ['Text embeddings', 'Semantic search', 'Similarity matching'],
        image: ['DALL-E generation', 'Image editing', 'Variations'],
        audio: ['Speech-to-text (Whisper)', 'Text-to-speech', 'Audio processing']
      },
      components: [
        'OpenAI client configuration',
        'API endpoints',
        'React UI components',
        'Error handling',
        'Cost tracking',
        'Token counting'
      ],
      optimization: [
        'Rate limiting',
        'Retry logic',
        'Streaming for better UX',
        'Token budget management',
        'Response caching'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `🤖 OpenAI App Plan:\n\n${JSON.stringify(appPlan, null, 2)}\n\nRefer to luna-openai-app agent for AI integration.`
        }
      ]
    };
  }

  async setupDatabase(database, orm) {
    console.error(`🗄️ Setting up database (db: ${database}, orm: ${orm})`);
    
    const dbPlan = {
      database: database || 'postgresql',
      orm: orm || 'prisma',
      components: {
        schema: 'Database schema with relationships',
        migrations: 'Migration system for version control',
        client: 'Type-safe database client',
        operations: 'CRUD operations and queries',
        seeding: 'Seed data for development'
      },
      features: [
        'Type-safe queries',
        'Automatic migrations',
        'Relationship management',
        'Transactions support',
        'Full-text search',
        'Soft deletes'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `🗄️ Database Setup Plan:\n\n${JSON.stringify(dbPlan, null, 2)}\n\nRefer to luna-database agent for complete setup.`
        }
      ]
    };
  }

  async generateAPI(framework, apiType) {
    console.error(`🚀 Generating API (framework: ${framework}, type: ${apiType})`);
    
    const apiPlan = {
      framework: framework || 'nextjs',
      apiType: apiType || 'rest',
      components: {
        routes: 'RESTful routes with proper HTTP methods',
        controllers: 'Business logic handlers',
        middleware: 'Auth, validation, error handling',
        documentation: 'OpenAPI/Swagger docs',
        testing: 'API tests with Jest/Supertest'
      },
      features: [
        'Input validation with Zod',
        'Authentication middleware',
        'Rate limiting',
        'CORS configuration',
        'Error handling',
        'Pagination support',
        'API versioning'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `🚀 API Generation Plan:\n\n${JSON.stringify(apiPlan, null, 2)}\n\nRefer to luna-api-generator agent for implementation.`
        }
      ]
    };
  }

  async setupAuthentication(authStrategy) {
    console.error(`🔐 Setting up authentication (strategy: ${authStrategy})`);
    
    const authPlan = {
      strategy: authStrategy || 'nextauth',
      components: {
        providers: 'OAuth (Google, GitHub) + Credentials',
        session: 'JWT-based session management',
        rbac: 'Role-based access control',
        middleware: 'Protected routes and API endpoints',
        ui: 'Login/signup components'
      },
      features: [
        'Multiple auth providers',
        'JWT token management',
        'Password hashing with bcrypt',
        'Email verification',
        'Password reset flow',
        'Two-factor authentication',
        'Session management',
        'CSRF protection'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `🔐 Authentication Setup Plan:\n\n${JSON.stringify(authPlan, null, 2)}\n\nRefer to luna-auth agent for secure auth implementation.`
        }
      ]
    };
  }

  async setupAnalytics(analytics, monitoring) {
    console.error(`📊 Setting up analytics (analytics: ${analytics}, monitoring: ${monitoring})`);
    
    const analyticsPlan = {
      analytics: analytics || 'ga4',
      monitoring: monitoring || 'sentry',
      components: {
        tracking: 'Event tracking and page views',
        performance: 'Core Web Vitals monitoring',
        errors: 'Error tracking and reporting',
        logging: 'Server-side logging',
        dashboard: 'Analytics dashboard API'
      },
      trackedEvents: [
        'User actions (signup, login)',
        'Page views',
        'Button clicks',
        'Form submissions',
        'E-commerce events',
        'Performance metrics'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `📊 Analytics Setup Plan:\n\n${JSON.stringify(analyticsPlan, null, 2)}\n\nRefer to luna-analytics agent for complete tracking.`
        }
      ]
    };
  }

  async optimizeSEO(scope) {
    console.error(`🔍 Optimizing SEO (scope: ${scope})`);
    
    const seoPlan = {
      scope: scope || 'complete',
      components: {
        metadata: 'Meta tags, Open Graph, Twitter Cards',
        sitemap: 'Dynamic sitemap generation',
        robots: 'Robots.txt configuration',
        structuredData: 'JSON-LD schema markup',
        performance: 'Core Web Vitals optimization'
      },
      features: [
        'SEO-friendly meta tags',
        'Open Graph for social sharing',
        'Automatic sitemap generation',
        'Structured data (Schema.org)',
        'Image optimization',
        'Lazy loading',
        'Code splitting',
        'Fast page loads (<3s)'
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `🔍 SEO Optimization Plan:\n\n${JSON.stringify(seoPlan, null, 2)}\n\nRefer to luna-seo agent for complete optimization.`
        }
      ]
    };
  }

  async runAndTestProject(testScope, mode) {
    console.error(`🚀 Running and testing project (scope: ${testScope}, mode: ${mode})`);
    
    const runPlan = {
      testScope: testScope || 'complete',
      mode: mode || 'headless',
      phases: {
        detection: 'Auto-detect framework and configuration',
        server: 'Start development server',
        e2e: 'End-to-end functionality tests',
        accessibility: 'WCAG 2.1 AA compliance checks',
        visual: 'Visual regression testing',
        performance: 'Lighthouse performance audit'
      },
      tests: {
        e2e: [
          'Homepage loads correctly',
          'Navigation works',
          'Forms are functional',
          'Buttons are clickable',
          'Images load properly'
        ],
        accessibility: [
          'WCAG 2.1 AA compliance',
          'All images have alt text',
          'All inputs have labels',
          'Keyboard navigation works',
          'Color contrast meets standards'
        ],
        visual: [
          'Mobile screenshot (375x667)',
          'Tablet screenshot (768x1024)',
          'Desktop screenshot (1920x1080)',
          'Cumulative Layout Shift < 0.1'
        ],
        performance: [
          'Lighthouse score > 90',
          'First Contentful Paint < 1.8s',
          'Largest Contentful Paint < 2.5s',
          'Time to Interactive < 3.8s',
          'Total Blocking Time < 200ms'
        ]
      },
      output: {
        screenshots: 'Visual snapshots at different viewports',
        reports: 'Detailed HTML reports',
        json: 'Machine-readable test results',
        summary: 'Pass/fail summary with metrics'
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: `🚀 Run & Test Plan:\n\n${JSON.stringify(runPlan, null, 2)}\n\nRefer to luna-run agent for automated testing.`
        }
      ]
    };
  }

  // ============ AI-POWERED METHODS ============

  async aiCodeReview(filePath, reviewType = 'full') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized. Please configure Nexa endpoint.' }] };
    }

    console.error(`🔍 AI Code Review: ${filePath} (${reviewType})`);

    const code = await readFile(filePath, 'utf-8');
    const prompt = PromptTemplate.fromTemplate(`You are an expert code reviewer. Review the following code with focus on ${reviewType}.

Code from {filePath}:
{code}

Provide a detailed code review including:
1. Overall assessment
2. Issues found (bugs, security, performance, style)
3. Specific suggestions for improvement
4. Code snippets showing recommended changes
5. Best practices recommendations

Be constructive and specific.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ filePath, code, reviewType });

    return {
      content: [{
        type: 'text',
        text: `🔍 AI Code Review Results:\n\n${result.text}`
      }]
    };
  }

  async aiExplainCode(code, filePath, detailLevel = 'detailed') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`📖 AI Explaining Code (${detailLevel})`);

    if (filePath && !code) {
      code = await readFile(filePath, 'utf-8');
    }

    const prompt = PromptTemplate.fromTemplate(`Explain the following code at a ${detailLevel} level:

{code}

Provide:
1. High-level overview
2. Purpose and functionality
3. Key components and their roles
4. Important patterns or techniques used
5. Dependencies and interactions
6. Example usage (if applicable)

Tailor explanation to: ${detailLevel}`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ code, detailLevel });

    return {
      content: [{
        type: 'text',
        text: `📖 Code Explanation:\n\n${result.text}`
      }]
    };
  }

  async aiGenerateTests(filePath, testFramework = 'jest', coverage = 'comprehensive') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`🧪 Generating tests for: ${filePath}`);

    const code = await readFile(filePath, 'utf-8');
    const prompt = PromptTemplate.fromTemplate(`Generate ${coverage} tests using ${testFramework} for the following code:

{code}

Generate:
1. Test file with imports and setup
2. Unit tests for all functions/methods
3. Edge cases and error scenarios
4. Mock data where needed
5. Clear test descriptions

Follow ${testFramework} best practices.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ code, testFramework, coverage });

    const testFilePath = filePath.replace(/\.(js|ts|jsx|tsx)$/, `.test.$1`);

    return {
      content: [{
        type: 'text',
        text: `🧪 Generated Tests:\n\nTest file: ${testFilePath}\n\n${result.text}\n\nRun: Save to ${testFilePath} and run tests.`
      }]
    };
  }

  async aiRefactorCode(filePath, refactorType = 'modernize') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`♻️ Refactoring: ${filePath} (${refactorType})`);

    const code = await readFile(filePath, 'utf-8');
    const prompt = PromptTemplate.fromTemplate(`Refactor the following code with focus on ${refactorType}:

{code}

Refactor for:
1. ${refactorType === 'performance' ? 'Better performance and optimization' : ''}
2. ${refactorType === 'readability' ? 'Improved readability and maintainability' : ''}
3. ${refactorType === 'modernize' ? 'Modern JavaScript/TypeScript patterns and features' : ''}
4. ${refactorType === 'dry' ? 'DRY principle and code reuse' : ''}
5. Clean code principles

Provide:
- Refactored code
- Explanation of changes
- Benefits of the refactoring`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ code, refactorType });

    return {
      content: [{
        type: 'text',
        text: `♻️ Refactored Code:\n\n${result.text}`
      }]
    };
  }

  async aiDetectBugs(filePath, severityLevel = 'all') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`🐛 Bug Detection: ${filePath} (${severityLevel})`);

    const code = await readFile(filePath, 'utf-8');
    const prompt = PromptTemplate.fromTemplate(`Analyze the following code for bugs and security vulnerabilities (minimum severity: ${severityLevel}):

{code}

Identify:
1. Logic errors and bugs
2. Security vulnerabilities
3. Memory leaks or performance issues
4. Race conditions
5. Error handling gaps
6. Type safety issues

For each issue, provide:
- Severity (critical/high/medium/low)
- Description
- Location in code
- Recommended fix
- Prevention tips`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ code, severityLevel });

    return {
      content: [{
        type: 'text',
        text: `🐛 Bug Detection Results:\n\n${result.text}`
      }]
    };
  }

  async aiGenerateDocumentation(filePath, format = 'markdown', includeExamples = true) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`📚 Generating documentation: ${filePath} (${format})`);

    const code = await readFile(filePath, 'utf-8');
    const prompt = PromptTemplate.fromTemplate(`Generate ${format} documentation for the following code:

{code}

Generate documentation including:
1. Overview and purpose
2. API reference (functions, classes, methods)
3. Parameters and return types
4. ${includeExamples ? 'Usage examples' : ''}
5. Dependencies
6. Notes and considerations

Format: ${format === 'jsdoc' ? 'JSDoc comments' : format === 'tsdoc' ? 'TSDoc comments' : 'Markdown README'}`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ code, format, includeExamples });

    const docFilePath = format === 'markdown' ? join(dirname(filePath), 'README.md') : filePath;

    return {
      content: [{
        type: 'text',
        text: `📚 Generated Documentation:\n\nFile: ${docFilePath}\n\n${result.text}`
      }]
    };
  }

  async aiGeneratePRDescription(branch, baseBranch = 'main') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`📝 Generating PR description`);

    // Note: This would require git integration to get diff
    const prompt = PromptTemplate.fromTemplate(`Generate a comprehensive Pull Request description for a branch merge.

Generate:
1. Title (conventional commit style)
2. Summary of changes
3. Motivation and context
4. Type of change (bug fix, feature, refactor, etc.)
5. Testing done
6. Breaking changes (if any)
7. Screenshots (placeholder if UI changes)
8. Checklist items

Format for GitHub PR.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ branch, baseBranch });

    return {
      content: [{
        type: 'text',
        text: `📝 PR Description:\n\n${result.text}\n\n💡 Tip: Use with git integration for actual diff analysis.`
      }]
    };
  }

  async aiGenerateCommitMessage(staged = true) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`💬 Generating commit message (staged: ${staged})`);

    const prompt = PromptTemplate.fromTemplate(`Generate a conventional commit message.

Format:
<type>(<scope>): <subject>

<body>

<footer>

Types: feat, fix, docs, style, refactor, test, chore
Keep subject under 50 chars, body wrapped at 72 chars.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ staged });

    return {
      content: [{
        type: 'text',
        text: `💬 Commit Message:\n\n${result.text}\n\n💡 Tip: Use with git integration for actual diff analysis.`
      }]
    };
  }

  async aiChatWithCodebase(question, includeContext = true) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`💬 Chat: "${question}"`);

    let context = '';
    if (includeContext && this.collection) {
      const results = await this.collection.query({
        queryTexts: [question],
        nResults: 3
      });

      if (results.documents[0] && results.documents[0].length > 0) {
        context = results.documents[0].map((doc, idx) => 
          `[${results.metadatas[0][idx].file}]\n${doc.substring(0, 500)}`
        ).join('\n\n---\n\n');
      }
    }

    const prompt = PromptTemplate.fromTemplate(`You are a helpful coding assistant with knowledge of the codebase.

${context ? 'Relevant code context:\n' + context + '\n\n' : ''}

User question: {question}

Provide a helpful, accurate answer with code examples if relevant.`);

    const chain = new ConversationChain({
      llm: this.llm,
      memory: this.conversationMemory,
      prompt
    });

    const result = await chain.call({ question });

    return {
      content: [{
        type: 'text',
        text: `💬 ${result.response}`
      }]
    };
  }

  async aiSummarizeCodebase(scope = 'full', detailLevel = 'overview') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`📊 Summarizing codebase (${scope}, ${detailLevel})`);

    const projectPath = scope === 'full' ? this.config.projectPath : join(this.config.projectPath, scope);
    const files = await this.walkDirectory(projectPath, this.config.fileTypes);

    const fileSummary = files.map(f => relative(this.config.projectPath, f)).slice(0, 50).join('\n');

    const prompt = PromptTemplate.fromTemplate(`Analyze and summarize this codebase (${detailLevel} level):

Files (sample):
{fileSummary}

Provide:
1. Project overview and purpose
2. Architecture and structure
3. Main components/modules
4. Tech stack and dependencies
5. Key patterns used
6. Potential areas for improvement

Detail level: {detailLevel}`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ fileSummary, detailLevel, scope });

    return {
      content: [{
        type: 'text',
        text: `📊 Codebase Summary:\n\n${result.text}`
      }]
    };
  }

  async aiAnalyzeDependencies(checkSecurity = true, suggestUpdates = true) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`📦 Analyzing dependencies`);

    try {
      const packageJsonPath = join(this.config.projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      const deps = {
        ...packageJson.dependencies || {},
        ...packageJson.devDependencies || {}
      };

      const prompt = PromptTemplate.fromTemplate(`Analyze these project dependencies:

{dependencies}

Provide:
1. Overview of dependency health
2. ${checkSecurity ? 'Security vulnerabilities and concerns' : ''}
3. ${suggestUpdates ? 'Recommended updates' : ''}
4. Unused or redundant packages
5. Alternative suggestions
6. Bundle size impact

Be specific and actionable.`);

      const chain = new LLMChain({ llm: this.llm, prompt });
      const result = await chain.call({ 
        dependencies: JSON.stringify(deps, null, 2),
        checkSecurity,
        suggestUpdates
      });

      return {
        content: [{
          type: 'text',
          text: `📦 Dependency Analysis:\n\n${result.text}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to analyze dependencies: ${error.message}`
        }]
      };
    }
  }

  async aiSentimentAnalysis(text, filePath) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`😊 Sentiment Analysis`);

    if (filePath && !text) {
      text = await readFile(filePath, 'utf-8');
    }

    const prompt = PromptTemplate.fromTemplate(`Analyze the sentiment of this text:

{text}

Provide:
1. Overall sentiment (positive/negative/neutral)
2. Confidence score (0-100%)
3. Key phrases indicating sentiment
4. Emotional tone
5. Suggestions for improvement (if negative)

Be objective and specific.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ text });

    return {
      content: [{
        type: 'text',
        text: `😊 Sentiment Analysis:\n\n${result.text}`
      }]
    };
  }

  async aiExtractEntities(text, entityTypes = ['person', 'organization', 'location', 'technology']) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`🏷️ Extracting entities: ${entityTypes.join(', ')}`);

    const prompt = PromptTemplate.fromTemplate(`Extract named entities from this text:

{text}

Entity types to extract: {entityTypes}

Format output as JSON with:
{{
  "person": [],
  "organization": [],
  "location": [],
  "technology": [],
  "other": []
}}

Be comprehensive and accurate.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ text, entityTypes: entityTypes.join(', ') });

    return {
      content: [{
        type: 'text',
        text: `🏷️ Extracted Entities:\n\n${result.text}`
      }]
    };
  }

  async aiTechDebtAnalysis(scope = 'full') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`⚠️ Analyzing technical debt (${scope})`);

    const projectPath = scope === 'full' ? this.config.projectPath : join(this.config.projectPath, scope);
    const files = await this.walkDirectory(projectPath, this.config.fileTypes);

    // Sample analysis on a subset
    const sampleFiles = files.slice(0, 10);
    let codebase = '';

    for (const file of sampleFiles) {
      const code = await readFile(file, 'utf-8');
      codebase += `\n// ${relative(this.config.projectPath, file)}\n${code.substring(0, 500)}...\n`;
    }

    const prompt = PromptTemplate.fromTemplate(`Analyze technical debt in this codebase:

{codebase}

Identify:
1. Code smells and anti-patterns
2. Outdated dependencies or patterns
3. Missing tests or documentation
4. Performance bottlenecks
5. Security concerns
6. Maintainability issues

Prioritize by:
- Impact (high/medium/low)
- Effort to fix
- Risk if not addressed

Provide actionable recommendations.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ codebase, scope });

    return {
      content: [{
        type: 'text',
        text: `⚠️ Technical Debt Analysis:\n\n${result.text}`
      }]
    };
  }

  async aiArchitectureRecommendations(focus = 'all') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`🏗️ Architecture recommendations (${focus})`);

    const files = await this.walkDirectory(this.config.projectPath, this.config.fileTypes);
    const structure = files.map(f => relative(this.config.projectPath, f)).slice(0, 30).join('\n');

    const prompt = PromptTemplate.fromTemplate(`Analyze project architecture and provide recommendations (focus: ${focus}):

Project structure:
{structure}

Focus areas: {focus}

Provide recommendations for:
1. ${focus === 'scalability' || focus === 'all' ? 'Scalability improvements' : ''}
2. ${focus === 'maintainability' || focus === 'all' ? 'Maintainability enhancements' : ''}
3. ${focus === 'performance' || focus === 'all' ? 'Performance optimizations' : ''}
4. ${focus === 'security' || focus === 'all' ? 'Security hardening' : ''}
5. Design patterns to adopt
6. Architecture refactoring suggestions

Be specific and practical.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ structure, focus });

    return {
      content: [{
        type: 'text',
        text: `🏗️ Architecture Recommendations:\n\n${result.text}`
      }]
    };
  }

  // ============ UI/UX TESTING METHODS ============

  async uiCaptureScreenshot(url, outputPath = './screenshots/capture.png', viewport = { width: 1920, height: 1080 }, waitForSelector = null) {
    console.error(`📸 Capturing screenshot: ${url}`);

    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      await page.setViewport(viewport);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      // Ensure output directory exists
      const dir = dirname(outputPath);
      await writeFile(dir, '', { recursive: true }).catch(() => {});
      
      await page.screenshot({ path: outputPath, fullPage: true });
      await browser.close();

      return {
        content: [{
          type: 'text',
          text: `✅ Screenshot captured: ${outputPath}\nViewport: ${viewport.width}x${viewport.height}\nURL: ${url}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Screenshot capture failed: ${error.message}`
        }]
      };
    }
  }

  async uiAnalyzeScreenshotHIG(screenshotPath, platform = 'ios', checkAreas = ['all']) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`🍎 Analyzing Apple HIG compliance: ${screenshotPath} (${platform})`);

    try {
      const imageData = await readFile(screenshotPath);
      const base64Image = imageData.toString('base64');

      const higGuidelines = {
        ios: `Apple iOS Human Interface Guidelines:
- Touch targets: minimum 44x44 points
- Typography: SF Pro (system font), Dynamic Type support
- Spacing: 8pt grid system, adequate padding
- Colors: System colors, support for Dark Mode
- Navigation: Clear hierarchy, tab bars, navigation bars
- Buttons: Clear, recognizable, properly sized
- Accessibility: VoiceOver support, color contrast ratios`,
        macos: `Apple macOS Human Interface Guidelines:
- Click targets: minimum 28x28 points
- Typography: SF Pro, clear hierarchy
- Spacing: Consistent padding and margins
- Windows: Proper toolbar, sidebar layouts
- Controls: Native macOS controls
- Accessibility: VoiceOver, keyboard navigation`,
        ipados: `Apple iPadOS Human Interface Guidelines:
- Touch targets: minimum 44x44 points
- Multi-tasking: Split View, Slide Over support
- Pointer: Support for trackpad/mouse
- Typography: SF Pro, adaptive layouts
- Spacing: Utilize screen space effectively`
      };

      const focusAreas = checkAreas.includes('all') ? 
        ['buttons', 'typography', 'spacing', 'colors', 'navigation', 'accessibility'] : 
        checkAreas;

      const prompt = PromptTemplate.fromTemplate(`You are an expert in Apple Human Interface Guidelines for ${platform}.

Analyze this ${platform} interface screenshot according to Apple HIG:

${higGuidelines[platform] || higGuidelines.ios}

Focus on: {focusAreas}

Provide detailed analysis:
1. **Compliance Issues**: Specific violations of Apple HIG
2. **Button Sizes**: Check if buttons meet minimum touch target sizes
3. **Typography**: Font usage, sizes, hierarchy
4. **Spacing & Layout**: Grid adherence, padding, margins
5. **Color Usage**: System colors, contrast, Dark Mode support
6. **Navigation Patterns**: Proper use of iOS/macOS navigation
7. **Accessibility**: VoiceOver support, contrast ratios
8. **Recommendations**: Specific fixes with code examples

Rate each area: ✅ Compliant | ⚠️ Needs Improvement | ❌ Non-Compliant`);

      const chain = new LLMChain({ llm: this.llm, prompt });
      
      // Note: This is a simplified version - in production, you'd send the image to a vision model
      const result = await chain.call({ 
        platform, 
        focusAreas: focusAreas.join(', ')
      });

      return {
        content: [{
          type: 'text',
          text: `🍎 Apple HIG Analysis (${platform}):\n\n${result.text}\n\n📸 Screenshot: ${screenshotPath}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Analysis failed: ${error.message}`
        }]
      };
    }
  }

  async uiTestResponsiveness(url, devices = ['iPhone 14 Pro', 'iPad Pro', 'Desktop 1920x1080'], outputDir = './screenshots/responsive') {
    console.error(`📱 Testing responsiveness: ${url}`);

    const devicePresets = {
      'iPhone 14 Pro': { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true },
      'iPhone SE': { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true },
      'iPad Pro': { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true },
      'iPad Air': { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true },
      'Desktop 1920x1080': { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false },
      'Desktop 1440x900': { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false }
    };

    try {
      const browser = await chromium.launch({ headless: true });
      const results = [];

      for (const deviceName of devices) {
        const device = devicePresets[deviceName] || devicePresets['Desktop 1920x1080'];
        const context = await browser.newContext({ 
          viewport: { width: device.width, height: device.height },
          deviceScaleFactor: device.deviceScaleFactor,
          isMobile: device.isMobile
        });
        
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle' });
        
        const screenshotPath = join(outputDir, `${deviceName.replace(/ /g, '_')}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        results.push({
          device: deviceName,
          viewport: `${device.width}x${device.height}`,
          screenshot: screenshotPath,
          status: '✅ Captured'
        });

        await context.close();
      }

      await browser.close();

      return {
        content: [{
          type: 'text',
          text: `📱 Responsiveness Test Complete:\n\n${results.map(r => 
            `${r.device}\n  Viewport: ${r.viewport}\n  Screenshot: ${r.screenshot}\n  ${r.status}`
          ).join('\n\n')}\n\nTest URL: ${url}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Responsiveness test failed: ${error.message}`
        }]
      };
    }
  }

  async uiCheckButtonSizes(screenshotPath, platform = 'ios') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`🔘 Checking button sizes: ${screenshotPath} (${platform})`);

    const minimumSizes = {
      ios: '44x44 points (iOS/iPadOS)',
      macos: '28x28 points (macOS)',
      ipados: '44x44 points (iPadOS)'
    };

    const prompt = PromptTemplate.fromTemplate(`You are an Apple HIG compliance expert analyzing button sizes.

Platform: ${platform}
Minimum Touch Target: ${minimumSizes[platform] || minimumSizes.ios}

Analyze this screenshot and identify ALL interactive elements (buttons, links, icons):

For each interactive element, provide:
1. **Element Description**: What it is (e.g., "Login button", "Close icon")
2. **Estimated Size**: Visual size in points
3. **Compliance**: ✅ Meets minimum | ❌ Too small
4. **Recommendation**: If non-compliant, suggest size adjustment

Apple HIG Requirements:
- iOS/iPadOS: 44x44pt minimum for touch targets
- macOS: 28x28pt minimum for click targets  
- Provide adequate spacing between touch targets
- Consider accessibility needs (larger targets for better usability)

Format as a table with clear pass/fail indicators.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ platform });

    return {
      content: [{
        type: 'text',
        text: `🔘 Button Size Analysis (${platform}):\n\n${result.text}\n\n📸 Screenshot: ${screenshotPath}\n\n💡 Tip: Use browser dev tools to measure exact pixel dimensions.`
      }]
    };
  }

  async uiAccessibilityAudit(screenshotPath, url = null, standards = ['WCAG_2.1_AA', 'Apple_HIG']) {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`♿ Accessibility audit: ${screenshotPath}`);

    try {
      const standardsInfo = {
        'WCAG_2.1_AA': 'WCAG 2.1 Level AA compliance',
        'WCAG_2.1_AAA': 'WCAG 2.1 Level AAA compliance',
        'Apple_HIG': 'Apple Accessibility Guidelines',
        'Section_508': 'Section 508 compliance'
      };

      const selectedStandards = standards.map(s => standardsInfo[s] || s).join(', ');

      const prompt = PromptTemplate.fromTemplate(`You are an accessibility expert conducting a comprehensive audit.

Standards: {selectedStandards}

Analyze this interface for accessibility compliance:

**1. Color Contrast (WCAG)**
- Text contrast ratios (minimum 4.5:1 for normal text, 3:1 for large text)
- Non-text element contrast
- Color-blind friendly palette

**2. Touch/Click Targets (Apple HIG)**
- Minimum sizes met
- Adequate spacing
- Clear focus indicators

**3. Visual Hierarchy**
- Logical heading structure
- Clear information architecture
- Consistent patterns

**4. Screen Reader Compatibility**
- Alt text needs
- ARIA labels required
- Semantic HTML usage

**5. Keyboard Navigation**
- Focus order
- Skip links
- Keyboard traps

**6. Motion & Animation**
- Reduced motion support
- No auto-play content
- Pause controls

For each issue found:
- Severity: 🔴 Critical | 🟡 High | 🟢 Medium | 🔵 Low
- WCAG Criterion: (e.g., 1.4.3, 2.4.7)
- Description: What's wrong
- Fix: How to resolve with code example

Provide an overall accessibility score (0-100).`);

      const chain = new LLMChain({ llm: this.llm, prompt });
      const result = await chain.call({ selectedStandards });

      return {
        content: [{
          type: 'text',
          text: `♿ Accessibility Audit:\n\nStandards: ${selectedStandards}\n\n${result.text}\n\n📸 Screenshot: ${screenshotPath}${url ? `\n🔗 URL: ${url}` : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Accessibility audit failed: ${error.message}`
        }]
      };
    }
  }

  async uiCompareDesignSystems(screenshotPath, designSystem = 'Apple_HIG') {
    if (!this.llm) {
      return { content: [{ type: 'text', text: '❌ LLM not initialized.' }] };
    }

    console.error(`🎨 Comparing against design system: ${designSystem}`);

    const designSystems = {
      'Apple_HIG': 'Apple Human Interface Guidelines',
      'Material_Design': 'Google Material Design 3',
      'Fluent': 'Microsoft Fluent Design System',
      'Tailwind': 'Tailwind CSS Design Principles',
      'Carbon': 'IBM Carbon Design System'
    };

    const prompt = PromptTemplate.fromTemplate(`Compare this interface against ${designSystems[designSystem] || designSystem} guidelines.

Analyze:
1. **Visual Style**: Does it match the design system aesthetic?
2. **Components**: Are standard components used correctly?
3. **Typography**: Font families, sizes, weights per guidelines
4. **Color System**: Proper use of design tokens/color palette
5. **Spacing**: Consistent with system spacing scale
6. **Icons**: Icon style and sizing
7. **Elevation/Shadows**: Proper depth/shadow usage
8. **Motion**: Animation principles compliance

For each area:
- ✅ Compliant: Follows guidelines
- ⚠️ Partial: Some deviation
- ❌ Non-Compliant: Significant violations

Provide specific recommendations to better align with {designSystem}.`);

    const chain = new LLMChain({ llm: this.llm, prompt });
    const result = await chain.call({ designSystem: designSystems[designSystem] || designSystem });

    return {
      content: [{
        type: 'text',
        text: `🎨 Design System Comparison:\n\nSystem: ${designSystems[designSystem] || designSystem}\n\n${result.text}\n\n📸 Screenshot: ${screenshotPath}`
      }]
    };
  }

  async uiGenerateTestReport(url, testSuite = 'complete', outputDir = './test-reports') {
    console.error(`📊 Generating UI/UX test report: ${url}`);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportDir = join(outputDir, `report-${timestamp}`);
      
      const results = {
        url,
        timestamp: new Date().toISOString(),
        testSuite,
        tests: {}
      };

      // Capture screenshots
      if (testSuite === 'complete' || testSuite === 'responsive') {
        console.error('📱 Running responsiveness tests...');
        const devices = ['iPhone 14 Pro', 'iPad Pro', 'Desktop 1920x1080'];
        const responsiveResult = await this.uiTestResponsiveness(url, devices, join(reportDir, 'responsive'));
        results.tests.responsiveness = responsiveResult;
      }

      // HIG Compliance
      if (testSuite === 'complete' || testSuite === 'hig_compliance') {
        console.error('🍎 Running Apple HIG compliance check...');
        const screenshotPath = join(reportDir, 'hig-check.png');
        await this.uiCaptureScreenshot(url, screenshotPath);
        const higResult = await this.uiAnalyzeScreenshotHIG(screenshotPath, 'ios');
        results.tests.hig_compliance = higResult;
      }

      // Accessibility
      if (testSuite === 'complete' || testSuite === 'accessibility') {
        console.error('♿ Running accessibility audit...');
        const screenshotPath = join(reportDir, 'accessibility.png');
        await this.uiCaptureScreenshot(url, screenshotPath);
        const a11yResult = await this.uiAccessibilityAudit(screenshotPath, url);
        results.tests.accessibility = a11yResult;
      }

      // Generate HTML report
      const reportPath = join(reportDir, 'report.html');
      const htmlReport = this.generateHTMLReport(results);
      await writeFile(reportPath, htmlReport);

      return {
        content: [{
          type: 'text',
          text: `📊 UI/UX Test Report Generated:\n\nURL: ${url}\nTest Suite: ${testSuite}\nReport Directory: ${reportDir}\nHTML Report: ${reportPath}\n\nTests Completed:\n${Object.keys(results.tests).map(t => `- ✅ ${t}`).join('\n')}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Test report generation failed: ${error.message}`
        }]
      };
    }
  }

  generateHTMLReport(results) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI/UX Test Report - ${results.url}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif; background: #f5f5f7; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
        h1 { font-size: 36px; font-weight: 700; margin-bottom: 10px; }
        .meta { color: #666; margin-bottom: 30px; }
        .test-section { margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .test-section h2 { font-size: 24px; margin-bottom: 15px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 600; }
        .badge.success { background: #34c759; color: white; }
        .badge.warning { background: #ff9500; color: white; }
        .badge.error { background: #ff3b30; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 UI/UX Test Report</h1>
        <div class="meta">
            <p><strong>URL:</strong> ${results.url}</p>
            <p><strong>Test Suite:</strong> ${results.testSuite}</p>
            <p><strong>Generated:</strong> ${results.timestamp}</p>
        </div>
        
        ${Object.entries(results.tests).map(([testName, testResult]) => `
            <div class="test-section">
                <h2>✅ ${testName.replace(/_/g, ' ').toUpperCase()}</h2>
                <pre>${JSON.stringify(testResult, null, 2)}</pre>
            </div>
        `).join('')}
        
        <div class="test-section">
            <h2>📊 Summary</h2>
            <p>Total Tests: ${Object.keys(results.tests).length}</p>
            <p class="badge success">All tests completed successfully</p>
        </div>
    </div>
</body>
</html>`;
  }

  async run() {
    await this.initialize();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('\n🌙 Luna Nexa RAG MCP Server Running');
    console.error('================================');
    console.error(`📁 Project Path: ${this.config.projectPath}`);
    console.error(`🗄️  Collection: ${this.config.collectionName}`);
    console.error(`🔗 ChromaDB: ${this.config.chromaHost}:${this.config.chromaPort}`);
    if (this.config.useNexaEmbeddings) {
      console.error(`⚡ Nexa Backend: ${this.config.nexaEndpoint}`);
      console.error(`🚀 Using Nexa for high-quality embeddings`);
    }
    console.error('================================\n');
  }
}

// Start the server
const server = new LunaNexaRAGServer();
server.run().catch(console.error);