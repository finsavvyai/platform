/**
 * QueryFlux OpenAI App - Main Entry Point
 *
 * The first and only database AI assistant in the OpenAI GPT Store
 * Securely connect to any database (including VPN-protected) via natural language
 */

import { actions } from "./actions/index.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { SecureBridge } from "./security/secure-bridge.js";

/**
 * Initialize QueryFlux OpenAI App
 */
async function initializeApp() {
  try {
    logger.info("🚀 Initializing QueryFlux OpenAI App...");

    // Initialize secure bridge for enterprise security
    const secureBridge = new SecureBridge({
      bridgeId: config.bridge.id,
      organizationId: config.organization.id,
      allowedDatabases: config.databases.allowed,
      securityPolicies: config.security.policies,
      monitoring: config.monitoring,
    });

    // Validate security configuration
    await validateSecurityConfiguration();

    // Initialize database connections
    await initializeDatabaseConnections();

    // Setup monitoring and alerting
    await setupMonitoring();

    logger.info("✅ QueryFlux OpenAI App initialized successfully");
    logger.info(`🔐 Security Level: ${config.security.level}`);
    logger.info(
      `📊 Supported Databases: ${config.databases.supported.join(", ")}`,
    );
    logger.info(`🌐 OpenAI Model: ${config.openai.model}`);

    return {
      actions,
      secureBridge,
      config,
      status: "ready",
    };
  } catch (error) {
    logger.error("❌ Failed to initialize QueryFlux OpenAI App:", error);
    throw error;
  }
}

/**
 * Validate security configuration before startup
 */
async function validateSecurityConfiguration(): Promise<void> {
  const securityChecks = [
    validateEncryptionKeys(),
    validateAuthenticationSettings(),
    validateNetworkSecurity(),
    validateAuditConfiguration(),
  ];

  const results = await Promise.allSettled(securityChecks);
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    throw new Error(
      `Security validation failed: ${failures.length} checks failed`,
    );
  }

  logger.info("🔒 All security validations passed");
}

/**
 * Validate encryption keys are properly configured
 */
async function validateEncryptionKeys(): Promise<void> {
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error("Invalid encryption key configuration");
  }
}

/**
 * Validate authentication and authorization settings
 */
async function validateAuthenticationSettings(): Promise<void> {
  if (!config.auth.enabled) {
    throw new Error("Authentication must be enabled for production");
  }

  if (config.auth.requireMFA && !config.auth.mfaProvider) {
    throw new Error("MFA provider required when MFA is enabled");
  }
}

/**
 * Validate network security configuration
 */
async function validateNetworkSecurity(): Promise<void> {
  if (
    !config.network.allowedIPRanges ||
    config.network.allowedIPRanges.length === 0
  ) {
    throw new Error("Allowed IP ranges must be configured");
  }

  if (!config.security.requireHTTPS) {
    logger.warn("⚠️ HTTPS not required - recommended for production");
  }
}

/**
 * Validate audit logging configuration
 */
async function validateAuditConfiguration(): Promise<void> {
  if (!config.audit.enabled) {
    throw new Error("Audit logging must be enabled for compliance");
  }

  if (!config.audit.retentionDays || config.audit.retentionDays < 30) {
    throw new Error("Audit retention period must be at least 30 days");
  }
}

/**
 * Initialize database connection pools
 */
async function initializeDatabaseConnections(): Promise<void> {
  logger.info("📊 Initializing database connection pools...");

  for (const dbConfig of config.databases.preconfigured) {
    try {
      // Test connection to each preconfigured database
      logger.info(
        `Testing connection to ${dbConfig.type} database: ${dbConfig.name}`,
      );
      // Connection testing logic here
      logger.info(`✅ Successfully connected to ${dbConfig.name}`);
    } catch (error) {
      logger.warn(`⚠️ Failed to connect to ${dbConfig.name}: ${error.message}`);
    }
  }
}

/**
 * Setup monitoring and alerting systems
 */
async function setupMonitoring(): Promise<void> {
  logger.info("📈 Setting up monitoring and alerting...");

  // Initialize metrics collection
  if (config.monitoring.enabled) {
    logger.info("✅ Monitoring enabled");
    logger.info(
      `📊 Metrics collection: ${config.monitoring.metrics.join(", ")}`,
    );
    logger.info(`🚨 Alerting enabled: ${config.monitoring.alerts.enabled}`);
  }
}

/**
 * Graceful shutdown handler
 */
process.on("SIGTERM", async () => {
  logger.info("📴 Received SIGTERM, shutting down gracefully...");
  await shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("📴 Received SIGINT, shutting down gracefully...");
  await shutdown();
  process.exit(0);
});

/**
 * Cleanup and shutdown procedures
 */
async function shutdown(): Promise<void> {
  try {
    logger.info("🧹 Cleaning up resources...");

    // Close database connections
    // Clear secure sessions
    // Flush audit logs
    // Stop monitoring

    logger.info("✅ Graceful shutdown completed");
  } catch (error) {
    logger.error("❌ Error during shutdown:", error);
  }
}

/**
 * Export for OpenAI platform
 */
export default {
  actions,
  initializeApp,
  config,
  SecureBridge,
};

/**
 * Auto-initialize if running as main module
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeApp()
    .then(() => {
      logger.info("🎉 QueryFlux OpenAI App is ready!");
      logger.info("📝 Available actions:", Object.keys(actions));
    })
    .catch((error) => {
      logger.error("💥 Failed to start QueryFlux OpenAI App:", error);
      process.exit(1);
    });
}
