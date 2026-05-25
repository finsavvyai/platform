/**
 * Tests for DataDog RUM integration — Task 10.1
 */
import { jest } from '@jest/globals';
import { initDatadog, trackAction, reportError, setGlobalTag, Metrics, _resetForTesting } from '../lib/datadog';

const mockDD = {
  init: jest.fn(),
  startSessionReplayRecording: jest.fn(),
  addAction: jest.fn(),
  addError: jest.fn(),
  setGlobalContextProperty: jest.fn(),
  setUser: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  _resetForTesting();
  // Reset module state via window mock
  Object.defineProperty(window, 'DD_RUM', {
    value: mockDD,
    writable: true,
    configurable: true,
  });
});

describe('initDatadog', () => {
  it('skips init when applicationId is empty', () => {
    initDatadog({ applicationId: '', clientToken: 'token', env: 'test' });
    expect(mockDD.init).not.toHaveBeenCalled();
  });

  it('skips init when clientToken is empty', () => {
    initDatadog({ applicationId: 'app-id', clientToken: '', env: 'test' });
    expect(mockDD.init).not.toHaveBeenCalled();
  });

  it('calls DD_RUM.init with correct service name', () => {
    initDatadog({
      applicationId: 'app-id',
      clientToken: 'client-token',
      env: 'staging',
    });
    expect(mockDD.init).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'lunaos-studio',
        env: 'staging',
        applicationId: 'app-id',
        clientToken: 'client-token',
      })
    );
  });

  it('starts session replay only in production', () => {
    initDatadog({
      applicationId: 'app-id',
      clientToken: 'client-token',
      env: 'production',
    });
    expect(mockDD.startSessionReplayRecording).toHaveBeenCalled();
  });
});

describe('trackAction', () => {
  it('calls DD_RUM.addAction with name and context', () => {
    trackAction('test.action', { foo: 'bar' });
    expect(mockDD.addAction).toHaveBeenCalledWith('test.action', { foo: 'bar' });
  });

  it('does nothing when DD_RUM is not available', () => {
    (window as Record<string, unknown>)['DD_RUM'] = undefined;
    expect(() => trackAction('test.action')).not.toThrow();
  });
});

describe('reportError', () => {
  it('calls DD_RUM.addError with an Error object', () => {
    const err = new Error('test error');
    reportError(err);
    expect(mockDD.addError).toHaveBeenCalledWith(err, undefined);
  });

  it('calls DD_RUM.addError with a string', () => {
    reportError('string error', { ctx: true });
    expect(mockDD.addError).toHaveBeenCalledWith('string error', { ctx: true });
  });
});

describe('setGlobalTag', () => {
  it('calls setGlobalContextProperty', () => {
    setGlobalTag('version', '1.2.3');
    expect(mockDD.setGlobalContextProperty).toHaveBeenCalledWith('version', '1.2.3');
  });
});

describe('Metrics', () => {
  it('workflowCreated tracks node count', () => {
    Metrics.workflowCreated(5);
    expect(mockDD.addAction).toHaveBeenCalledWith('workflow.created', { nodeCount: 5 });
  });

  it('workflowExecuted tracks node count and duration', () => {
    Metrics.workflowExecuted(3, 1200);
    expect(mockDD.addAction).toHaveBeenCalledWith('workflow.executed', {
      nodeCount: 3,
      durationMs: 1200,
    });
  });

  it('workflowFailed tracks error message', () => {
    Metrics.workflowFailed('timeout');
    expect(mockDD.addAction).toHaveBeenCalledWith('workflow.failed', { error: 'timeout' });
  });

  it('nodeAdded tracks node type', () => {
    Metrics.nodeAdded('agent');
    expect(mockDD.addAction).toHaveBeenCalledWith('node.added', { nodeType: 'agent' });
  });

  it('templateUsed tracks template id', () => {
    Metrics.templateUsed('code-review');
    expect(mockDD.addAction).toHaveBeenCalledWith('template.used', { templateId: 'code-review' });
  });
});
