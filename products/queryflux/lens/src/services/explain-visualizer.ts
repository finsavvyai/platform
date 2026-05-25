// Visualize EXPLAIN plans: parse, tree structure
export interface ExplainNode {
  operation: string;
  rows: number;
  cost: number;
  details: string;
  children: ExplainNode[];
}

export interface ExplainPlan {
  id: string;
  query: string;
  tree: ExplainNode;
  totalCost: number;
  timestamp: Date;
}

export class ExplainVisualizer {
  private plans: Map<string, ExplainPlan> = new Map();

  parseExplainPlan(query: string, explainOutput: string[]): ExplainPlan {
    const tree = this.buildTree(explainOutput);
    const totalCost = this.calculateTotalCost(tree);

    const plan: ExplainPlan = {
      id: `plan_${Date.now()}`,
      query,
      tree,
      totalCost,
      timestamp: new Date(),
    };

    this.plans.set(plan.id, plan);
    return plan;
  }

  private buildTree(lines: string[]): ExplainNode {
    // Simple tree builder (in production, use proper parsing)
    return {
      operation: lines[0] || 'Select',
      rows: this.extractNumber(lines, 'rows'),
      cost: this.extractNumber(lines, 'cost'),
      details: lines[0] || '',
      children: [],
    };
  }

  private extractNumber(lines: string[], keyword: string): number {
    const line = lines.find((l) => l.includes(keyword));
    const match = line?.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  private calculateTotalCost(node: ExplainNode): number {
    let total = node.cost;
    node.children.forEach((child) => {
      total += this.calculateTotalCost(child);
    });
    return total;
  }

  visualizeAsText(planId: string): string | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    let output = `Query: ${plan.query}\n`;
    output += `Total Cost: ${plan.totalCost}\n\n`;
    output += this.nodeToText(plan.tree, 0);

    return output;
  }

  private nodeToText(node: ExplainNode, depth: number): string {
    const indent = '  '.repeat(depth);
    let output = `${indent}${node.operation}\n`;
    output += `${indent}  Rows: ${node.rows}, Cost: ${node.cost}\n`;

    node.children.forEach((child) => {
      output += this.nodeToText(child, depth + 1);
    });

    return output;
  }

  visualizeAsJSON(planId: string): object | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    return {
      query: plan.query,
      totalCost: plan.totalCost,
      tree: this.nodeToJSON(plan.tree),
    };
  }

  private nodeToJSON(node: ExplainNode): object {
    return {
      operation: node.operation,
      rows: node.rows,
      cost: node.cost,
      details: node.details,
      children: node.children.map((child) => this.nodeToJSON(child)),
    };
  }

  visualizeAsHTML(planId: string): string | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    return `
<html>
<head>
  <style>
    .tree { font-family: monospace; margin: 20px; }
    .node { margin: 5px 0; padding: 5px; border-left: 2px solid #ccc; }
    .op { font-weight: bold; }
  </style>
</head>
<body>
  <div class="tree">
    <h2>Query Execution Plan</h2>
    <p>Total Cost: ${plan.totalCost}</p>
    ${this.nodeToHTML(plan.tree, 0)}
  </div>
</body>
</html>`;
  }

  private nodeToHTML(node: ExplainNode, depth: number): string {
    const style = `margin-left: ${depth * 20}px`;
    let html = `<div class="node" style="${style}">`;
    html += `<div class="op">${node.operation}</div>`;
    html += `<small>Rows: ${node.rows}, Cost: ${node.cost}</small>`;

    node.children.forEach((child) => {
      html += this.nodeToHTML(child, depth + 1);
    });

    html += '</div>';
    return html;
  }

  identifyBottlenecks(planId: string): string[] {
    const plan = this.plans.get(planId);
    if (!plan) return [];

    const issues: string[] = [];

    if (plan.totalCost > 1000) {
      issues.push('High total cost detected; consider adding indexes');
    }

    if (plan.tree.rows > 10000) {
      issues.push('Large number of rows; consider LIMIT or WHERE clause');
    }

    if (plan.tree.operation.includes('FullTableScan')) {
      issues.push('Full table scan detected; missing index?');
    }

    return issues;
  }

  getPlan(id: string): ExplainPlan | undefined {
    return this.plans.get(id);
  }

  listPlans(): ExplainPlan[] {
    return Array.from(this.plans.values());
  }

  comparePlans(id1: string, id2: string): { faster: string; difference: number } {
    const plan1 = this.plans.get(id1);
    const plan2 = this.plans.get(id2);

    if (!plan1 || !plan2) return { faster: 'unknown', difference: 0 };

    const faster = plan1.totalCost < plan2.totalCost ? 'first' : 'second';
    const difference = Math.abs(plan1.totalCost - plan2.totalCost);

    return { faster, difference };
  }
}
