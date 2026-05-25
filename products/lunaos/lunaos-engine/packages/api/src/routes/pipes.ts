/**
 * Pipes Route — execute Luna pipe expressions
 *
 * POST /pipes/execute — parse and run a Luna pipe expression
 * GET  /pipes/commands — list all available pipe commands
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuthOrApiKey } from '../middleware/api-key-auth';
import { executePipe } from '../services/pipe-executor';

export const pipeRoutes = new Hono<{ Bindings: Env }>();

pipeRoutes.post('/execute', requireAuthOrApiKey, async (c) => {
  const userId = c.get('userId');
  const userTier = c.get('userTier') || 'free';

  const body = await c.req.json<{ expression: string }>();

  if (!body.expression?.trim()) {
    return c.json({ error: 'expression is required' }, 400);
  }

  if (body.expression.length > 2000) {
    return c.json({ error: 'Expression too long (max 2000 chars)' }, 400);
  }

  try {
    const result = await executePipe(body.expression, userId, userTier, c.env);
    return c.json({ data: result });
  } catch (err: any) {
    return c.json({ error: `Pipe execution failed: ${err.message}` }, 500);
  }
});

pipeRoutes.get('/commands', async (c) => {
  return c.json({
    data: {
      workflow: ['req', 'des', 'plan', 'go', 'rev', 'test', 'ship', 'watch', 'retro'],
      autopilot: ['feature', 'parallel', 'fix', 'debug', 'refactor', 'pr'],
      quality: ['rules', 'perf', 'a11y', 'deps', 'mock', 'storybook'],
      codegen: ['auth', 'brand', 'api-client', 'migrate', 'i18n', 'ci', 'changelog'],
      devops: ['env', 'rollback', 'dock', 'cf', 'sec'],
      ai: ['nexa', 'lam', 'oh', 'chain', 'vision', 'search', 'q'],
      tools: ['hig', 'ui', 'docs', 'cfg'],
      operators: {
        flow: ['>>', '~~', '()', '?>>', '!>>'],
        loops: ['*N', '*N?', '*N!', '*?'],
        hooks: ['@before:CMD', '@after:CMD', '@each:CMD'],
        variables: ['$name = CMD', '$name', '$CMD.field'],
        conditionals: ['if COND >> CMD', 'else >> CMD', 'match VAR'],
        errorHandling: ['try ()', 'catch ()', 'finally ()'],
        assertions: ['assert COND', 'approve "MSG"'],
        context: ['with scope:NAME', 'with model:NAME'],
        multiRepo: ['in REPO ()'],
        mapReduce: ['map [] >> CMD', 'reduce CMD'],
        events: ['watch PATH >> CMD', 'on EVENT >> CMD'],
        timing: ['timeout Nm CMD', 'retry N CMD'],
        snapshots: ['snapshot', 'diff'],
        workflows: ['def NAME = PIPE', 'run NAME', 'import NAME'],
        logging: ['log "MSG"'],
      },
    },
  });
});
