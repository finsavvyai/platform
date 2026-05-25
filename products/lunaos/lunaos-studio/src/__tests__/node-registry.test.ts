/**
 * Tests for the node type registry.
 */

import { getNodeTypes, getNodeTypeById, getNodeTypesByCategory } from '../lib/node-registry';

describe('node-registry', () => {
  test('getNodeTypes returns all registered nodes', () => {
    const types = getNodeTypes();
    expect(types.length).toBeGreaterThanOrEqual(9);
  });

  test('every node has required fields', () => {
    const types = getNodeTypes();
    for (const t of types) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(Array.isArray(t.inputs)).toBe(true);
      expect(Array.isArray(t.outputs)).toBe(true);
      expect(typeof t.configSchema).toBe('object');
    }
  });

  test('getNodeTypeById returns correct node', () => {
    const node = getNodeTypeById('chat-agent');
    expect(node).toBeDefined();
    expect(node?.name).toBe('Chat Agent');
    expect(node?.category).toBe('agent');
  });

  test('getNodeTypeById returns undefined for unknown id', () => {
    expect(getNodeTypeById('nonexistent')).toBeUndefined();
  });

  test('getNodeTypesByCategory filters correctly', () => {
    const triggers = getNodeTypesByCategory('trigger');
    expect(triggers.length).toBeGreaterThanOrEqual(2);
    for (const t of triggers) {
      expect(t.category).toBe('trigger');
    }
  });

  test('all four categories are represented', () => {
    const categories = new Set(getNodeTypes().map((n) => n.category));
    expect(categories.has('agent')).toBe(true);
    expect(categories.has('trigger')).toBe(true);
    expect(categories.has('condition')).toBe(true);
    expect(categories.has('output')).toBe(true);
  });

  test('configSchema has valid defaults for all fields', () => {
    const types = getNodeTypes();
    for (const t of types) {
      for (const [key, field] of Object.entries(t.configSchema)) {
        expect(field.default).toBeDefined();
        expect(typeof key).toBe('string');
        expect(['string', 'number', 'boolean', 'select', 'textarea'])
          .toContain(field.type);
      }
    }
  });
});
