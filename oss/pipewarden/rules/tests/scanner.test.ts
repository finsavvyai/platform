import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityScanner } from '../src/services/scanner';

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = new SecurityScanner();
  });

  it('should detect XSS vulnerabilities', async () => {
    const code = 'element.innerHTML = userInput;';
    const result = await scanner.scanCode(code, 'test.js', 'javascript');

    expect(result.vulnerabilities.length).toBeGreaterThan(0);
    const xssVuln = result.vulnerabilities.find((v) => v.type === 'xss');
    expect(xssVuln).toBeDefined();
  });

  it('should detect SQL injection vulnerabilities', async () => {
    const code = "query('SELECT * FROM users WHERE id = ' + id + '');";
    const result = await scanner.scanCode(code, 'db.js', 'javascript');

    const sqlVuln = result.vulnerabilities.find((v) => v.type === 'sql-injection');
    expect(sqlVuln).toBeDefined();
  });

  it('should detect command injection', async () => {
    const code = "exec('rm -rf ' + path);";
    const result = await scanner.scanCode(code, 'cmd.js', 'javascript');

    const cmdVuln = result.vulnerabilities.find((v) => v.type === 'command-injection');
    expect(cmdVuln).toBeDefined();
  });

  it('should detect hardcoded secrets', async () => {
    const code = 'const password = "mysecret123";';
    const result = await scanner.scanCode(code, 'config.js', 'javascript');

    const secretVuln = result.vulnerabilities.find((v) => v.type === 'hardcoded-secret');
    expect(secretVuln).toBeDefined();
  });

  it('should detect unsafe eval', async () => {
    const code = 'eval(userCode);';
    const result = await scanner.scanCode(code, 'unsafe.js', 'javascript');

    const evalVuln = result.vulnerabilities.find((v) => v.type === 'unsafe-eval');
    expect(evalVuln).toBeDefined();
  });

  it('should track vulnerability severity', async () => {
    const code = 'element.innerHTML = userInput;';
    const result = await scanner.scanCode(code, 'test.js', 'javascript');

    const xssVuln = result.vulnerabilities.find((v) => v.type === 'xss');
    expect(xssVuln?.severity).toBe('high');
  });

  it('should provide suggestions for fixes', async () => {
    const code = 'element.innerHTML = userInput;';
    const result = await scanner.scanCode(code, 'test.js', 'javascript');

    const vuln = result.vulnerabilities[0];
    expect(vuln.suggestion).toBeDefined();
    expect(vuln.suggestion?.length).toBeGreaterThan(0);
  });

  it('should get result by id', async () => {
    const code = 'const x = 1;';
    const result = await scanner.scanCode(code, 'test.js', 'javascript');

    const retrieved = scanner.getResult(result.id);
    expect(retrieved?.id).toBe(result.id);
  });

  it('should list all scan results', async () => {
    await scanner.scanCode('code1', 'file1.js', 'javascript');
    await scanner.scanCode('code2', 'file2.js', 'javascript');

    const results = scanner.listResults();
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should get results by file', async () => {
    await scanner.scanCode('code', 'test.js', 'javascript');
    await scanner.scanCode('code', 'other.js', 'javascript');

    const results = scanner.getResultsByFile('test.js');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filename).toBe('test.js');
  });

  it('should get vulnerabilities by severity', async () => {
    const code = 'element.innerHTML = x; eval(y); const pwd = "secret";';
    await scanner.scanCode(code, 'test.js', 'javascript');

    const critical = scanner.getCriticalVulnerabilities();
    expect(critical.length).toBeGreaterThan(0);
  });

  it('should scan multiple vulnerabilities', async () => {
    const code = 'innerHTML = x; eval(y);';
    const result = await scanner.scanCode(code, 'test.js', 'javascript');

    expect(result.vulnerabilities.length).toBeGreaterThan(1);
  });
});
