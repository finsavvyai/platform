/**
 * API Routes for Cloudflare Workers
 * Provides edge API endpoints for UPM.Plus AutomationHub
 */

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import { z } from 'zod';

const apiRoutes = new Hono();

// Agent management endpoints
apiRoutes.get('/agents', async (c) => {
  try {
    // Get agents from cache or database
    const cacheKey = 'agents:list';
    const cached = await c.env.UPM_CACHE.get(cacheKey);

    if (cached) {
      const agents = JSON.parse(cached);
      return c.json({
        agents,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // Fetch from D1 database
    const agents = await c.env.UPM_DB.prepare(`
      SELECT id, name, type, status, capabilities, created_at, updated_at
      FROM agents
      WHERE status = 'active'
      ORDER BY created_at DESC
    `).all();

    // Cache for 5 minutes
    await c.env.UPM_CACHE.put(cacheKey, JSON.stringify(agents), {
      expirationTtl: 300
    });

    return c.json({
      agents: agents.results || [],
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to fetch agents',
      message: error.message
    }, 500);
  }
});

apiRoutes.get('/agents/:id', async (c) => {
  const agentId = c.req.param('id');

  try {
    const agent = await c.env.UPM_DB.prepare(`
      SELECT * FROM agents WHERE id = ?
    `).bind(agentId).first();

    if (!agent) {
      return c.json({
        error: 'Agent not found',
        agent_id: agentId
      }, 404);
    }

    // Get agent's recent tasks
    const recentTasks = await c.env.UPM_DB.prepare(`
      SELECT id, status, created_at, completed_at, execution_time
      FROM tasks
      WHERE agent_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(agentId).all();

    return c.json({
      agent,
      recent_tasks: recentTasks.results || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to fetch agent',
      message: error.message
    }, 500);
  }
});

// Create agent validation schema
const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['browser', 'infrastructure', 'conversational', 'data']),
  capabilities: z.array(z.string()).optional(),
  config: z.record(z.any()).optional()
});

apiRoutes.post('/agents', validator('json', createAgentSchema), async (c) => {
  const data = c.req.valid('json');

  try {
    const result = await c.env.UPM_DB.prepare(`
      INSERT INTO agents (name, type, capabilities, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).bind(
      data.name,
      data.type,
      JSON.stringify(data.capabilities || []),
      JSON.stringify(data.config || {}),
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    // Clear cache
    await c.env.UPM_CACHE.delete('agents:list');

    return c.json({
      success: true,
      agent_id: result.meta.last_row_id,
      message: 'Agent created successfully'
    }, 201);
  } catch (error) {
    return c.json({
      error: 'Failed to create agent',
      message: error.message
    }, 500);
  }
});

// Workflow management endpoints
apiRoutes.get('/workflows', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const workflows = await c.env.UPM_DB.prepare(`
      SELECT w.*, u.name as creator_name
      FROM workflows w
      LEFT JOIN users u ON w.creator_id = u.id
      ORDER BY w.updated_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const total = await c.env.UPM_DB.prepare(`
      SELECT COUNT(*) as count FROM workflows
    `).first();

    return c.json({
      workflows: workflows.results || [],
      pagination: {
        total: total?.count || 0,
        limit,
        offset,
        has_more: (offset + limit) < (total?.count || 0)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to fetch workflows',
      message: error.message
    }, 500);
  }
});

apiRoutes.get('/workflows/:id', async (c) => {
  const workflowId = c.req.param('id');

  try {
    const workflow = await c.env.UPM_DB.prepare(`
      SELECT w.*, u.name as creator_name
      FROM workflows w
      LEFT JOIN users u ON w.creator_id = u.id
      WHERE w.id = ?
    `).bind(workflowId).first();

    if (!workflow) {
      return c.json({
        error: 'Workflow not found',
        workflow_id: workflowId
      }, 404);
    }

    // Get workflow steps
    const steps = await c.env.UPM_DB.prepare(`
      SELECT * FROM workflow_steps
      WHERE workflow_id = ?
      ORDER BY step_order ASC
    `).bind(workflowId).all();

    // Get recent executions
    const executions = await c.env.UPM_DB.prepare(`
      SELECT id, status, started_at, completed_at, error_message
      FROM workflow_executions
      WHERE workflow_id = ?
      ORDER BY started_at DESC
      LIMIT 10
    `).bind(workflowId).all();

    return c.json({
      workflow,
      steps: steps.results || [],
      executions: executions.results || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to fetch workflow',
      message: error.message
    }, 500);
  }
});

// Execute workflow
apiRoutes.post('/workflows/:id/execute', async (c) => {
  const workflowId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  try {
    // Check if workflow exists and is active
    const workflow = await c.env.UPM_DB.prepare(`
      SELECT * FROM workflows WHERE id = ? AND status = 'active'
    `).bind(workflowId).first();

    if (!workflow) {
      return c.json({
        error: 'Workflow not found or inactive',
        workflow_id: workflowId
      }, 404);
    }

    // Create workflow execution record
    const executionResult = await c.env.UPM_DB.prepare(`
      INSERT INTO workflow_executions (
        workflow_id, status, input_data, started_at
      ) VALUES (?, ?, 'pending', ?)
    `).bind(
      workflowId,
      JSON.stringify(body.input_data || {}),
      new Date().toISOString()
    ).run();

    const executionId = executionResult.meta.last_row_id;

    // Queue the workflow execution
    await c.env.UPM_QUEUE.send({
      type: 'workflow_execution',
      data: {
        execution_id: executionId,
        workflow_id: workflowId,
        input_data: body.input_data || {},
        triggered_by: body.triggered_by || 'api'
      }
    });

    return c.json({
      success: true,
      execution_id: executionId,
      status: 'queued',
      message: 'Workflow execution queued successfully'
    }, 202);
  } catch (error) {
    return c.json({
      error: 'Failed to execute workflow',
      message: error.message
    }, 500);
  }
});

// Task management endpoints
apiRoutes.get('/tasks', async (c) => {
  const status = c.req.query('status');
  const agent_id = c.req.query('agent_id');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = `
      SELECT t.*, a.name as agent_name, w.name as workflow_name
      FROM tasks t
      LEFT JOIN agents a ON t.agent_id = a.id
      LEFT JOIN workflows w ON t.workflow_id = w.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (agent_id) {
      query += ' AND t.agent_id = ?';
      params.push(agent_id);
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const tasks = await c.env.UPM_DB.prepare(query).bind(...params).all();

    const total = await c.env.UPM_DB.prepare(`
      SELECT COUNT(*) as count FROM tasks t
      WHERE 1=1
      ${status ? 'AND t.status = ?' : ''}
      ${agent_id ? 'AND t.agent_id = ?' : ''}
    `).bind(...params.slice(0, -2)).first();

    return c.json({
      tasks: tasks.results || [],
      pagination: {
        total: total?.count || 0,
        limit,
        offset,
        has_more: (offset + limit) < (total?.count || 0)
      },
      filters: { status, agent_id },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to fetch tasks',
      message: error.message
    }, 500);
  }
});

apiRoutes.get('/tasks/:id', async (c) => {
  const taskId = c.req.param('id');

  try {
    const task = await c.env.UPM_DB.prepare(`
      SELECT t.*, a.name as agent_name, w.name as workflow_name
      FROM tasks t
      LEFT JOIN agents a ON t.agent_id = a.id
      LEFT JOIN workflows w ON t.workflow_id = w.id
      WHERE t.id = ?
    `).bind(taskId).first();

    if (!task) {
      return c.json({
        error: 'Task not found',
        task_id: taskId
      }, 404);
    }

    // Get task logs
    const logs = await c.env.UPM_DB.prepare(`
      SELECT * FROM task_logs
      WHERE task_id = ?
      ORDER BY created_at ASC
    `).bind(taskId).all();

    return c.json({
      task,
      logs: logs.results || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      error: 'Failed to fetch task',
      message: error.message
    }, 500);
  }
});

// Statistics endpoint
apiRoutes.get('/stats', async (c) => {
  try {
    const cacheKey = 'stats:overview';
    const cached = await c.env.UPM_CACHE.get(cacheKey);

    if (cached) {
      return c.json(JSON.parse(cached));
    }

    // Get various statistics
    const [
      totalAgents,
      activeAgents,
      totalWorkflows,
      totalTasks,
      completedTasks,
      failedTasks
    ] = await Promise.all([
      c.env.UPM_DB.prepare('SELECT COUNT(*) as count FROM agents').first(),
      c.env.UPM_DB.prepare('SELECT COUNT(*) as count FROM agents WHERE status = "active"').first(),
      c.env.UPM_DB.prepare('SELECT COUNT(*) as count FROM workflows').first(),
      c.env.UPM_DB.prepare('SELECT COUNT(*) as count FROM tasks').first(),
      c.env.UPM_DB.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = "completed"').first(),
      c.env.UPM_DB.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = "failed"').first()
    ]);

    const stats = {
      agents: {
        total: totalAgents?.count || 0,
        active: activeAgents?.count || 0
      },
      workflows: {
        total: totalWorkflows?.count || 0
      },
      tasks: {
        total: totalTasks?.count || 0,
        completed: completedTasks?.count || 0,
        failed: failedTasks?.count || 0,
        success_rate: totalTasks?.count ?
          Math.round((completedTasks?.count || 0) / totalTasks.count * 100) : 0
      },
      timestamp: new Date().toISOString()
    };

    // Cache for 5 minutes
    await c.env.UPM_CACHE.put(cacheKey, JSON.stringify(stats), {
      expirationTtl: 300
    });

    return c.json(stats);
  } catch (error) {
    return c.json({
      error: 'Failed to fetch statistics',
      message: error.message
    }, 500);
  }
});

export { apiRoutes };