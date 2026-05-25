package com.upm.plugin

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ApplicationComponent
import com.intellij.openapi.diagnostic.logger
import com.intellij.util.messages.MessageBusConnection
import com.upm.plugin.api.UPMService
import com.upm.plugin.config.UPMConfig
import com.upm.plugin.utils.UPMLogger

/**
 * Main application component for the UPM IntelliJ Plugin.
 *
 * This component is responsible for:
 * - Initializing the plugin when the IDE starts
 * - Managing global plugin state and services
 * - Setting up application-level event listeners
 * - Coordinating between different plugin components
 */
class UPMApplicationComponent : ApplicationComponent {

    companion object {
        private val LOG = logger<UPMApplicationComponent>()
        const val PLUGIN_NAME = "Universal Dependency Platform"
        const val PLUGIN_VERSION = "1.0.0"

        // Singleton instance
        @Volatile
        private var instance: UPMApplicationComponent? = null

        fun getInstance(): UPMApplicationComponent? = instance
    }

    private var messageBusConnection: MessageBusConnection? = null
    private var serviceInitialized = false

    override fun getComponentName(): String = "UPMApplicationComponent"

    /**
     * Initialize the plugin component.
     * This method is called when the IDE starts up.
     */
    override fun initComponent() {
        LOG.info("Initializing ${PLUGIN_NAME} v${PLUGIN_VERSION}")

        try {
            // Store singleton instance
            instance = this

            // Initialize configuration
            initializeConfiguration()

            // Initialize logging
            initializeLogging()

            // Initialize services
            initializeServices()

            // Set up message bus connections
            setupMessageBusConnections()

            // Validate configuration
            validateConfiguration()

            LOG.info("${PLUGIN_NAME} initialized successfully")
            UPMLogger.info("Plugin startup complete", mapOf(
                "version" to PLUGIN_VERSION,
                "ide" to ApplicationManager.getApplication().versionName
            ))

        } catch (e: Exception) {
            LOG.error("Failed to initialize ${PLUGIN_NAME}", e)
            UPMLogger.error("Plugin initialization failed", mapOf(
                "error" to e.message,
                "stackTrace" to e.stackTraceToString()
            ))
            throw e
        }
    }

    /**
     * Clean up resources when the plugin is disposed.
     */
    override fun disposeComponent() {
        LOG.info("Disposing ${PLUGIN_NAME}")

        try {
            // Disconnect message bus
            messageBusConnection?.disconnect()
            messageBusConnection = null

            // Dispose services
            disposeServices()

            // Clear singleton instance
            instance = null

            serviceInitialized = false

            LOG.info("${PLUGIN_NAME} disposed successfully")
            UPMLogger.info("Plugin shutdown complete")

        } catch (e: Exception) {
            LOG.error("Error disposing ${PLUGIN_NAME}", e)
        }
    }

    /**
     * Initialize plugin configuration.
     */
    private fun initializeConfiguration() {
        LOG.debug("Initializing plugin configuration")

        // Load configuration from persisted settings
        val config = UPMConfig.getInstance()

        // Set default values if not configured
        if (!config.isConfigured()) {
            LOG.info("UPM not configured, applying defaults")
            config.applyDefaults()
            config.save()
        }

        LOG.debug("Configuration initialized: server=${config.serverUrl}")
    }

    /**
     * Initialize enhanced logging system.
     */
    private fun initializeLogging() {
        LOG.debug("Initializing enhanced logging")

        // Configure UPM logger
        UPMLogger.initialize()

        // Log startup information
        UPMLogger.info("UPM Plugin Starting", mapOf(
            "pluginVersion" to PLUGIN_VERSION,
            "ideVersion" to ApplicationManager.getApplication().fullVersion,
            "javaVersion" to System.getProperty("java.version"),
            "osName" to System.getProperty("os.name"),
            "osVersion" to System.getProperty("os.version")
        ))
    }

    /**
     * Initialize core services.
     */
    private fun initializeServices() {
        LOG.debug("Initializing core services")

        val application = ApplicationManager.getApplication()

        // Initialize service manager
        val serviceManager = UPMServiceManager.getInstance()

        // Start background services
        application.executeOnPooledThread {
            try {
                serviceManager.startServices()
                serviceInitialized = true

                UPMLogger.info("All services started successfully")
                LOG.info("All UPM services started")

            } catch (e: Exception) {
                LOG.error("Failed to start services", e)
                UPMLogger.error("Service initialization failed", mapOf(
                    "error" to e.message
                ))
            }
        }
    }

    /**
     * Set up application-level message bus connections.
     */
    private fun setupMessageBusConnections() {
        LOG.debug("Setting up message bus connections")

        val messageBus = ApplicationManager.getApplication().messageBus
        messageBusConnection = messageBus.connect()

        // Add application-level listeners here if needed
        // For example: configuration change listeners, etc.

        LOG.debug("Message bus connections established")
    }

    /**
     * Validate plugin configuration.
     */
    private fun validateConfiguration() {
        LOG.debug("Validating plugin configuration")

        val config = UPMConfig.getInstance()

        // Check required configuration
        if (!config.isValidConfiguration()) {
            LOG.warn("UPM configuration is incomplete")
            UPMLogger.warn("Plugin configuration incomplete", mapOf(
                "serverUrl" to config.serverUrl,
                "hasApiKey" to config.apiKey.isNotEmpty()
            ))
        } else {
            LOG.debug("Configuration validation passed")
        }
    }

    /**
     * Dispose of all services.
     */
    private fun disposeServices() {
        LOG.debug("Disposing services")

        val serviceManager = UPMServiceManager.getInstance()
        serviceManager.stopServices()

        serviceInitialized = false
        LOG.debug("Services disposed")
    }

    /**
     * Check if the plugin is fully initialized.
     */
    fun isInitialized(): Boolean = serviceInitialized

    /**
     * Get the current plugin status.
     */
    fun getPluginStatus(): Map<String, Any> {
        return mapOf(
            "name" to PLUGIN_NAME,
            "version" to PLUGIN_VERSION,
            "initialized" to isInitialized(),
            "configured" to UPMConfig.getInstance().isConfigured(),
            "servicesRunning" to UPMServiceManager.getInstance().areServicesRunning()
        )
    }
}
