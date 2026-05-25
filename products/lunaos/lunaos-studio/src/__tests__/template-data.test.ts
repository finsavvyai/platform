/**
 * Tests for the template library data.
 */

import { templates, getTemplateById, getTemplatesByCategory } from '../lib/template-data';

describe('template-data', () => {
  test('has at least 5 starter templates', () => {
    expect(templates.length).toBeGreaterThanOrEqual(5);
  });

  test('includes the Insights → Code showcase template', () => {
    expect(templates.find((t) => t.id === 'insights-to-code')).toBeDefined();
  });

  test('every template has required fields', () => {
    for (const t of templates) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(['beginner', 'intermediate', 'advanced']).toContain(t.difficulty);
      expect(t.tags.length).toBeGreaterThan(0);
      expect(t.nodes.length).toBeGreaterThan(0);
      expect(t.preview).toBeTruthy();
    }
  });

  test('every template node has valid data', () => {
    for (const t of templates) {
      for (const n of t.nodes) {
        expect(n.id).toBeTruthy();
        expect(n.position).toBeDefined();
        expect(n.position.x).toEqual(expect.any(Number));
        expect(n.position.y).toEqual(expect.any(Number));
        expect(n.data.typeId).toBeTruthy();
        expect(n.data.label).toBeTruthy();
        expect(n.data.category).toBeTruthy();
      }
    }
  });

  test('template edges reference existing nodes', () => {
    for (const t of templates) {
      const nodeIds = new Set(t.nodes.map((n) => n.id));
      for (const e of t.edges) {
        expect(nodeIds.has(e.source)).toBe(true);
        expect(nodeIds.has(e.target)).toBe(true);
      }
    }
  });

  test('getTemplateById returns correct template', () => {
    const t = getTemplateById('customer-support');
    expect(t).toBeDefined();
    expect(t?.name).toBe('Customer Support Bot');
  });

  test('getTemplateById returns undefined for unknown id', () => {
    expect(getTemplateById('nonexistent')).toBeUndefined();
  });

  test('getTemplatesByCategory filters correctly', () => {
    const ai = getTemplatesByCategory('AI');
    expect(ai.length).toBeGreaterThanOrEqual(1);
    for (const t of ai) {
      expect(t.category).toBe('AI');
    }
  });

  test('all template ids are unique', () => {
    const ids = templates.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
