import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateEngine } from '../src/services/template-engine';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  it('should have default templates', () => {
    const templates = engine.listTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('should get template by id', () => {
    const templates = engine.listTemplates();
    const first = templates[0];

    const retrieved = engine.getTemplate(first.id);

    expect(retrieved?.id).toBe(first.id);
  });

  it('should get templates by type', () => {
    const reactTemplates = engine.getTemplatesByType('react-component');
    expect(reactTemplates.length).toBeGreaterThan(0);
  });

  it('should add custom template', () => {
    const template = engine.addTemplate(
      'react-form',
      'Custom Form',
      'const Form = () => <form>{INPUTS}</form>;'
    );

    expect(template.name).toBe('Custom Form');
    expect(template.variables).toContain('INPUTS');
  });

  it('should render template with variables', () => {
    const templates = engine.listTemplates();
    const template = templates.find((t) => t.type === 'react-component');

    if (!template) return;

    const rendered = engine.render(template.id, {
      COMPONENT_NAME: 'Button',
      PROPS: 'onClick',
    });

    expect(rendered).toContain('Button');
    expect(rendered).toContain('onClick');
  });

  it('should extract variables from template', () => {
    const template = engine.addTemplate(
      'react-form',
      'Test',
      'const {NAME} = () => <div>{CONTENT}</div>;'
    );

    expect(template.variables).toContain('NAME');
    expect(template.variables).toContain('CONTENT');
  });

  it('should validate required variables', () => {
    const templates = engine.listTemplates();
    const template = templates[0];

    const missing = engine.validateVariables(template.id, {});

    expect(missing.length).toBeGreaterThan(0);
  });

  it('should return empty array for provided variables', () => {
    const template = engine.addTemplate(
      'test',
      'Test',
      'const {VAR1} = {VAR2};'
    );

    const missing = engine.validateVariables(template.id, {
      VAR1: 'value1',
      VAR2: 'value2',
    });

    expect(missing).toHaveLength(0);
  });

  it('should delete template', () => {
    const templates = engine.listTemplates();
    const first = templates[0];

    const deleted = engine.deleteTemplate(first.id);

    expect(deleted).toBe(true);
    expect(engine.getTemplate(first.id)).toBeUndefined();
  });

  it('should clone template', () => {
    const templates = engine.listTemplates();
    const original = templates[0];

    const cloned = engine.cloneTemplate(original.id, 'Cloned Template');

    expect(cloned?.name).toBe('Cloned Template');
    expect(cloned?.type).toBe(original.type);
    expect(cloned?.content).toBe(original.content);
  });

  it('should render multiple templates', () => {
    const t1 = engine.addTemplate('test', 'T1', 'const {NAME} = 1;');
    const t2 = engine.addTemplate('test', 'T2', 'const {ID} = 2;');

    const r1 = engine.render(t1.id, { NAME: 'test' });
    const r2 = engine.render(t2.id, { ID: '123' });

    expect(r1).toContain('test');
    expect(r2).toContain('123');
  });
});
