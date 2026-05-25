import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGenerator } from '../src/services/generator';

describe('CodeGenerator', () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  it('should generate React code', async () => {
    const result = await generator.generate('Create a button component', 'react');

    expect(result.framework).toBe('react');
    expect(result.code).toContain('React');
    expect(result.components).toHaveLength(1);
  });

  it('should generate Next.js code', async () => {
    const result = await generator.generate('Create a page with form', 'next');

    expect(result.framework).toBe('next');
    expect(result.code).toContain('Page');
  });

  it('should extract components from prompt', async () => {
    const result = await generator.generate(
      'Create a form with button and modal',
      'react'
    );

    expect(result.components).toContain('FormComponent');
    expect(result.components).toContain('ButtonComponent');
    expect(result.components).toContain('ModalComponent');
  });

  it('should determine dependencies for framework', async () => {
    const react = await generator.generate('Hello world', 'react');
    expect(react.dependencies).toContain('react');
    expect(react.dependencies).toContain('react-dom');

    const next = await generator.generate('Hello world', 'next');
    expect(next.dependencies).toContain('next');
  });

  it('should generate with default component', async () => {
    const result = await generator.generate('Generate something', 'react');

    expect(result.components).toContain('MainComponent');
  });

  it('should track generation time', async () => {
    const result = await generator.generate('Simple prompt', 'react');

    expect(result.estimatedTime).toBeGreaterThanOrEqual(1);
  });

  it('should store generated code', async () => {
    const generated = await generator.generate('Test code', 'express');

    const retrieved = generator.getGenerated(generated.id);

    expect(retrieved?.id).toBe(generated.id);
    expect(retrieved?.prompt).toBe('Test code');
  });

  it('should list all generated code', async () => {
    await generator.generate('Code 1', 'react');
    await generator.generate('Code 2', 'next');

    const all = generator.listGenerated();

    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('should delete generated code', async () => {
    const generated = await generator.generate('To delete', 'react');

    const deleted = generator.deleteGenerated(generated.id);

    expect(deleted).toBe(true);
    expect(generator.getGenerated(generated.id)).toBeUndefined();
  });

  it('should include framework-specific code', async () => {
    const react = await generator.generate('Create app', 'react');
    expect(react.code).toContain('import React');

    const express = await generator.generate('Create API', 'express');
    expect(express.code).toContain('express');
  });
});
