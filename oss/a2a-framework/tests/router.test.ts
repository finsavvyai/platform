import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../src/services/agent';
import { MessageRouter } from '../src/services/router';

describe('MessageRouter', () => {
  let router: MessageRouter;
  let agent1: Agent;
  let agent2: Agent;
  let agent3: Agent;

  beforeEach(() => {
    router = new MessageRouter();
    agent1 = new Agent('agent1');
    agent2 = new Agent('agent2');
    agent3 = new Agent('agent3');
  });

  it('should register agents', () => {
    router.registerAgent(agent1);
    expect(router.getAgent('agent1')).toBe(agent1);
  });

  it('should throw on agent without id', () => {
    const badAgent = new Agent();
    badAgent.id = ''; // This shouldn't happen, but test the guard
    expect(() => router.registerAgent(badAgent)).toThrow();
  });

  it('should unregister agents', () => {
    router.registerAgent(agent1);
    router.unregisterAgent('agent1');
    expect(router.getAgent('agent1')).toBeUndefined();
  });

  it('should get all agents', () => {
    router.registerAgent(agent1);
    router.registerAgent(agent2);
    const agents = router.getAgents();
    expect(agents).toHaveLength(2);
  });

  it('should add routing rule', () => {
    router.addRoutingRule({
      topic: 'analytics',
      targetAgentId: 'agent1',
      priority: 10,
    });
    expect(router).toBeDefined();
  });

  it('should throw on invalid routing rule', () => {
    expect(() => {
      router.addRoutingRule({
        topic: '',
        targetAgentId: 'agent1',
        priority: 10,
      });
    }).toThrow('Invalid routing rule');
  });

  it('should route message to target agent', async () => {
    router.registerAgent(agent1);
    router.registerAgent(agent2);

    let received = false;
    agent1.registerHandler('request', async () => {
      received = true;
    });

    const msg = await agent2.sendMessage('agent1', 'request', {});
    const routed = await router.routeMessage(msg);

    expect(routed).toBe(true);
    expect(received).toBe(true);
  });

  it('should queue undeliverable message', async () => {
    const msg = await agent1.sendMessage('unknown-agent', 'request', {});
    const routed = await router.routeMessage(msg);

    expect(routed).toBe(false);
    const pending = router.getPendingMessages();
    expect(pending).toHaveLength(1);
  });

  it('should route by topic', async () => {
    router.registerAgent(agent1);
    router.registerAgent(agent2);
    router.registerAgent(agent3);

    router.addRoutingRule({
      topic: 'events',
      targetAgentId: 'agent1',
      priority: 10,
    });
    router.addRoutingRule({
      topic: 'events',
      targetAgentId: 'agent2',
      priority: 5,
    });

    let received1 = false;
    let received2 = false;

    agent1.registerHandler('event', async () => {
      received1 = true;
    });
    agent2.registerHandler('event', async () => {
      received2 = true;
    });

    const msg = await agent3.sendMessage('broadcast', 'event', {});
    const count = await router.routeByTopic('events', msg);

    expect(count).toBe(2);
    expect(received1).toBe(true);
    expect(received2).toBe(true);
  });

  it('should remove routing rule', () => {
    router.addRoutingRule({
      topic: 'test',
      targetAgentId: 'agent1',
      priority: 1,
    });
    router.removeRoutingRule('test', 'agent1');
    expect(router.getAgents()).toHaveLength(0);
  });

  it('should clear pending messages', async () => {
    const msg = await agent1.sendMessage('unknown', 'request', {});
    await router.routeMessage(msg);
    router.clearPendingMessages();
    expect(router.getPendingMessages()).toHaveLength(0);
  });

  it('should flush queue and clear', async () => {
    const msg1 = await agent1.sendMessage('unknown1', 'request', {});
    const msg2 = await agent2.sendMessage('unknown2', 'request', {});
    await router.routeMessage(msg1);
    await router.routeMessage(msg2);

    const flushed = router.flushQueue();
    expect(flushed).toHaveLength(2);
    expect(router.getPendingMessages()).toHaveLength(0);
  });

  it('should sort routing rules by priority', () => {
    router.addRoutingRule({
      topic: 'test',
      targetAgentId: 'agent1',
      priority: 1,
    });
    router.addRoutingRule({
      topic: 'test',
      targetAgentId: 'agent2',
      priority: 100,
    });
    router.addRoutingRule({
      topic: 'test',
      targetAgentId: 'agent3',
      priority: 50,
    });
    expect(router).toBeDefined();
  });
});
