/**
 * Workflow Node Types Definition
 *
 * Defines all available node types, their configurations, and validation rules
 * for the Visual Workflow Designer.
 */

export interface WorkflowNodeConfig {
  id: string;
  type: string;
  label: string;
  description: string;
  category: NodeCategory;
  icon: string;
  color: string;
  backgroundColor: string;
  inputs: NodePort[];
  outputs: NodePort[];
  configSchema: NodeConfigSchema;
  defaultConfig: Record<string, any>;
  documentation?: string;
  examples?: NodeExample[];
}

export enum NodeCategory {
  TRIGGER = 'trigger',
  AGENT = 'agent',
  ACTION = 'action',
  CONTROL = 'control',
  DATA = 'data',
  INTEGRATION = 'integration',
  UTILITY = 'utility'
}

export interface NodePort {
  id: string;
  name: string;
  type: 'data' | 'flow' | 'error' | 'condition';
  dataType?: string;
  required?: boolean;
  description?: string;
}

export interface NodeConfigSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface NodeExample {
  name: string;
  description: string;
  config: Record<string, any>;
}

// Node Type Definitions
export const WORKFLOW_NODE_TYPES: Record<string, WorkflowNodeConfig> = {
  // Trigger Nodes
  'manual-trigger': {
    id: 'manual-trigger',
    type: 'manual-trigger',
    label: 'Manual Trigger',
    description: 'Start workflow manually',
    category: NodeCategory.TRIGGER,
    icon: 'PlayArrow',
    color: '#4caf50',
    backgroundColor: '#e8f5e8',
    inputs: [],
    outputs: [
      { id: 'trigger', name: 'Trigger', type: 'flow' }
    ],
    configSchema: {
      type: 'object',
      properties: {}
    },
    defaultConfig: {}
  },

  'webhook-trigger': {
    id: 'webhook-trigger',
    type: 'webhook-trigger',
    label: 'Webhook',
    description: 'Trigger workflow via HTTP webhook',
    category: NodeCategory.TRIGGER,
    icon: 'Http',
    color: '#2196f3',
    backgroundColor: '#e3f2fd',
    inputs: [],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' },
      { id: 'error', name: 'Error', type: 'error' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', title: 'Endpoint Path' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'POST' },
        authentication: { type: 'string', enum: ['none', 'api_key', 'oauth'], default: 'none' }
      },
      required: ['endpoint']
    },
    defaultConfig: {
      endpoint: '/webhook',
      method: 'POST',
      authentication: 'none'
    }
  },

  'schedule-trigger': {
    id: 'schedule-trigger',
    type: 'schedule-trigger',
    label: 'Schedule',
    description: 'Trigger workflow on schedule',
    category: NodeCategory.TRIGGER,
    icon: 'Schedule',
    color: '#ff9800',
    backgroundColor: '#fff3e0',
    inputs: [],
    outputs: [
      { id: 'trigger', name: 'Trigger', type: 'flow' },
      { id: 'error', name: 'Error', type: 'error' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        schedule: { type: 'string', title: 'Cron Expression', description: 'e.g., 0 */6 * * * (every 6 hours)' },
        timezone: { type: 'string', title: 'Timezone', default: 'UTC' }
      },
      required: ['schedule']
    },
    defaultConfig: {
      schedule: '0 */6 * * *',
      timezone: 'UTC'
    }
  },

  // Agent Nodes
  'browser-automation': {
    id: 'browser-automation',
    type: 'browser-automation',
    label: 'Browser Automation',
    description: 'Automate browser tasks and web interactions',
    category: NodeCategory.AGENT,
    icon: 'Computer',
    color: '#795548',
    backgroundColor: '#efebe9',
    inputs: [
      { id: 'input', name: 'Input Data', type: 'data', dataType: 'object' },
      { id: 'flow', name: 'Flow', type: 'flow' }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' },
      { id: 'error', name: 'Error', type: 'error' },
      { id: 'result', name: 'Result', type: 'data', dataType: 'object' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        task_type: { type: 'string', enum: ['scrape', 'form_fill', 'click', 'navigate', 'extract'], title: 'Task Type' },
        url: { type: 'string', title: 'Target URL' },
        selector: { type: 'string', title: 'CSS Selector' },
        actions: { type: 'array', title: 'Actions List', items: { type: 'object' } },
        timeout: { type: 'number', title: 'Timeout (seconds)', default: 30 }
      },
      required: ['task_type']
    },
    defaultConfig: {
      task_type: 'navigate',
      url: '',
      selector: '',
      actions: [],
      timeout: 30
    }
  },

  'data-processor': {
    id: 'data-processor',
    type: 'data-processor',
    label: 'Data Processor',
    description: 'Process and transform data using AI',
    category: NodeCategory.AGENT,
    icon: 'Memory',
    color: '#9c27b0',
    backgroundColor: '#f3e5f5',
    inputs: [
      { id: 'data', name: 'Input Data', type: 'data', dataType: 'any' },
      { id: 'flow', name: 'Flow', type: 'flow' }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' },
      { id: 'error', name: 'Error', type: 'error' },
      { id: 'processed_data', name: 'Processed Data', type: 'data', dataType: 'any' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['extract', 'transform', 'analyze', 'summarize', 'validate'], title: 'Operation' },
        prompt: { type: 'string', title: 'Processing Prompt', multiline: true },
        output_format: { type: 'string', enum: ['json', 'text', 'structured'], default: 'json' }
      },
      required: ['operation', 'prompt']
    },
    defaultConfig: {
      operation: 'extract',
      prompt: '',
      output_format: 'json'
    }
  },

  // Action Nodes
  'http-request': {
    id: 'http-request',
    type: 'http-request',
    label: 'HTTP Request',
    description: 'Make HTTP requests to external APIs',
    category: NodeCategory.ACTION,
    icon: 'Http',
    color: '#f44336',
    backgroundColor: '#ffebee',
    inputs: [
      { id: 'flow', name: 'Flow', type: 'flow' },
      { id: 'data', name: 'Request Data', type: 'data', dataType: 'object' }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' },
      { id: 'error', name: 'Error', type: 'error' },
      { id: 'response', name: 'Response', type: 'data', dataType: 'object' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
        url: { type: 'string', title: 'URL' },
        headers: { type: 'object', title: 'Headers' },
        body: { type: 'object', title: 'Request Body' },
        authentication: { type: 'string', enum: ['none', 'bearer', 'basic'], default: 'none' },
        timeout: { type: 'number', title: 'Timeout (seconds)', default: 30 }
      },
      required: ['url']
    },
    defaultConfig: {
      method: 'GET',
      url: '',
      headers: {},
      body: {},
      authentication: 'none',
      timeout: 30
    }
  },

  'send-email': {
    id: 'send-email',
    type: 'send-email',
    label: 'Send Email',
    description: 'Send email notifications',
    category: NodeCategory.ACTION,
    icon: 'Email',
    color: '#2196f3',
    backgroundColor: '#e3f2fd',
    inputs: [
      { id: 'flow', name: 'Flow', type: 'flow' },
      { id: 'data', name: 'Email Data', type: 'data', dataType: 'object' }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' },
      { id: 'error', name: 'Error', type: 'error' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        to: { type: 'array', title: 'Recipients', items: { type: 'string' } },
        cc: { type: 'array', title: 'CC Recipients', items: { type: 'string' } },
        subject: { type: 'string', title: 'Subject' },
        template: { type: 'string', title: 'Email Template' },
        variables: { type: 'object', title: 'Template Variables' }
      },
      required: ['to', 'subject']
    },
    defaultConfig: {
      to: [],
      cc: [],
      subject: '',
      template: '',
      variables: {}
    }
  },

  // Control Flow Nodes
  'condition': {
    id: 'condition',
    type: 'condition',
    label: 'Condition',
    description: 'Conditional logic branching',
    category: NodeCategory.CONTROL,
    icon: 'CallSplit',
    color: '#ff9800',
    backgroundColor: '#fff3e0',
    inputs: [
      { id: 'flow', name: 'Flow', type: 'flow' },
      { id: 'data', name: 'Data', type: 'data', dataType: 'any' }
    ],
    outputs: [
      { id: 'true', name: 'True', type: 'flow' },
      { id: 'false', name: 'False', type: 'flow' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        condition: { type: 'string', title: 'Condition', description: 'JavaScript expression' },
        operator: { type: 'string', enum: ['equals', 'not_equals', 'greater', 'less', 'contains', 'regex'], title: 'Operator' },
        left_operand: { type: 'string', title: 'Left Operand' },
        right_operand: { type: 'string', title: 'Right Operand' }
      },
      required: ['condition']
    },
    defaultConfig: {
      condition: 'true',
      operator: 'equals',
      left_operand: '',
      right_operand: ''
    }
  },

  'delay': {
    id: 'delay',
    type: 'delay',
    label: 'Delay',
    description: 'Wait for specified time',
    category: NodeCategory.CONTROL,
    icon: 'Timer',
    color: '#607d8b',
    backgroundColor: '#eceff1',
    inputs: [
      { id: 'flow', name: 'Flow', type: 'flow' }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        delay_type: { type: 'string', enum: ['seconds', 'minutes', 'hours', 'days'], default: 'seconds' },
        delay_value: { type: 'number', title: 'Delay Value', default: 1 }
      },
      required: ['delay_value']
    },
    defaultConfig: {
      delay_type: 'seconds',
      delay_value: 1
    }
  },

  'parallel': {
    id: 'parallel',
    type: 'parallel',
    label: 'Parallel Execution',
    description: 'Execute multiple branches in parallel',
    category: NodeCategory.CONTROL,
    icon: 'CallSplit',
    color: '#00bcd4',
    backgroundColor: '#e0f7fa',
    inputs: [
      { id: 'flow', name: 'Flow', type: 'flow' },
      { id: 'data', name: 'Input Data', type: 'data', dataType: 'any' }
    ],
    outputs: [
      { id: 'branch_1', name: 'Branch 1', type: 'flow' },
      { id: 'branch_2', name: 'Branch 2', type: 'flow' },
      { id: 'branch_3', name: 'Branch 3', type: 'flow' },
      { id: 'completed', name: 'Completed', type: 'flow' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        branches: { type: 'number', title: 'Number of Branches', default: 2, minimum: 1, maximum: 5 },
        wait_for_all: { type: 'boolean', title: 'Wait for All Branches', default: true }
      }
    },
    defaultConfig: {
      branches: 2,
      wait_for_all: true
    }
  },

  // Data Nodes
  'data-input': {
    id: 'data-input',
    type: 'data-input',
    label: 'Data Input',
    description: 'Input data into workflow',
    category: NodeCategory.DATA,
    icon: 'Input',
    color: '#3f51b5',
    backgroundColor: '#e8eaf6',
    inputs: [],
    outputs: [
      { id: 'flow', name: 'Flow', type: 'flow' },
      { id: 'data', name: 'Data', type: 'data', dataType: 'any' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        data_type: { type: 'string', enum: ['string', 'number', 'boolean', 'object', 'array'], default: 'string' },
        default_value: { type: 'any', title: 'Default Value' },
        description: { type: 'string', title: 'Description' }
      }
    },
    defaultConfig: {
      data_type: 'string',
      default_value: '',
      description: ''
    }
  },

  'data-output': {
    id: 'data-output',
    type: 'data-output',
    label: 'Data Output',
    description: 'Output data from workflow',
    category: NodeCategory.DATA,
    icon: 'Output',
    color: '#4caf50',
    backgroundColor: '#e8f5e8',
    inputs: [
      { id: 'flow', name: 'Flow', type: 'flow' },
      { id: 'data', name: 'Data', type: 'data', dataType: 'any' }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        output_name: { type: 'string', title: 'Output Name' },
        save_to_context: { type: 'boolean', title: 'Save to Context', default: true }
      }
    },
    defaultConfig: {
      output_name: 'result',
      save_to_context: true
    }
  },

  'data-transform': {
    id: 'data-transform',
    type: 'data-transform',
    label: 'Data Transform',
    description: 'Transform data structure',
    category: NodeCategory.DATA,
    icon: 'Transform',
    color: '#795548',
    backgroundColor: '#efebe9',
    inputs: [
      { id: 'flow', name: 'Flow', type: 'flow' },
      { id: 'data', name: 'Input Data', type: 'data', dataType: 'any' }
    ],
    outputs: [
      { id: 'success', name: 'Success', type: 'flow' },
      { id: 'transformed', name: 'Transformed Data', type: 'data', dataType: 'any' }
    ],
    configSchema: {
      type: 'object',
      properties: {
        transform_type: { type: 'string', enum: ['javascript', 'mapping', 'filter', 'aggregate'], default: 'javascript' },
        script: { type: 'string', title: 'Transform Script', multiline: true },
        mapping: { type: 'object', title: 'Field Mapping' }
      },
      required: ['transform_type']
    },
    defaultConfig: {
      transform_type: 'javascript',
      script: 'return data;',
      mapping: {}
    }
  }
};

// Helper functions
export const getNodeTypesByCategory = (category: NodeCategory): WorkflowNodeConfig[] => {
  return Object.values(WORKFLOW_NODE_TYPES).filter(node => node.category === category);
};

export const getNodeById = (id: string): WorkflowNodeConfig | undefined => {
  return WORKFLOW_NODE_TYPES[id];
};

export const validateNodeConfig = (nodeType: string, config: Record<string, any>): { isValid: boolean; errors: string[] } => {
  const nodeDefinition = getNodeById(nodeType);
  if (!nodeDefinition) {
    return { isValid: false, errors: [`Unknown node type: ${nodeType}`] };
  }

  const errors: string[] = [];
  const schema = nodeDefinition.configSchema;
  const required = schema.required || [];

  // Check required fields
  for (const field of required) {
    if (!(field in config) || config[field] === undefined || config[field] === null || config[field] === '') {
      errors.push(`Required field '${field}' is missing`);
    }
  }

  // Type validation (basic)
  for (const [field, fieldSchema] of Object.entries(schema.properties)) {
    if (field in config && config[field] !== undefined) {
      const expectedType = (fieldSchema as any).type;
      const actualValue = config[field];

      if (expectedType === 'string' && typeof actualValue !== 'string') {
        errors.push(`Field '${field}' must be a string`);
      } else if (expectedType === 'number' && typeof actualValue !== 'number') {
        errors.push(`Field '${field}' must be a number`);
      } else if (expectedType === 'boolean' && typeof actualValue !== 'boolean') {
        errors.push(`Field '${field}' must be a boolean`);
      } else if (expectedType === 'array' && !Array.isArray(actualValue)) {
        errors.push(`Field '${field}' must be an array`);
      } else if (expectedType === 'object' && (typeof actualValue !== 'object' || Array.isArray(actualValue))) {
        errors.push(`Field '${field}' must be an object`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
};