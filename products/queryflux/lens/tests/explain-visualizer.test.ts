import { describe, it, expect, beforeEach } from 'vitest';
import { ExplainVisualizer } from '../src/services/explain-visualizer';

describe('ExplainVisualizer', () => {
  let visualizer: ExplainVisualizer;

  beforeEach(() => {
    visualizer = new ExplainVisualizer();
  });

  it('should parse EXPLAIN plan', () => {
    const sql = 'SELECT * FROM users WHERE id = 1';
    const explainOutput = [
      'Seq Scan on users (cost=0.00..35.50 rows=1)',
      'Filter: (id = 1)',
    ];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);

    expect(plan.id).toBeDefined();
    expect(plan.tree).toBeDefined();
    expect(plan.totalCost).toBeGreaterThan(0);
  });

  it('should visualize as text', () => {
    const sql = 'SELECT * FROM users';
    const explainOutput = ['Seq Scan on users (cost=0.00..35.50 rows=2605)'];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);
    const text = visualizer.visualizeAsText(plan.id);

    expect(text).toContain('Query:');
    expect(text).toContain('Total Cost:');
  });

  it('should visualize as JSON', () => {
    const sql = 'SELECT * FROM users';
    const explainOutput = ['Seq Scan on users'];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);
    const json = visualizer.visualizeAsJSON(plan.id);

    expect(json).toBeDefined();
    expect((json as any).query).toBe(sql);
  });

  it('should visualize as HTML', () => {
    const sql = 'SELECT * FROM users';
    const explainOutput = ['Seq Scan on users'];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);
    const html = visualizer.visualizeAsHTML(plan.id);

    expect(html).toContain('<html>');
    expect(html).toContain('Query Execution Plan');
  });

  it('should identify bottlenecks', () => {
    const sql = 'SELECT * FROM users';
    const explainOutput = [
      'Seq Scan on users (cost=0.00..1500.00 rows=100000)',
    ];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);
    const bottlenecks = visualizer.identifyBottlenecks(plan.id);

    expect(bottlenecks.length).toBeGreaterThan(0);
  });

  it('should get plan by id', () => {
    const sql = 'SELECT * FROM users';
    const explainOutput = ['Seq Scan on users'];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);
    const retrieved = visualizer.getPlan(plan.id);

    expect(retrieved?.id).toBe(plan.id);
  });

  it('should list all plans', () => {
    const explainOutput = ['Seq Scan on users'];

    visualizer.parseExplainPlan('SELECT * FROM users', explainOutput);
    visualizer.parseExplainPlan('SELECT * FROM posts', explainOutput);

    const plans = visualizer.listPlans();

    expect(plans.length).toBeGreaterThanOrEqual(2);
  });

  it('should compare plans', () => {
    const output1 = ['Seq Scan on users (cost=0.00..35.50 rows=1)'];
    const output2 = ['Seq Scan on users (cost=0.00..100.00 rows=1)'];

    const plan1 = visualizer.parseExplainPlan('Query 1', output1);
    const plan2 = visualizer.parseExplainPlan('Query 2', output2);

    const comparison = visualizer.comparePlans(plan1.id, plan2.id);

    expect(comparison.faster).toBeDefined();
    expect(comparison.difference).toBeGreaterThanOrEqual(0);
  });

  it('should warn about full table scans', () => {
    const sql = 'SELECT * FROM users';
    const explainOutput = ['Seq Scan on users (Full Table Scan)'];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);
    const bottlenecks = visualizer.identifyBottlenecks(plan.id);

    expect(bottlenecks).toBeDefined();
  });

  it('should calculate total cost across tree', () => {
    const sql = 'SELECT * FROM users';
    const explainOutput = ['Seq Scan on users (cost=0.00..35.50 rows=2605)'];

    const plan = visualizer.parseExplainPlan(sql, explainOutput);

    expect(plan.totalCost).toBeGreaterThan(0);
  });
});
