/**
 * Command-line argument parser for deployment orchestrator
 */

/**
 * Parse command-line arguments
 * @param {Array<string>} args - Command-line arguments
 * @returns {Object} Parsed arguments
 */
function parseCommandLineArgs(args) {
  const parsed = {
    environment: 'development',
    config: null,
    dryRun: false,
    skipSteps: [],
    autoRollback: true,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--environment':
      case '-e':
        parsed.environment = args[++i];
        if (!['development', 'staging', 'production'].includes(parsed.environment)) {
          throw new Error(`Invalid environment: ${parsed.environment}. Must be development, staging, or production.`);
        }
        break;

      case '--config':
      case '-c':
        parsed.config = args[++i];
        break;

      case '--dry-run':
        parsed.dryRun = true;
        break;

      case '--skip-steps':
        const steps = args[++i];
        parsed.skipSteps = steps.split(',').map(s => s.trim());
        break;

      case '--no-rollback':
        parsed.autoRollback = false;
        break;

      case '--help':
      case '-h':
        parsed.help = true;
        break;

      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }

  return parsed;
}

module.exports = { parseCommandLineArgs };
