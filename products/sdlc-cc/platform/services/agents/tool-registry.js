/**
 * Tool registry + invoker for LAM agents. Tools are pure async functions
 * with declared JSON-schema inputs/outputs so agent planners can compose
 * them safely without runtime surprises.
 *
 * Deliberately framework-free: no LangChain, no ADK. Agents own their own
 * runtime so we can upgrade model SDKs without cascading refactors.
 */

class ToolValidationError extends Error {
  constructor(toolName, detail) {
    super(`tool "${toolName}": ${detail}`);
    this.name = 'ToolValidationError';
    this.tool = toolName;
  }
}

class ToolNotFoundError extends Error {
  constructor(toolName) {
    super(`tool "${toolName}" not registered`);
    this.name = 'ToolNotFoundError';
    this.tool = toolName;
  }
}

class ToolRegistry {
  constructor({ timeoutMs = 10_000, maxRetries = 2 } = {}) {
    this.tools = new Map();
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.metrics = { calls: 0, successes: 0, failures: 0, retries: 0 };
  }

  /**
   * Register a tool. `schema.input` and `schema.output` follow minimal
   * JSON Schema — supports `type`, `required`, `properties`.
   */
  register({ name, description, schema, handler }) {
    if (!name) throw new ToolValidationError('<anonymous>', 'name required');
    if (typeof handler !== 'function') {
      throw new ToolValidationError(name, 'handler must be a function');
    }
    if (!schema || !schema.input) {
      throw new ToolValidationError(name, 'schema.input required');
    }
    if (this.tools.has(name)) {
      throw new ToolValidationError(name, 'already registered');
    }
    this.tools.set(name, { name, description: description || '', schema, handler });
  }

  list() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
    }));
  }

  has(name) {
    return this.tools.has(name);
  }

  /**
   * Validate `input` against `schema.input`. Returns the first error
   * message or null if valid.
   */
  validateInput(name, input) {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);
    return validateAgainstSchema(tool.schema.input, input);
  }

  /**
   * Invoke a tool with retry + timeout. Resolves with `{ ok, value, error }`.
   * Never throws — callers compose tools without try/catch littering.
   */
  async invoke(name, input, { context = {}, signal } = {}) {
    this.metrics.calls++;
    const tool = this.tools.get(name);
    if (!tool) {
      this.metrics.failures++;
      return { ok: false, error: new ToolNotFoundError(name) };
    }

    const inputErr = validateAgainstSchema(tool.schema.input, input);
    if (inputErr) {
      this.metrics.failures++;
      return { ok: false, error: new ToolValidationError(name, inputErr) };
    }

    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) this.metrics.retries++;
      try {
        const value = await runWithTimeout(
          tool.handler(input, context, signal),
          this.timeoutMs,
        );
        if (tool.schema.output) {
          const outErr = validateAgainstSchema(tool.schema.output, value);
          if (outErr) {
            lastError = new ToolValidationError(name, `output: ${outErr}`);
            break; // output shape is deterministic — retry won't help
          }
        }
        this.metrics.successes++;
        return { ok: true, value };
      } catch (err) {
        lastError = err;
        // AbortError is terminal — never retry
        if (err && err.name === 'AbortError') break;
      }
    }

    this.metrics.failures++;
    return { ok: false, error: lastError };
  }

  /**
   * Run a sequence of { tool, input } steps, piping each result into
   * `context.previous`. Short-circuits on first failure.
   *
   * Note: `context` is intentionally shared-mutable across steps so a
   * handler can publish a value (e.g. `ctx.correlationId = ...`) that
   * the next handler reads. Do not rely on this to enforce isolation
   * between steps — if you need hermetic context, clone before passing.
   */
  async chain(steps, { context = {}, signal } = {}) {
    const results = [];
    // Use a null-prototype object so a caller-supplied context object
    // with a polluted prototype chain cannot inject keys that look like
    // own properties to the shared-mutable handlers.
    const ctx = Object.assign(Object.create(null), context, { previous: null });
    for (const step of steps) {
      const res = await this.invoke(step.tool, step.input, { context: ctx, signal });
      results.push({ tool: step.tool, ...res });
      if (!res.ok) return { ok: false, results, error: res.error };
      ctx.previous = res.value;
    }
    return { ok: true, results, value: ctx.previous };
  }
}

/**
 * Minimal JSON-Schema validator. Handles the subset LAM tools need:
 *   type: object|string|number|integer|boolean|array
 *   required: [field...]
 *   properties: { field: { type, ... } }
 *   items: { type, ... }
 *
 * Not a full validator. The goal is fast feedback at the boundary; deep
 * spec compliance is provided by ajv in production builds if needed.
 */
function validateAgainstSchema(schema, value) {
  if (!schema) return null;
  if (value === undefined || value === null) {
    return schema.type ? `expected ${schema.type}, got ${value}` : null;
  }

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return `expected string, got ${typeof value}`;
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value))
        return `expected number, got ${typeof value}`;
      break;
    case 'integer':
      if (!Number.isInteger(value)) return `expected integer, got ${value}`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return `expected boolean, got ${typeof value}`;
      break;
    case 'array':
      if (!Array.isArray(value)) return `expected array, got ${typeof value}`;
      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const err = validateAgainstSchema(schema.items, value[i]);
          if (err) return `[${i}]: ${err}`;
        }
      }
      break;
    case 'object':
    case undefined:
      if (typeof value !== 'object' || Array.isArray(value))
        return `expected object, got ${Array.isArray(value) ? 'array' : typeof value}`;
      // Use hasOwn — the `in` operator walks the prototype chain, which lets a
      // caller pass `Object.create({ requiredField: 'bypass' })` and satisfy
      // the schema without actually providing the property.
      if (Array.isArray(schema.required)) {
        for (const k of schema.required) {
          if (!Object.prototype.hasOwnProperty.call(value, k)) {
            return `missing required field "${k}"`;
          }
        }
      }
      if (schema.properties) {
        for (const [k, sub] of Object.entries(schema.properties)) {
          if (Object.prototype.hasOwnProperty.call(value, k)) {
            const err = validateAgainstSchema(sub, value[k]);
            if (err) return `${k}: ${err}`;
          }
        }
      }
      break;
  }
  return null;
}

function runWithTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(`timeout after ${ms}ms`);
      err.name = 'TimeoutError';
      reject(err);
    }, ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

module.exports = {
  ToolRegistry,
  ToolValidationError,
  ToolNotFoundError,
  validateAgainstSchema,
};
