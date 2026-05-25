/**
 * Lambda Security Check Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScanContext } from '../types.js';
import { checkLambdaPublicAccess, checkLambdaRuntime, checkLambdaVpc, runLambdaChecks } from './lambda.js';

const ctx: ScanContext = {
  accountId: '123456789012', region: 'us-east-1',
  credentials: { accessKeyId: 'AKIA', secretAccessKey: 'secret', sessionToken: 'token', expiration: '2099-01-01' },
};

vi.mock('./lambda-request.js', () => ({
  lambdaRequest: vi.fn(async (_ctx: ScanContext, path: string) => {
    if (path === '/2015-03-31/functions') {
      return {
        Functions: [
          { FunctionName: 'fn1', FunctionArn: 'arn:aws:lambda:us-east-1:123:function:fn1', Runtime: 'python3.6' },
          { FunctionName: 'fn2', FunctionArn: 'arn:aws:lambda:us-east-1:123:function:fn2', Runtime: 'python3.12', VpcConfig: { VpcId: 'vpc-1' } },
        ],
      };
    }
    if (path.includes('/policy')) {
      if (path.includes('fn1')) return { Policy: '{"Statement":[{"Principal":"*"}]}' };
      throw new Error('No policy');
    }
    return {};
  }),
}));

describe('Lambda checks', () => {
  it('detects public Lambda functions', async () => {
    const findings = await checkLambdaPublicAccess(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('lambda-public-access');
    expect(findings[0].severity).toBe('critical');
  });

  it('detects deprecated runtimes', async () => {
    const findings = await checkLambdaRuntime(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('lambda-deprecated-runtime');
    expect(findings[0].resourceId).toContain('fn1');
  });

  it('detects functions not in VPC', async () => {
    const findings = await checkLambdaVpc(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].checkId).toBe('lambda-not-in-vpc');
  });

  it('runLambdaChecks aggregates all checks', async () => {
    const findings = await runLambdaChecks(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });
});
