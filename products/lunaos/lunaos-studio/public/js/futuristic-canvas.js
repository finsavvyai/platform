/**
 * Futuristic LunaOS Canvas System
 * Inspired by Decart.ai's modern design
 */

// Global variables
var canvas = null;
var ctx = null;
var nodes = [];
var selectedNode = null;
var isDragging = false;
var dragOffset = { x: 0, y: 0 };

// Make showTab available globally immediately
window.showTab = function(tabName) {
  console.log('🔄 Switching to tab:', tabName);
    
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
    
  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
    
  // Show selected tab
  const tabElement = document.getElementById(tabName + '-tab');
  const buttonElement = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    
  if (tabElement) {
    tabElement.classList.add('active');
  } else {
    console.error('Tab element not found:', tabName + '-tab');
  }
    
  if (buttonElement) {
    buttonElement.classList.add('active');
  } else {
    console.error('Button element not found for tab:', tabName);
  }
    
  console.log('✅ Tab switched to:', tabName);
};

// Node configurations - Expanded AI Agent Library
var nodeConfigs = {
  // Core Workflow Agents
  'trigger': {
    title: 'Trigger',
    description: 'Start workflow execution',
    icon: '⚡',
    color: '#fbbf24',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    category: 'Core',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30,
      retries: 3,
      enabled: true,
      prompt: 'You are a workflow trigger. Start the execution process.',
      envVars: 'WORKFLOW_ID=trigger\nEXECUTION_MODE=immediate'
    }
  },
  'condition': {
    title: 'Condition',
    description: 'Branch workflow based on conditions',
    icon: '🔀',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    category: 'Core',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 500,
      timeout: 15,
      retries: 2,
      enabled: true,
      prompt: 'You are a condition evaluator. Analyze input and determine the correct workflow path.',
      envVars: 'CONDITION_TYPE=boolean\nEVALUATION_MODE=strict'
    }
  },
  'delay': {
    title: 'Delay',
    description: 'Pause workflow execution',
    icon: '⏱️',
    color: '#6b7280',
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    category: 'Core',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 100,
      timeout: 5,
      retries: 1,
      enabled: true,
      prompt: 'You are a delay agent. Wait for the specified time before continuing.',
      envVars: 'DELAY_TYPE=time\nDELAY_VALUE=5s'
    }
  },
    
  // Communication Agents
  'chat-agent': {
    title: 'Chat Agent',
    description: 'AI conversation agent',
    icon: '💬',
    color: '#7877C6',
    gradient: 'linear-gradient(135deg, #7877C6 0%, #5B5A9A 100%)',
    category: 'Communication',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.8,
      maxTokens: 2000,
      timeout: 60,
      retries: 3,
      enabled: true,
      prompt: 'You are a helpful AI assistant. Engage in natural conversation and provide helpful responses.',
      envVars: 'CONVERSATION_MODE=chat\nRESPONSE_STYLE=helpful'
    }
  },
  'email-agent': {
    title: 'Email Agent',
    description: 'Send and process emails',
    icon: '📧',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    category: 'Communication',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.6,
      maxTokens: 1500,
      timeout: 45,
      retries: 3,
      enabled: true,
      prompt: 'You are an email processing agent. Compose, send, and analyze emails professionally.',
      envVars: 'EMAIL_PROVIDER=smtp\nPRIORITY=normal'
    }
  },
  'slack-agent': {
    title: 'Slack Agent',
    description: 'Slack integration and messaging',
    icon: '💼',
    color: '#4a154b',
    gradient: 'linear-gradient(135deg, #4a154b 0%, #350d36 100%)',
    category: 'Communication',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30,
      retries: 3,
      enabled: true,
      prompt: 'You are a Slack integration agent. Send messages, manage channels, and interact with Slack APIs.',
      envVars: 'SLACK_TOKEN=your_token\nCHANNEL=general'
    }
  },
  'discord-agent': {
    title: 'Discord Agent',
    description: 'Discord bot integration',
    icon: '🎮',
    color: '#5865f2',
    gradient: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
    category: 'Communication',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.8,
      maxTokens: 2000,
      timeout: 45,
      retries: 3,
      enabled: true,
      prompt: 'You are a Discord bot agent. Interact with Discord servers, send messages, and manage interactions.',
      envVars: 'DISCORD_TOKEN=your_token\nGUILD_ID=your_guild'
    }
  },
    
  // Data Processing Agents
  'data-processor': {
    title: 'Data Processor',
    description: 'Process and transform data',
    icon: '🗄️',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    category: 'Data',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 4000,
      timeout: 120,
      retries: 2,
      enabled: true,
      prompt: 'You are a data processing agent. Analyze, transform, and structure data according to the requirements.',
      envVars: 'PROCESSING_MODE=structured\nOUTPUT_FORMAT=json'
    }
  },
  'csv-processor': {
    title: 'CSV Processor',
    description: 'Process CSV files and data',
    icon: '📊',
    color: '#059669',
    gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    category: 'Data',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.2,
      maxTokens: 3000,
      timeout: 90,
      retries: 2,
      enabled: true,
      prompt: 'You are a CSV processing agent. Read, parse, transform, and export CSV data efficiently.',
      envVars: 'CSV_DELIMITER=,\nENCODING=utf-8'
    }
  },
  'json-processor': {
    title: 'JSON Processor',
    description: 'Process JSON data structures',
    icon: '🔧',
    color: '#0d9488',
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
    category: 'Data',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.2,
      maxTokens: 3000,
      timeout: 60,
      retries: 2,
      enabled: true,
      prompt: 'You are a JSON processing agent. Parse, validate, transform, and manipulate JSON data structures.',
      envVars: 'JSON_SCHEMA=strict\nVALIDATION_MODE=enabled'
    }
  },
    
  // Web & API Agents
  'web-scraper': {
    title: 'Web Scraper',
    description: 'Extract data from websites',
    icon: '🕷️',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    category: 'Web',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.2,
      maxTokens: 3000,
      timeout: 90,
      retries: 3,
      enabled: true,
      prompt: 'You are a web scraping agent. Extract relevant data from web pages while respecting robots.txt and rate limits.',
      envVars: 'SCRAPING_MODE=respectful\nRATE_LIMIT=1s\nUSER_AGENT=LunaOS-Bot'
    }
  },
  'api-client': {
    title: 'API Client',
    description: 'Make HTTP API requests',
    icon: '🌐',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    category: 'Web',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000,
      timeout: 60,
      retries: 3,
      enabled: true,
      prompt: 'You are an API client agent. Make HTTP requests, handle responses, and manage API interactions.',
      envVars: 'HTTP_METHOD=GET\nTIMEOUT=30s\nRETRY_COUNT=3'
    }
  },
  'webhook': {
    title: 'Webhook',
    description: 'Receive and process webhooks',
    icon: '🔗',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    category: 'Web',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.4,
      maxTokens: 1500,
      timeout: 30,
      retries: 2,
      enabled: true,
      prompt: 'You are a webhook processing agent. Receive, validate, and process incoming webhook data.',
      envVars: 'WEBHOOK_SECRET=your_secret\nVALIDATION_MODE=signature'
    }
  },
    
  // AI & ML Agents
  'text-analyzer': {
    title: 'Text Analyzer',
    description: 'Analyze and process text content',
    icon: '📝',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    category: 'AI/ML',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 3000,
      timeout: 90,
      retries: 2,
      enabled: true,
      prompt: 'You are a text analysis agent. Perform sentiment analysis, entity extraction, and text processing.',
      envVars: 'ANALYSIS_TYPE=sentiment\nLANGUAGE=en\nOUTPUT_FORMAT=structured'
    }
  },
  'image-processor': {
    title: 'Image Processor',
    description: 'Process and analyze images',
    icon: '🖼️',
    color: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    category: 'AI/ML',
    defaultProperties: {
      model: 'gpt-4-vision',
      temperature: 0.2,
      maxTokens: 2000,
      timeout: 120,
      retries: 2,
      enabled: true,
      prompt: 'You are an image processing agent. Analyze images, extract information, and perform visual tasks.',
      envVars: 'IMAGE_FORMAT=jpg\nMAX_SIZE=10MB\nANALYSIS_MODE=detailed'
    }
  },
  'translation-agent': {
    title: 'Translation Agent',
    description: 'Translate text between languages',
    icon: '🌍',
    color: '#84cc16',
    gradient: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
    category: 'AI/ML',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.4,
      maxTokens: 2000,
      timeout: 60,
      retries: 3,
      enabled: true,
      prompt: 'You are a translation agent. Translate text between languages while preserving context and meaning.',
      envVars: 'SOURCE_LANG=auto\nTARGET_LANG=en\nTRANSLATION_MODE=contextual'
    }
  },
    
  // Business & Productivity Agents
  'calendar-agent': {
    title: 'Calendar Agent',
    description: 'Manage calendar and scheduling',
    icon: '📅',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    category: 'Productivity',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 1500,
      timeout: 45,
      retries: 3,
      enabled: true,
      prompt: 'You are a calendar management agent. Schedule meetings, manage events, and handle calendar operations.',
      envVars: 'CALENDAR_PROVIDER=google\nTIMEZONE=UTC\nSCHEDULING_MODE=smart'
    }
  },
  'task-manager': {
    title: 'Task Manager',
    description: 'Manage tasks and to-dos',
    icon: '✅',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    category: 'Productivity',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.6,
      maxTokens: 1500,
      timeout: 45,
      retries: 3,
      enabled: true,
      prompt: 'You are a task management agent. Create, update, and track tasks and to-do items.',
      envVars: 'TASK_PRIORITY=medium\nSTATUS=pending\nASSIGNEE=auto'
    }
  },
  'notification-agent': {
    title: 'Notification Agent',
    description: 'Send notifications and alerts',
    icon: '🔔',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    category: 'Productivity',
    defaultProperties: {
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 1000,
      timeout: 30,
      retries: 3,
      enabled: true,
      prompt: 'You are a notification agent. Send alerts, notifications, and important messages to users.',
      envVars: 'NOTIFICATION_TYPE=push\nPRIORITY=normal\nCHANNEL=all'
    }
  }
};

// Workflow Templates
var workflowTemplates = {
  'email-notification': {
    name: 'Email Notification System',
    description: 'Automated email alerts and notifications',
    complexity: 'Simple',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Start' },
      { type: 'condition', x: 300, y: 100, title: 'Check Condition' },
      { type: 'email-agent', x: 500, y: 50, title: 'Send Email' },
      { type: 'notification-agent', x: 500, y: 150, title: 'Send Notification' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2, condition: 'true' },
      { from: 1, to: 3, condition: 'false' }
    ]
  },
  'data-backup': {
    name: 'Data Backup Workflow',
    description: 'Automated data backup and storage',
    complexity: 'Simple',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Backup Trigger' },
      { type: 'data-processor', x: 300, y: 100, title: 'Process Data' },
      { type: 'api-client', x: 500, y: 100, title: 'Upload to Cloud' },
      { type: 'notification-agent', x: 700, y: 100, title: 'Backup Complete' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 }
    ]
  },
  'social-media-post': {
    name: 'Social Media Automation',
    description: 'Automated social media posting and management',
    complexity: 'Simple',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Post Trigger' },
      { type: 'text-analyzer', x: 300, y: 100, title: 'Analyze Content' },
      { type: 'image-processor', x: 500, y: 50, title: 'Process Image' },
      { type: 'api-client', x: 500, y: 150, title: 'Post to Social' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 }
    ]
  },
  'customer-support': {
    name: 'AI Customer Support',
    description: 'Intelligent customer support system with escalation',
    complexity: 'Intermediate',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Support Request' },
      { type: 'text-analyzer', x: 300, y: 100, title: 'Analyze Request' },
      { type: 'condition', x: 500, y: 100, title: 'Can Auto-Resolve?' },
      { type: 'chat-agent', x: 700, y: 50, title: 'AI Response' },
      { type: 'email-agent', x: 700, y: 150, title: 'Escalate to Human' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, condition: 'true' },
      { from: 2, to: 4, condition: 'false' }
    ]
  },
  'content-moderation': {
    name: 'Content Moderation System',
    description: 'Automated content filtering and moderation',
    complexity: 'Intermediate',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Content Upload' },
      { type: 'text-analyzer', x: 300, y: 50, title: 'Text Analysis' },
      { type: 'image-processor', x: 300, y: 150, title: 'Image Analysis' },
      { type: 'condition', x: 500, y: 100, title: 'Content Safe?' },
      { type: 'notification-agent', x: 700, y: 50, title: 'Approve' },
      { type: 'email-agent', x: 700, y: 150, title: 'Reject & Notify' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4, condition: 'true' },
      { from: 3, to: 5, condition: 'false' }
    ]
  },
  'lead-scoring': {
    name: 'Lead Scoring System',
    description: 'Automated lead qualification and scoring',
    complexity: 'Intermediate',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'New Lead' },
      { type: 'data-processor', x: 300, y: 100, title: 'Process Lead Data' },
      { type: 'text-analyzer', x: 500, y: 100, title: 'Analyze Behavior' },
      { type: 'condition', x: 700, y: 100, title: 'High Value Lead?' },
      { type: 'email-agent', x: 900, y: 50, title: 'Send to Sales' },
      { type: 'notification-agent', x: 900, y: 150, title: 'Add to Nurture' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4, condition: 'true' },
      { from: 3, to: 5, condition: 'false' }
    ]
  },
  'ecommerce-automation': {
    name: 'E-commerce Automation',
    description: 'Complete e-commerce workflow automation',
    complexity: 'Advanced',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Order Placed' },
      { type: 'data-processor', x: 300, y: 100, title: 'Process Order' },
      { type: 'condition', x: 500, y: 100, title: 'Payment Valid?' },
      { type: 'api-client', x: 700, y: 50, title: 'Update Inventory' },
      { type: 'email-agent', x: 700, y: 150, title: 'Order Confirmation' },
      { type: 'webhook', x: 900, y: 100, title: 'Fulfillment API' },
      { type: 'notification-agent', x: 1100, y: 100, title: 'Shipping Update' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, condition: 'true' },
      { from: 2, to: 4, condition: 'false' },
      { from: 3, to: 5 },
      { from: 5, to: 6 }
    ]
  },
  'financial-analysis': {
    name: 'Financial Analysis System',
    description: 'Automated financial data analysis and reporting',
    complexity: 'Advanced',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Daily Trigger' },
      { type: 'api-client', x: 300, y: 50, title: 'Fetch Market Data' },
      { type: 'csv-processor', x: 300, y: 150, title: 'Process Transactions' },
      { type: 'data-processor', x: 500, y: 100, title: 'Analyze Data' },
      { type: 'text-analyzer', x: 700, y: 100, title: 'Generate Report' },
      { type: 'email-agent', x: 900, y: 100, title: 'Send Report' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 }
    ]
  },
  'multi-language-support': {
    name: 'Multi-language Support',
    description: 'Global customer support with translation',
    complexity: 'Advanced',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'Support Request' },
      { type: 'translation-agent', x: 300, y: 100, title: 'Detect Language' },
      { type: 'condition', x: 500, y: 100, title: 'English?' },
      { type: 'chat-agent', x: 700, y: 50, title: 'English Support' },
      { type: 'translation-agent', x: 700, y: 150, title: 'Translate to English' },
      { type: 'chat-agent', x: 900, y: 150, title: 'AI Support' },
      { type: 'translation-agent', x: 1100, y: 150, title: 'Translate Response' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3, condition: 'true' },
      { from: 2, to: 4, condition: 'false' },
      { from: 4, to: 5 },
      { from: 5, to: 6 }
    ]
  },
  'enterprise-integration': {
    name: 'Enterprise Integration',
    description: 'Complete enterprise system integration',
    complexity: 'Enterprise',
    nodes: [
      { type: 'trigger', x: 100, y: 100, title: 'System Event' },
      { type: 'webhook', x: 300, y: 50, title: 'Receive Webhook' },
      { type: 'data-processor', x: 300, y: 150, title: 'Process Data' },
      { type: 'condition', x: 500, y: 100, title: 'Route Event' },
      { type: 'api-client', x: 700, y: 50, title: 'CRM Update' },
      { type: 'api-client', x: 700, y: 100, title: 'ERP Sync' },
      { type: 'api-client', x: 700, y: 150, title: 'Analytics Push' },
      { type: 'slack-agent', x: 900, y: 100, title: 'Team Notification' },
      { type: 'email-agent', x: 1100, y: 100, title: 'Executive Report' }
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4, condition: 'crm' },
      { from: 3, to: 5, condition: 'erp' },
      { from: 3, to: 6, condition: 'analytics' },
      { from: 4, to: 7 },
      { from: 5, to: 7 },
      { from: 6, to: 7 },
      { from: 7, to: 8 }
    ]
  }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing LunaOS Futuristic Canvas...');
    
  // Create particles
  createParticles();
    
  // Initialize canvas
  initializeCanvas();
    
  // Setup event listeners
  setupEventListeners();
    
  // Create initial workflow
  setTimeout(createInitialWorkflow, 1000);
    
  console.log('✅ LunaOS initialized successfully');
});

function createParticles() {
  const particlesContainer = document.getElementById('particles');
  const particleCount = 50;
    
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
    particlesContainer.appendChild(particle);
  }
}

function initializeCanvas() {
  console.log('🎨 Initializing canvas...');
    
  canvas = document.getElementById('workflow-canvas');
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }
    
  // Set canvas size
  const container = canvas.parentElement;
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
    
  ctx = canvas.getContext('2d');
    
  // Set canvas style
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
    
  console.log('✅ Canvas initialized:', canvas.width, 'x', canvas.height);
}

function setupEventListeners() {
  // Canvas events
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('click', handleCanvasClick);
    
  // Drag and drop from sidebar
  const nodeTypes = document.querySelectorAll('.node-type');
  nodeTypes.forEach(nodeType => {
    nodeType.addEventListener('dragstart', handleDragStart);
  });
    
  canvas.addEventListener('dragover', handleDragOver);
  canvas.addEventListener('drop', handleDrop);
    
  // Window resize
  window.addEventListener('resize', handleResize);
}

function handleMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
    
  // Check if clicking on a node
  const clickedNode = getNodeAt(x, y);
  if (clickedNode) {
    selectedNode = clickedNode;
    isDragging = true;
    dragOffset.x = x - clickedNode.x;
    dragOffset.y = y - clickedNode.y;
    canvas.style.cursor = 'grabbing';
  }
    
  drawCanvas();
}

function handleMouseMove(e) {
  if (!isDragging || !selectedNode) return;
    
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
    
  selectedNode.x = x - dragOffset.x;
  selectedNode.y = y - dragOffset.y;
    
  drawCanvas();
}

function handleMouseUp(e) {
  isDragging = false;
  canvas.style.cursor = 'default';
}

function handleCanvasClick(e) {
  if (isDragging) return;
    
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
    
  const clickedNode = getNodeAt(x, y);
  if (clickedNode) {
    // Deselect all nodes
    nodes.forEach(node => node.selected = false);
    // Select clicked node
    clickedNode.selected = true;
    selectedNode = clickedNode;
    updateStatus(`Selected: ${clickedNode.title}`, 'info');
        
    // Show properties panel
    showNodeProperties(clickedNode);
  } else {
    // Deselect all nodes
    nodes.forEach(node => node.selected = false);
    selectedNode = null;
    updateStatus('Ready', 'success');
        
    // Hide properties panel
    hideNodeProperties();
  }
    
  drawCanvas();
}

function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.nodeType);
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  const nodeType = e.dataTransfer.getData('text/plain');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
    
  createNode(nodeType, x, y);
}

function handleResize() {
  if (!canvas) return;
    
  const container = canvas.parentElement;
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
  drawCanvas();
}

function getNodeAt(x, y) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (x >= node.x && x <= node.x + node.width &&
            y >= node.y && y <= node.y + node.height) {
      return node;
    }
  }
  return null;
}

function createNode(type, x, y) {
  const config = nodeConfigs[type];
  if (!config) {
    console.error('Unknown node type:', type);
    return;
  }
    
  const node = {
    id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    type: type,
    x: x - 100, // Center the node
    y: y - 50,
    width: 200,
    height: 100,
    title: config.title,
    description: config.description,
    icon: config.icon,
    color: config.color,
    gradient: config.gradient,
    selected: false,
    createdAt: new Date(),
    properties: { ...config.defaultProperties } // Copy default properties
  };
    
  nodes.push(node);
  updateNodeCount();
  updateStatus(`Created: ${node.title}`, 'success');
  drawCanvas();
    
  console.log('✅ Node created:', node.title);
}

function drawCanvas() {
  if (!ctx) return;
    
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
    
  // Draw grid
  drawGrid();
    
  // Draw nodes
  nodes.forEach(node => drawNode(node));
}

function drawGrid() {
  const gridSize = 20;
  const opacity = 0.1;
    
  ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
  ctx.lineWidth = 1;
    
  // Vertical lines
  for (let x = 0; x < canvas.width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
    
  // Horizontal lines
  for (let y = 0; y < canvas.height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawNode(node) {
  const x = node.x;
  const y = node.y;
  const width = node.width;
  const height = node.height;
    
  // Create gradient
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, node.color);
  gradient.addColorStop(1, adjustColor(node.color, -20));
    
  // Node background with gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);
    
  // Node border
  if (node.selected) {
    ctx.strokeStyle = '#7877C6';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#7877C6';
    ctx.shadowBlur = 10;
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;
  }
  ctx.strokeRect(x, y, width, height);
    
  // Reset shadow
  ctx.shadowBlur = 0;
    
  // Node icon
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(node.icon, x + 20, y + 35);
    
  // Node title
  ctx.fillStyle = 'white';
  ctx.font = 'bold 14px Inter';
  ctx.fillText(node.title, x + 20, y + 60);
    
  // Node description
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '12px Inter';
  ctx.fillText(node.description, x + 20, y + 80);
    
  // Glow effect for selected node
  if (node.selected) {
    ctx.shadowColor = '#7877C6';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#7877C6';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
    ctx.shadowBlur = 0;
  }
}

function adjustColor(color, amount) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * amount);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function createInitialWorkflow() {
  console.log('🎯 Creating initial workflow...');
    
  // Create sample nodes
  createNode('trigger', 150, 150);
  createNode('chat-agent', 400, 150);
  createNode('data-processor', 400, 300);
  createNode('web-scraper', 150, 300);
    
  updateStatus('Initial workflow created', 'success');
}

// Modal Management
function showModal(title, subtitle, placeholder, callback) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalSubtitle = document.getElementById('modal-subtitle');
  const input = document.getElementById('workflow-name');
  const confirmBtn = document.getElementById('modal-confirm-btn');
    
  modalTitle.textContent = title;
  modalSubtitle.textContent = subtitle;
  input.placeholder = placeholder;
  input.value = '';
    
  // Store callback
  modal.callback = callback;
    
  // Show modal
  modal.classList.add('active');
  input.focus();
    
  // Handle Enter key
  input.onkeydown = function(e) {
    if (e.key === 'Enter') {
      confirmModal();
    } else if (e.key === 'Escape') {
      closeModal();
    }
  };
}

function closeModal() {
  const modal = document.getElementById('modal-overlay');
  modal.classList.remove('active');
  modal.callback = null;
}

function confirmModal() {
  const modal = document.getElementById('modal-overlay');
  const input = document.getElementById('workflow-name');
  const value = input.value.trim();
    
  if (value && modal.callback) {
    modal.callback(value);
  }
    
  closeModal();
}

// Workflow Management Functions
function newWorkflow() {
  console.log('🆕 Opening workflow creation wizard...');
    
  // Show the new workflow wizard
  const wizard = document.getElementById('workflow-wizard');
  if (wizard) {
    wizard.classList.add('active');
        
    // Reset wizard state
    if (typeof currentStep !== 'undefined') {
      currentStep = 1;
    }
    if (typeof workflowData !== 'undefined') {
      workflowData = {
        name: '',
        template: '',
        agents: [],
        database: false,
        auth: false,
        storage: false,
        functions: false
      };
    }
        
    // Update to first step
    if (typeof updateStep !== 'undefined') {
      updateStep(1);
    }
        
    // Clear the name input
    const nameInput = document.getElementById('workflow-name-input');
    if (nameInput) {
      nameInput.value = '';
    }
        
    // Reset template selection
    document.querySelectorAll('.template-option').forEach(el => {
      el.classList.remove('selected');
    });
        
    // Reset agent selections
    document.querySelectorAll('.agent-option input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      cb.closest('.agent-option').classList.remove('selected');
    });
        
    // Disable next buttons
    const templateNextBtn = document.getElementById('template-next-btn');
    const agentsNextBtn = document.getElementById('agents-next-btn');
    if (templateNextBtn) templateNextBtn.disabled = true;
    if (agentsNextBtn) agentsNextBtn.disabled = true;
        
  } else {
    console.error('❌ Workflow wizard not found!');
  }
}

function openWorkflow() {
  console.log('📂 Opening workflow...');
    
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const workflowData = JSON.parse(e.target.result);
          loadWorkflow(workflowData);
          updateStatus('Workflow loaded successfully', 'success');
        } catch (error) {
          updateStatus('Failed to load workflow: ' + error.message, 'error');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function saveWorkflow() {
  console.log('💾 Saving workflow...');
    
  if (nodes.length === 0) {
    updateStatus('No workflow to save', 'error');
    return;
  }
    
  const workflowData = {
    id: 'workflow_' + Date.now(),
    name: 'LunaOS Workflow',
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      title: node.title,
      description: node.description,
      icon: node.icon,
      color: node.color
    })),
    metadata: {
      created: new Date().toISOString(),
      version: '2.0.0',
      nodeCount: nodes.length,
      platform: 'LunaOS'
    }
  };
    
  const blob = new Blob([JSON.stringify(workflowData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
    
  const a = document.createElement('a');
  a.href = url;
  a.download = `lunaos-workflow-${workflowData.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
    
  updateStatus(`Workflow saved with ${nodes.length} nodes`, 'success');
  console.log('✅ Workflow saved:', workflowData.id);
}

function runWorkflow() {
  console.log('▶️ Running workflow...');
    
  if (nodes.length === 0) {
    updateStatus('No nodes to execute', 'error');
    return;
  }
    
  updateStatus('Executing workflow...', 'warning');
    
  let nodeIndex = 0;
    
  function highlightNextNode() {
    if (nodeIndex < nodes.length) {
      // Deselect all nodes
      nodes.forEach(node => node.selected = false);
            
      // Highlight current node
      nodes[nodeIndex].selected = true;
      drawCanvas();
            
      updateStatus(`Executing: ${nodes[nodeIndex].title}`, 'warning');
            
      // Move to next node after delay
      setTimeout(() => {
        nodeIndex++;
        highlightNextNode();
      }, 1000);
    } else {
      // All nodes processed
      nodes.forEach(node => node.selected = false);
      drawCanvas();
      updateStatus('Workflow completed successfully!', 'success');
      console.log('✅ Workflow execution completed');
    }
  }
    
  highlightNextNode();
}

function loadWorkflow(workflowData) {
  console.log('📥 Loading workflow...');
    
  // Clear existing nodes
  nodes = [];
  selectedNode = null;
    
  // Recreate nodes from saved data
  if (workflowData.nodes && workflowData.nodes.length > 0) {
    workflowData.nodes.forEach(nodeData => {
      createNode(nodeData.type, nodeData.x + 100, nodeData.y + 50);
    });
    updateStatus(`Workflow loaded with ${workflowData.nodes.length} nodes`, 'success');
  } else {
    updateStatus('Workflow loaded (no nodes)', 'success');
  }
    
  drawCanvas();
}

// UI Update Functions
function updateStatus(message, type) {
  console.log('📊 Status:', message, '(' + (type || 'info') + ')');
    
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.getElementById('status-indicator');
    
  if (statusText) {
    statusText.textContent = message;
  }
    
  if (statusIndicator) {
    statusIndicator.className = 'status-indicator ' + (type || 'info');
  }
}

function updateNodeCount() {
  const nodeCount = document.getElementById('node-count');
  const connectionCount = document.getElementById('connection-count');
    
  if (nodeCount) {
    nodeCount.textContent = nodes.length;
  }
    
  if (connectionCount) {
    connectionCount.textContent = '0'; // Simplified for now
  }
}

// Add click outside to close modal
document.addEventListener('click', function(e) {
  const modal = document.getElementById('modal-overlay');
  if (e.target === modal) {
    closeModal();
  }
});

// Properties Panel Functions
function showTab(tabName) {
  console.log('🔄 Switching to tab:', tabName);
    
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
    
  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
    
  // Show selected tab
  const tabElement = document.getElementById(tabName + '-tab');
  const buttonElement = document.querySelector(`[onclick="showTab('${tabName}')"]`);
    
  if (tabElement) {
    tabElement.classList.add('active');
  } else {
    console.error('Tab element not found:', tabName + '-tab');
  }
    
  if (buttonElement) {
    buttonElement.classList.add('active');
  } else {
    console.error('Button element not found for tab:', tabName);
  }
    
  console.log('✅ Tab switched to:', tabName);
}

function showNodeProperties(node) {
  const noSelection = document.getElementById('no-selection');
  const nodeProperties = document.getElementById('node-properties');
    
  // Hide no selection, show properties
  noSelection.style.display = 'none';
  nodeProperties.style.display = 'block';
    
  // Update property header
  document.getElementById('property-icon').textContent = node.icon;
  document.getElementById('property-title').textContent = node.title;
  document.getElementById('property-type').textContent = node.type;
    
  // Update property values
  document.getElementById('prop-name').value = node.title;
  document.getElementById('prop-description').value = node.description;
  document.getElementById('prop-model').value = node.properties.model;
  document.getElementById('prop-temperature').value = node.properties.temperature;
  document.getElementById('temp-value').textContent = node.properties.temperature;
  document.getElementById('prop-max-tokens').value = node.properties.maxTokens;
  document.getElementById('prop-timeout').value = node.properties.timeout;
  document.getElementById('prop-retries').value = node.properties.retries;
  document.getElementById('prop-enabled').checked = node.properties.enabled;
  document.getElementById('prop-prompt').value = node.properties.prompt;
  document.getElementById('prop-env').value = node.properties.envVars;
    
  // Switch to properties tab
  showTab('properties');
    
  // Add temperature range listener
  const tempRange = document.getElementById('prop-temperature');
  tempRange.oninput = function() {
    document.getElementById('temp-value').textContent = this.value;
  };
}

function hideNodeProperties() {
  const noSelection = document.getElementById('no-selection');
  const nodeProperties = document.getElementById('node-properties');
    
  noSelection.style.display = 'block';
  nodeProperties.style.display = 'none';
}

function saveNodeProperties() {
  if (!selectedNode) return;
    
  // Update node properties
  selectedNode.title = document.getElementById('prop-name').value;
  selectedNode.description = document.getElementById('prop-description').value;
  selectedNode.properties.model = document.getElementById('prop-model').value;
  selectedNode.properties.temperature = parseFloat(document.getElementById('prop-temperature').value);
  selectedNode.properties.maxTokens = parseInt(document.getElementById('prop-max-tokens').value);
  selectedNode.properties.timeout = parseInt(document.getElementById('prop-timeout').value);
  selectedNode.properties.retries = parseInt(document.getElementById('prop-retries').value);
  selectedNode.properties.enabled = document.getElementById('prop-enabled').checked;
  selectedNode.properties.prompt = document.getElementById('prop-prompt').value;
  selectedNode.properties.envVars = document.getElementById('prop-env').value;
    
  // Redraw canvas to show updated title
  drawCanvas();
    
  updateStatus(`Properties saved for ${selectedNode.title}`, 'success');
  console.log('✅ Node properties saved:', selectedNode.title);
}

function resetNodeProperties() {
  if (!selectedNode) return;
    
  const config = nodeConfigs[selectedNode.type];
  if (config) {
    // Reset to default properties
    selectedNode.properties = { ...config.defaultProperties };
        
    // Update UI
    showNodeProperties(selectedNode);
        
    updateStatus(`Properties reset for ${selectedNode.title}`, 'info');
    console.log('🔄 Node properties reset:', selectedNode.title);
  }
}

function deleteNode() {
  if (!selectedNode) return;
    
  if (confirm(`Are you sure you want to delete "${selectedNode.title}"?`)) {
    // Remove node from array
    const index = nodes.indexOf(selectedNode);
    if (index > -1) {
      nodes.splice(index, 1);
    }
        
    // Clear selection
    selectedNode = null;
        
    // Hide properties panel
    hideNodeProperties();
        
    // Update UI
    updateNodeCount();
    drawCanvas();
    updateStatus('Node deleted', 'success');
        
    console.log('🗑️ Node deleted');
  }
}

// Custom Agent Functions
function showCustomAgentModal() {
  const modal = document.getElementById('custom-agent-modal');
  modal.classList.add('active');
    
  // Clear form
  document.getElementById('agent-name').value = '';
  document.getElementById('agent-description').value = '';
  document.getElementById('agent-icon').value = '🤖';
  document.getElementById('agent-model').value = 'gpt-4';
  document.getElementById('agent-prompt').value = '';
  document.getElementById('agent-env').value = '';
    
  // Focus on name field
  document.getElementById('agent-name').focus();
}

function closeCustomAgentModal() {
  const modal = document.getElementById('custom-agent-modal');
  modal.classList.remove('active');
}

function createCustomAgent() {
  const name = document.getElementById('agent-name').value.trim();
  const description = document.getElementById('agent-description').value.trim();
  const icon = document.getElementById('agent-icon').value.trim() || '🤖';
  const model = document.getElementById('agent-model').value;
  const prompt = document.getElementById('agent-prompt').value.trim();
  const envVars = document.getElementById('agent-env').value.trim();
    
  if (!name) {
    alert('Please enter an agent name');
    return;
  }
    
  if (!description) {
    alert('Please enter an agent description');
    return;
  }
    
  if (!prompt) {
    alert('Please enter a system prompt');
    return;
  }
    
  // Create custom agent ID
  const agentId = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
  // Add to nodeConfigs
  nodeConfigs[agentId] = {
    title: name,
    description: description,
    icon: icon,
    color: '#7877C6',
    gradient: 'linear-gradient(135deg, #7877C6 0%, #5B5A9A 100%)',
    category: 'Custom',
    defaultProperties: {
      model: model,
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 60,
      retries: 3,
      enabled: true,
      prompt: prompt,
      envVars: envVars
    }
  };
    
  // Add to custom agents list
  addCustomAgentToUI(agentId, name, description, icon);
    
  // Close modal
  closeCustomAgentModal();
    
  // Show success message
  updateStatus(`Custom agent "${name}" created successfully!`, 'success');
    
  console.log('✅ Custom agent created:', name);
}

function addCustomAgentToUI(agentId, name, description, icon) {
  const customAgentsList = document.getElementById('custom-agents-list');
    
  const agentElement = document.createElement('div');
  agentElement.className = 'node-type';
  agentElement.draggable = true;
  agentElement.dataset.nodeType = agentId;
    
  agentElement.innerHTML = `
        <div class="node-icon">${icon}</div>
        <div class="node-title">${name}</div>
        <div class="node-description">${description}</div>
        <div class="custom-agent-actions">
            <button class="btn-small btn-danger" onclick="deleteCustomAgent('${agentId}', this)" title="Delete Agent">🗑️</button>
        </div>
    `;
    
  customAgentsList.appendChild(agentElement);
}

function deleteCustomAgent(agentId, buttonElement) {
  const agentName = nodeConfigs[agentId].title;
    
  if (confirm(`Are you sure you want to delete the custom agent "${agentName}"?`)) {
    // Remove from nodeConfigs
    delete nodeConfigs[agentId];
        
    // Remove from UI
    const agentElement = buttonElement.closest('.node-type');
    agentElement.remove();
        
    updateStatus(`Custom agent "${agentName}" deleted`, 'info');
    console.log('🗑️ Custom agent deleted:', agentName);
  }
}

// Template Loading Functions
function loadTemplate(templateId) {
  const template = workflowTemplates[templateId];
  if (!template) {
    console.error('Template not found:', templateId);
    return;
  }
    
  // Clear current workflow
  nodes = [];
  selectedNode = null;
    
  // Create nodes from template
  template.nodes.forEach((nodeData, index) => {
    const config = nodeConfigs[nodeData.type];
    if (config) {
      const node = {
        id: 'node_' + Date.now() + '_' + index,
        type: nodeData.type,
        x: nodeData.x,
        y: nodeData.y,
        width: 200,
        height: 100,
        title: nodeData.title || config.title,
        description: config.description,
        icon: config.icon,
        color: config.color,
        gradient: config.gradient,
        selected: false,
        createdAt: new Date(),
        properties: { ...config.defaultProperties }
      };
            
      nodes.push(node);
    }
  });
    
  // Update UI
  updateNodeCount();
  drawCanvas();
  hideNodeProperties();
    
  // Switch to agents tab to show the loaded workflow
  showTab('agents');
    
  updateStatus(`Template "${template.name}" loaded successfully!`, 'success');
  console.log('✅ Template loaded:', template.name);
}

// Export functions for HTML onclick handlers
window.newWorkflow = newWorkflow;
window.openWorkflow = openWorkflow;
window.saveWorkflow = saveWorkflow;
window.runWorkflow = runWorkflow;
window.closeModal = closeModal;
window.confirmModal = confirmModal;
window.showTab = showTab;
window.saveNodeProperties = saveNodeProperties;
window.resetNodeProperties = resetNodeProperties;
window.deleteNode = deleteNode;
window.showCustomAgentModal = showCustomAgentModal;
window.closeCustomAgentModal = closeCustomAgentModal;
window.createCustomAgent = createCustomAgent;
window.deleteCustomAgent = deleteCustomAgent;
window.loadTemplate = loadTemplate;

console.log('🎉 LunaOS Futuristic Canvas System loaded successfully!');
