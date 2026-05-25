import type { NodeTypeDefinition } from '../../types';

export const conditionNodes: NodeTypeDefinition[] = [
  {
    id: 'if-else',
    name: 'If / Else',
    category: 'condition',
    description: 'Branch based on a boolean condition',
    icon: 'arrow.triangle.branch',
    color: '#AF52DE',
    inputs: [{ name: 'input', type: 'any', required: true, description: 'Value to test' }],
    outputs: [
      { name: 'true', type: 'any', description: 'When condition is true' },
      { name: 'false', type: 'any', description: 'When condition is false' },
    ],
    configSchema: {
      expression: { type: 'textarea', default: 'return input > 0;', label: 'Condition' },
    },
  },
  {
    id: 'switch',
    name: 'Switch',
    category: 'condition',
    description: 'Route to multiple branches by value',
    icon: 'arrow.triangle.swap',
    color: '#BF5AF2',
    inputs: [{ name: 'input', type: 'any', required: true, description: 'Value to match' }],
    outputs: [
      { name: 'case1', type: 'any', description: 'Case 1' },
      { name: 'case2', type: 'any', description: 'Case 2' },
      { name: 'default', type: 'any', description: 'Default' },
    ],
    configSchema: {
      case1: { type: 'string', default: '', label: 'Case 1 Value' },
      case2: { type: 'string', default: '', label: 'Case 2 Value' },
    },
  },
];
