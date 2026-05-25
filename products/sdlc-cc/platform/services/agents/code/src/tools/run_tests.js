// run_tests — REAL Docker-backed test runner.
//
// Spawns `docker run --rm -v <workdir>:/work -w /work node:22-alpine sh
// -c "<test command>"`. Default test command is `npm test`.
//
// Returns { exitCode, stdout, stderr, durationMs }.
// Inject a fake exec via constructor for tests.

const childProcess = require('node:child_process');

function defaultExec(file, args, opts) {
  return new Promise((resolve) => {
    childProcess.execFile(file, args, opts, (err, stdout, stderr) => {
      const exitCode = err && typeof err.code === 'number' ? err.code : (err ? 1 : 0);
      resolve({ exitCode, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

class RunTestsTool {
  constructor({ exec = defaultExec, dockerImage = 'node:22-alpine', testCommand = 'npm test' } = {}) {
    this.exec = exec;
    this.dockerImage = dockerImage;
    this.testCommand = testCommand;
  }

  async run({ workdir, testCommand } = {}) {
    if (!workdir) {
      throw new TypeError('run_tests: workdir is required');
    }
    const cmd = testCommand || this.testCommand;
    const args = [
      'run', '--rm',
      '-v', `${workdir}:/work`,
      '-w', '/work',
      '--security-opt', 'no-new-privileges',
      this.dockerImage,
      'sh', '-c', cmd,
    ];
    const start = Date.now();
    const { exitCode, stdout, stderr } = await this.exec('docker', args, { cwd: workdir });
    return { exitCode, stdout, stderr, durationMs: Date.now() - start };
  }
}

function run_tests(opts = {}) {
  const tool = new RunTestsTool({
    exec: opts.exec,
    dockerImage: opts.dockerImage,
    testCommand: opts.defaultCommand,
  });
  return tool.run(opts);
}

module.exports = run_tests;
module.exports.RunTestsTool = RunTestsTool;
