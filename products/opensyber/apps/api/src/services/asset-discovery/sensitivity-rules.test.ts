import { describe, it, expect } from 'vitest';
import {
  classifyFileSensitivity,
  classifyEnvVarSensitivity,
  classifyCloudResourceSensitivity,
  isCrownJewelCandidate,
} from './sensitivity-rules.js';

describe('classifyFileSensitivity', () => {
  it('should classify .pem and .key files as critical', () => {
    expect(classifyFileSensitivity('/home/.ssh/id_rsa.pem')).toBe('critical');
    expect(classifyFileSensitivity('/certs/server.key')).toBe('critical');
  });

  it('should classify AWS credentials as critical', () => {
    expect(classifyFileSensitivity('/home/dev/.aws/credentials')).toBe('critical');
  });

  it('should classify .env files as high', () => {
    expect(classifyFileSensitivity('/project/.env')).toBe('high');
    expect(classifyFileSensitivity('/app/.env.production')).toBe('high');
  });

  it('should classify node_modules as low', () => {
    expect(classifyFileSensitivity('/project/node_modules/express/index.js')).toBe('low');
  });

  it('should classify source code as medium', () => {
    expect(classifyFileSensitivity('/src/components/App.tsx')).toBe('medium');
  });
});

describe('classifyEnvVarSensitivity', () => {
  it('should classify AWS_SECRET_ACCESS_KEY as critical', () => {
    expect(classifyEnvVarSensitivity('AWS_SECRET_ACCESS_KEY')).toBe('critical');
  });

  it('should classify API_KEY as high', () => {
    expect(classifyEnvVarSensitivity('API_KEY')).toBe('high');
  });

  it('should classify URL-like vars as medium', () => {
    expect(classifyEnvVarSensitivity('APP_URL')).toBe('medium');
  });

  it('should classify unknown vars as low', () => {
    expect(classifyEnvVarSensitivity('LOG_LEVEL')).toBe('low');
  });
});

describe('classifyCloudResourceSensitivity', () => {
  it('should use finding severity for critical/high', () => {
    expect(classifyCloudResourceSensitivity('s3-bucket', 'critical')).toBe('critical');
    expect(classifyCloudResourceSensitivity('ec2', 'high')).toBe('high');
  });

  it('should elevate RDS and IAM to high', () => {
    expect(classifyCloudResourceSensitivity('rds-instance', 'medium')).toBe('high');
    expect(classifyCloudResourceSensitivity('iam-role', 'low')).toBe('high');
  });
});

describe('isCrownJewelCandidate', () => {
  it('should flag production paths', () => {
    expect(isCrownJewelCandidate('/data/production/db.sql')).toBe(true);
  });

  it('should flag customer data', () => {
    expect(isCrownJewelCandidate('/exports/customer_data.csv')).toBe(true);
  });

  it('should not flag generic paths', () => {
    expect(isCrownJewelCandidate('/src/utils/helpers.ts')).toBe(false);
  });
});
