/**
 * Luna Pipe Language Parser
 *
 * Parses pipe expressions into an executable step list.
 * Handles: >>, ~~, ?>>. !>>, *N, try/catch/finally, comments
 */

export interface PipeStep {
  command: string;
  type: 'sequential' | 'parallel' | 'on-success' | 'on-failure';
  repeat?: number;
  children?: PipeStep[];
}

export interface ParsedPipe {
  steps: PipeStep[];
  hooks: { before?: string; after?: string };
}

const OPERATORS = ['>>', '~~', '?>>', '!>>'] as const;

export function parsePipe(expression: string): ParsedPipe {
  const hooks: ParsedPipe['hooks'] = {};
  let cleaned = expression
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .join(' ');

  // Extract hooks
  const beforeMatch = cleaned.match(/@before:(\w+)/);
  if (beforeMatch) {
    hooks.before = beforeMatch[1];
    cleaned = cleaned.replace(/@before:\w+/, '').trim();
  }
  const afterMatch = cleaned.match(/@after:(\w+)/);
  if (afterMatch) {
    hooks.after = afterMatch[1];
    cleaned = cleaned.replace(/@after:\w+/, '').trim();
  }

  const steps = parseExpression(cleaned);
  return { steps, hooks };
}

function parseExpression(expr: string): PipeStep[] {
  const steps: PipeStep[] = [];
  let current = expr.trim();

  while (current.length > 0) {
    // Handle try/catch/finally as single steps
    if (current.startsWith('try')) {
      const tryBlock = extractBlock(current, 'try');
      const step: PipeStep = { command: 'try', type: 'sequential', children: parseExpression(tryBlock.body) };
      steps.push(step);
      current = tryBlock.rest;
      if (current.startsWith('catch')) {
        const catchBlock = extractBlock(current, 'catch');
        steps.push({ command: 'catch', type: 'sequential', children: parseExpression(catchBlock.body) });
        current = catchBlock.rest;
      }
      if (current.startsWith('finally')) {
        const finallyBlock = extractBlock(current, 'finally');
        steps.push({ command: 'finally', type: 'sequential', children: parseExpression(finallyBlock.body) });
        current = finallyBlock.rest;
      }
      continue;
    }

    // Handle parallel groups: (a ~~ b ~~ c)
    if (current.startsWith('(')) {
      const close = findCloseParen(current);
      const inner = current.substring(1, close);
      const parallelCmds = inner.split('~~').map((c) => c.trim()).filter(Boolean);
      for (const cmd of parallelCmds) {
        steps.push({ command: cmd.replace(/[()]/g, '').trim(), type: 'parallel' });
      }
      current = current.substring(close + 1).trim();
      // consume next operator
      for (const op of OPERATORS) {
        if (current.startsWith(op)) {
          current = current.substring(op.length).trim();
          break;
        }
      }
      continue;
    }

    // Find next operator
    let nextOp: typeof OPERATORS[number] | null = null;
    let opIdx = current.length;
    for (const op of OPERATORS) {
      const idx = current.indexOf(op);
      if (idx >= 0 && idx < opIdx) {
        opIdx = idx;
        nextOp = op;
      }
    }

    const token = (nextOp ? current.substring(0, opIdx) : current).trim();
    current = nextOp ? current.substring(opIdx + nextOp.length).trim() : '';

    if (!token) continue;

    // Handle repeat: go *5
    const repeatMatch = token.match(/^(\w+)\s*\*(\d+)\??$/);
    const cmd = repeatMatch ? repeatMatch[1] : token;
    const repeat = repeatMatch ? parseInt(repeatMatch[2]) : undefined;

    const type = nextOp === '~~' ? 'parallel'
      : nextOp === '?>>' ? 'on-success'
      : nextOp === '!>>' ? 'on-failure'
      : 'sequential';

    steps.push({ command: cmd, type, repeat });
  }

  return steps;
}

function extractBlock(expr: string, keyword: string): { body: string; rest: string } {
  const start = expr.indexOf('(', keyword.length);
  if (start < 0) return { body: '', rest: expr.substring(keyword.length).trim() };
  const end = findCloseParen(expr.substring(start)) + start;
  return {
    body: expr.substring(start + 1, end),
    rest: expr.substring(end + 1).trim(),
  };
}

function findCloseParen(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    if (s[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return s.length - 1;
}
