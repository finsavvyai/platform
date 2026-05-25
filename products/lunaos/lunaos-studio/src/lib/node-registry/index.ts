import type { NodeTypeDefinition } from '../../types';
import { agentNodes } from './agent';
import { triggerNodes } from './trigger';
import { conditionNodes } from './condition';
import { outputNodes } from './output';
import { partnerNodes } from './partner';

const nodeRegistry: NodeTypeDefinition[] = [
  ...agentNodes,
  ...triggerNodes,
  ...conditionNodes,
  ...outputNodes,
  ...partnerNodes,
];

export function getNodeTypes(): NodeTypeDefinition[] {
  return nodeRegistry;
}

export function getNodeTypeById(id: string): NodeTypeDefinition | undefined {
  return nodeRegistry.find((n) => n.id === id);
}

export function getNodeTypesByCategory(category: string): NodeTypeDefinition[] {
  return nodeRegistry.filter((n) => n.category === category);
}
