import { describe, it, expect, beforeEach } from 'vitest';
import { Agent, Capability, Message } from '../src/services/agent';

describe('Agent', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent();
  });

  it('should create agent with auto-generated id', () => {
    expect(agent.id).toBeDefined();
    expect(agent.id.length).toBeGreaterThan(0);
  });

  it('should create agent with custom id', () => {
    const customAgent = new Agent('custom-id');
    expect(customAgent.id).toBe('custom-id');
  });

  it('should register capability', () => {
    const cap: Capability = {
      name: 'analytics',
      version: '1.0.0',
      description: 'Analytics capability',
    };
    agent.registerCapability(cap);
    expect(agent.hasCapability('analytics')).toBe(true);
  });

  it('should throw on invalid capability', () => {
    expect(() => {
      agent.registerCapability({
        name: '',
        version: '1.0.0',
        description: 'Invalid',
      });
    }).toThrow('Invalid capability');
  });

  it('should return all capabilities', () => {
    const cap1: Capability = {
      name: 'cap1',
      version: '1.0.0',
      description: 'Cap 1',
    };
    const cap2: Capability = {
      name: 'cap2',
      version: '2.0.0',
      description: 'Cap 2',
    };
    agent.registerCapability(cap1);
    agent.registerCapability(cap2);
    const caps = agent.getCapabilities();
    expect(caps).toHaveLength(2);
    expect(caps.map((c) => c.name)).toContain('cap1');
  });

  it('should register message handler', async () => {
    let received = false;
    agent.registerHandler('test', async () => {
      received = true;
    });
    const msg: Message = {
      id: 'msg1',
      from: 'agent1',
      to: agent.id,
      type: 'request',
      payload: {},
      timestamp: Date.now(),
    };
    await agent.receiveMessage(msg);
    expect(received).toBe(true);
  });

  it('should send message with correct structure', async () => {
    const msg = await agent.sendMessage('target-agent', 'request', {
      action: 'test',
    });
    expect(msg.from).toBe(agent.id);
    expect(msg.to).toBe('target-agent');
    expect(msg.type).toBe('request');
    expect(msg.payload.action).toBe('test');
  });

  it('should maintain message history', async () => {
    await agent.sendMessage('agent1', 'event', { data: 'test1' });
    await agent.sendMessage('agent2', 'request', { data: 'test2' });
    const history = agent.getMessageHistory();
    expect(history).toHaveLength(2);
  });

  it('should limit message history to requested size', async () => {
    for (let i = 0; i < 20; i++) {
      await agent.sendMessage(`agent${i}`, 'event', { index: i });
    }
    const limited = agent.getMessageHistory(5);
    expect(limited).toHaveLength(5);
  });

  it('should clear message history', async () => {
    await agent.sendMessage('agent1', 'event', {});
    agent.clearMessageHistory();
    expect(agent.getMessageHistory()).toHaveLength(0);
  });

  it('should emit send event on sendMessage', (done) => {
    agent.on('send', (msg: Message) => {
      expect(msg.from).toBe(agent.id);
      expect(msg.to).toBe('target');
      done();
    });
    agent.sendMessage('target', 'request', {});
  });

  it('should emit message event when no handler', (done) => {
    agent.on('message', (msg: Message) => {
      expect(msg.type).toBe('unknown');
      done();
    });
    agent.receiveMessage({
      id: 'msg1',
      from: 'sender',
      to: agent.id,
      type: 'unknown',
      payload: {},
      timestamp: Date.now(),
    });
  });
});
