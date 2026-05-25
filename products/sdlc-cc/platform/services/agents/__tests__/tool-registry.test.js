const {
  ToolRegistry,
  ToolNotFoundError,
  ToolValidationError,
  validateAgainstSchema,
} = require('../tool-registry');

describe('ToolRegistry.register', () => {
  it('rejects missing name', () => {
    const r = new ToolRegistry();
    expect(() =>
      r.register({ schema: { input: {} }, handler: async () => null }),
    ).toThrow(ToolValidationError);
  });

  it('rejects missing handler', () => {
    const r = new ToolRegistry();
    expect(() => r.register({ name: 'x', schema: { input: {} } })).toThrow(
      ToolValidationError,
    );
  });

  it('rejects missing schema.input', () => {
    const r = new ToolRegistry();
    expect(() =>
      r.register({ name: 'x', handler: async () => null }),
    ).toThrow(ToolValidationError);
  });

  it('rejects duplicate names', () => {
    const r = new ToolRegistry();
    const def = {
      name: 'echo',
      schema: { input: { type: 'object' } },
      handler: async (x) => x,
    };
    r.register(def);
    expect(() => r.register(def)).toThrow(ToolValidationError);
  });

  it('list returns registered tools', () => {
    const r = new ToolRegistry();
    r.register({
      name: 'echo',
      description: 'echo',
      schema: { input: { type: 'object' } },
      handler: async (x) => x,
    });
    const list = r.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('echo');
  });
});

describe('ToolRegistry.invoke', () => {
  function mkEcho({ maxRetries = 2 } = {}) {
    const r = new ToolRegistry({ maxRetries, timeoutMs: 100 });
    r.register({
      name: 'echo',
      schema: {
        input: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } },
        output: { type: 'object', required: ['text'] },
      },
      handler: async (input) => ({ text: input.text }),
    });
    return r;
  }

  it('returns ok on success', async () => {
    const r = mkEcho();
    const res = await r.invoke('echo', { text: 'hi' });
    expect(res.ok).toBe(true);
    expect(res.value).toEqual({ text: 'hi' });
    expect(r.metrics.successes).toBe(1);
  });

  it('returns ToolNotFoundError when tool missing', async () => {
    const r = new ToolRegistry();
    const res = await r.invoke('ghost', {});
    expect(res.ok).toBe(false);
    expect(res.error).toBeInstanceOf(ToolNotFoundError);
  });

  it('rejects invalid input against schema', async () => {
    const r = mkEcho();
    const res = await r.invoke('echo', { text: 123 });
    expect(res.ok).toBe(false);
    expect(res.error).toBeInstanceOf(ToolValidationError);
    expect(String(res.error.message)).toMatch(/text/);
  });

  it('retries up to maxRetries on transient failure', async () => {
    const r = new ToolRegistry({ maxRetries: 2, timeoutMs: 200 });
    let calls = 0;
    r.register({
      name: 'flaky',
      schema: { input: { type: 'object' } },
      handler: async () => {
        calls++;
        if (calls < 3) throw new Error('transient');
        return { ok: true };
      },
    });
    const res = await r.invoke('flaky', {});
    expect(res.ok).toBe(true);
    expect(calls).toBe(3);
    expect(r.metrics.retries).toBe(2);
  });

  it('fails after exhausting retries', async () => {
    const r = new ToolRegistry({ maxRetries: 1, timeoutMs: 200 });
    r.register({
      name: 'dead',
      schema: { input: { type: 'object' } },
      handler: async () => {
        throw new Error('never works');
      },
    });
    const res = await r.invoke('dead', {});
    expect(res.ok).toBe(false);
    expect(res.error.message).toBe('never works');
    expect(r.metrics.failures).toBe(1);
  });

  it('times out slow handlers', async () => {
    const r = new ToolRegistry({ maxRetries: 0, timeoutMs: 50 });
    r.register({
      name: 'slow',
      schema: { input: { type: 'object' } },
      handler: () => new Promise((resolve) => setTimeout(() => resolve({}), 500)),
    });
    const res = await r.invoke('slow', {});
    expect(res.ok).toBe(false);
    expect(res.error.name).toBe('TimeoutError');
  });

  it('rejects handler output that violates output schema', async () => {
    const r = new ToolRegistry({ maxRetries: 0 });
    r.register({
      name: 'bad-out',
      schema: {
        input: { type: 'object' },
        output: { type: 'object', required: ['answer'] },
      },
      handler: async () => ({ nope: true }),
    });
    const res = await r.invoke('bad-out', {});
    expect(res.ok).toBe(false);
    expect(String(res.error.message)).toMatch(/output/);
  });
});

describe('ToolRegistry.chain', () => {
  it('pipes previous result into context across steps', async () => {
    const r = new ToolRegistry();
    r.register({
      name: 'add1',
      schema: { input: { type: 'object', required: ['n'] } },
      handler: async ({ n }) => ({ n: n + 1 }),
    });
    r.register({
      name: 'double',
      schema: { input: { type: 'object', required: ['n'] } },
      handler: async (_, ctx) => ({ n: ctx.previous.n * 2 }),
    });
    const res = await r.chain([
      { tool: 'add1', input: { n: 3 } }, // -> 4
      { tool: 'double', input: { ignored: true, n: 0 } }, // -> 8
    ]);
    expect(res.ok).toBe(true);
    expect(res.value).toEqual({ n: 8 });
    expect(res.results).toHaveLength(2);
  });

  it('short-circuits on first failure', async () => {
    const r = new ToolRegistry({ maxRetries: 0 });
    r.register({
      name: 'ok',
      schema: { input: { type: 'object' } },
      handler: async () => ({}),
    });
    r.register({
      name: 'boom',
      schema: { input: { type: 'object' } },
      handler: async () => {
        throw new Error('fail');
      },
    });
    const res = await r.chain([
      { tool: 'ok', input: {} },
      { tool: 'boom', input: {} },
      { tool: 'ok', input: {} },
    ]);
    expect(res.ok).toBe(false);
    expect(res.results).toHaveLength(2); // third never ran
  });
});

describe('validateAgainstSchema', () => {
  it('accepts when schema is absent', () => {
    expect(validateAgainstSchema(null, { anything: true })).toBeNull();
  });

  it('checks string/number/boolean/integer', () => {
    expect(validateAgainstSchema({ type: 'string' }, 'ok')).toBeNull();
    expect(validateAgainstSchema({ type: 'string' }, 3)).toMatch(/expected string/);
    expect(validateAgainstSchema({ type: 'number' }, NaN)).toMatch(/expected number/);
    expect(validateAgainstSchema({ type: 'integer' }, 3.14)).toMatch(/expected integer/);
    expect(validateAgainstSchema({ type: 'boolean' }, 0)).toMatch(/expected boolean/);
  });

  it('checks array with items', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(validateAgainstSchema(schema, ['a', 'b'])).toBeNull();
    expect(validateAgainstSchema(schema, ['a', 1])).toMatch(/\[1\]/);
    expect(validateAgainstSchema(schema, 'not array')).toMatch(/expected array/);
  });

  it('object: required fields and nested validation', () => {
    const schema = {
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' }, age: { type: 'integer' } },
    };
    expect(validateAgainstSchema(schema, { name: 'alice', age: 30 })).toBeNull();
    expect(validateAgainstSchema(schema, { age: 30 })).toMatch(/name/);
    expect(validateAgainstSchema(schema, { name: 123 })).toMatch(/name/);
    expect(validateAgainstSchema(schema, { name: 'x', age: 1.5 })).toMatch(/age/);
  });

  it('required: rejects prototype-chain keys (H10 regression)', () => {
    // An attacker controls the input object's prototype. The required key
    // exists only via __proto__, not as an own property — must be rejected.
    const schema = { type: 'object', required: ['name'] };
    const polluted = Object.create({ name: 'from-prototype' });
    expect(validateAgainstSchema(schema, polluted)).toMatch(/missing required field/);
  });

  it('properties: does not validate inherited keys', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    // prototype has `name: 123` which would fail validation if walked.
    // Own properties are empty and no `required` — should pass.
    const o = Object.create({ name: 123 });
    expect(validateAgainstSchema(schema, o)).toBeNull();
  });
});

describe('ToolRegistry.chain context hardening', () => {
  it('drops __proto__ from caller-supplied context (H9 regression)', async () => {
    const r = new ToolRegistry({ maxRetries: 0 });
    let seenProto;
    r.register({
      name: 'probe',
      schema: { input: { type: 'object' } },
      handler: async (input, ctx) => {
        seenProto = ctx.injected;
        return { ok: true };
      },
    });
    const dirtyCtx = Object.create({ injected: 'gotcha' });
    await r.chain([{ tool: 'probe', input: {} }], { context: dirtyCtx });
    expect(seenProto).toBeUndefined();
  });

  it('rejects arrays when object expected', () => {
    expect(validateAgainstSchema({ type: 'object' }, [])).toMatch(/expected object/);
  });
});
