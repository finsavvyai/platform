/**
 * Lambda Security Checks
 *
 * Checks for public Lambda functions, deprecated runtimes, and VPC configuration.
 */
import type { ScanContext, SecurityFinding } from '../types.js';
import { lambdaRequest } from './lambda-request.js';

interface LambdaFunction {
  FunctionName: string;
  FunctionArn: string;
  Runtime?: string;
  VpcConfig?: { VpcId?: string };
}

const DEPRECATED_RUNTIMES = ['python2.7', 'python3.6', 'python3.7', 'nodejs12.x', 'nodejs14.x', 'dotnetcore3.1', 'ruby2.7'];

export async function checkLambdaPublicAccess(ctx: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const data = await lambdaRequest(ctx, '/2015-03-31/functions') as { Functions?: LambdaFunction[] };
    for (const fn of data.Functions ?? []) {
      try {
        const policy = await lambdaRequest(ctx, `/2015-03-31/functions/${fn.FunctionName}/policy`) as { Policy?: string };
        if (policy.Policy?.includes('"Principal":"*"')) {
          findings.push({
            checkId: 'lambda-public-access', severity: 'critical',
            resourceId: fn.FunctionArn, resourceType: 'lambda-function', region: ctx.region,
            title: 'Lambda function has public access',
            description: `Function "${fn.FunctionName}" has a resource policy allowing public invocation.`,
            remediation: 'Remove the resource policy statement that grants access to Principal "*".',
            complianceFrameworks: ['CIS AWS 2.0', 'SOC2 CC6.1'],
          });
        }
      } catch { /* no policy = not public */ }
    }
  } catch (error) {
    findings.push({
      checkId: 'lambda-public-access', severity: 'low',
      resourceId: ctx.accountId, resourceType: 'lambda-account', region: ctx.region,
      title: 'Could not check Lambda functions',
      description: `Failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      remediation: 'Verify IAM credentials have lambda:ListFunctions permission.',
    });
  }
  return findings;
}

export async function checkLambdaRuntime(ctx: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const data = await lambdaRequest(ctx, '/2015-03-31/functions') as { Functions?: LambdaFunction[] };
    for (const fn of data.Functions ?? []) {
      if (fn.Runtime && DEPRECATED_RUNTIMES.includes(fn.Runtime)) {
        findings.push({
          checkId: 'lambda-deprecated-runtime', severity: 'medium',
          resourceId: fn.FunctionArn, resourceType: 'lambda-function', region: ctx.region,
          title: `Lambda uses deprecated runtime: ${fn.Runtime}`,
          description: `Function "${fn.FunctionName}" uses runtime "${fn.Runtime}" which is past end-of-life.`,
          remediation: `Upgrade to a supported runtime version.`,
          complianceFrameworks: ['SOC2 CC8.1'],
        });
      }
    }
  } catch { /* handled by public access check */ }
  return findings;
}

export async function checkLambdaVpc(ctx: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const data = await lambdaRequest(ctx, '/2015-03-31/functions') as { Functions?: LambdaFunction[] };
    for (const fn of data.Functions ?? []) {
      if (!fn.VpcConfig?.VpcId) {
        findings.push({
          checkId: 'lambda-not-in-vpc', severity: 'low',
          resourceId: fn.FunctionArn, resourceType: 'lambda-function', region: ctx.region,
          title: 'Lambda function not in VPC',
          description: `Function "${fn.FunctionName}" is not deployed within a VPC.`,
          remediation: 'Deploy Lambda functions in a VPC for network isolation where applicable.',
          complianceFrameworks: ['CIS AWS 2.9', 'SOC2 CC6.1'],
        });
      }
    }
  } catch { /* handled by public access check */ }
  return findings;
}

export async function runLambdaChecks(ctx: ScanContext): Promise<SecurityFinding[]> {
  const results = await Promise.all([checkLambdaPublicAccess(ctx), checkLambdaRuntime(ctx), checkLambdaVpc(ctx)]);
  return results.flat();
}
