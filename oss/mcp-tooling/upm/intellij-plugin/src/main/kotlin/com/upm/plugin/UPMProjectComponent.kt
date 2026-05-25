package com.upm.plugin

import com.intellij.openapi.components.ProjectComponent
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.project.Project
import com.intellij.util.messages.MessageBusConnection
import com.upm.plugin.api.UPMService
import com.upm.plugin.config.UPMConfig
import com.upm.plugin.utils.UPMLogger

/**
 * Project-level component for the UPM IntelliJ Plugin.
 *
 * This component manages plugin functionality at the project level:
 * - Project-specific configuration and settings
 * - Dependency analysis coordination
 * - Real-time updates via WebSocket
 * - Project-level event handling
 */
class UPMProjectComponent(private val project: Project) : ProjectComponent {

    companion object {
        private val LOG = logger<UPMProjectComponent>()

        fun getInstance(project: Project): UPMProjectComponent? {
            return project.getComponent(UPMProjectComponent::class.java)
        }
    }

    private var messageBusConnection: MessageBusConnection? = null
    private var upmService: UPMService? = null
    private var projectInitialized = false

    override fun getComponentName(): String = "UPMProjectComponent"

    /**
     * Initialize the project component.
     */
    override fun projectOpened() {
        LOG.info("Opening UPM for project: ${project.name}")

        try {
            // Initialize project-specific services
            initializeProjectServices()

            // Set up project-level listeners
            setupProjectListeners()

            // Start dependency monitoring
            startDependencyMonitoring()

            // Connect to WebSocket if configured
            connectToWebSocket()

            projectInitialized = true

            UPMLogger.info("Project component initialized", mapOf(
                "projectName" to project.name,
                "projectPath" to project.basePath
            ))

        } catch (e: Exception) {
            LOG.error("Failed to initialize project component for ${project.name}", e)
            UPMLogger.error("Project initialization failed", mapOf(
                "projectName" to project.name,
                "error" to e.message
            ))
        }
    }

    /**
     * Clean up when the project is closed.
     */
    override fun projectClosed() {
        LOG.info("Closing UPM for project: ${project.name}")

        try {
            // Disconnect WebSocket
            disconnectFromWebSocket()

            // Stop dependency monitoring
            stopDependencyMonitoring()

            // Disconnect listeners
            messageBusConnection?.disconnect()
            messageBusConnection = null

            // Clean up services
            cleanupProjectServices()

            projectInitialized = false

            UPMLogger.info("Project component closed", mapOf(
                "projectName" to project.name
            ))

        } catch (e: Exception) {
            LOG.error("Error closing project component for ${project.name}", e)
        }
    }

    /**
     * Initialize project-specific services.
     */
    private fun initializeProjectServices() {
        LOG.debug("Initializing project services for ${project.name}")

        // Create UPM service instance for this project
        upmService = UPMServiceImpl(project)

        // Register service with project
        project.messageBus.connect().subscribe(
            UPMService.UPM_SERVICE_TOPIC,
            upmService!!
        )

        LOG.debug("Project services initialized")
    }

    /**
     * Set up project-level event listeners.
     */
    private fun setupProjectListeners() {
        LOG.debug("Setting up project listeners for ${project.name}")

        val messageBus = project.messageBus
        messageBusConnection = messageBus.connect()

        // Listen for file changes
        // messageBusConnection.subscribe(VirtualFileListener.TOPIC, UPMDependencyFileListener(project))

        // Listen for build events
        // messageBusConnection.subscribe(BuildManagerListener.TOPIC, UPMBuildListener(project))

        // Listen for module changes
        // messageBusConnection.subscribe(ModuleListener.TOPIC, UPMModuleListener(project))

        LOG.debug("Project listeners established")
    }

    /**
     * Start monitoring dependency files.
     */
    private fun startDependencyMonitoring() {
        LOG.debug("Starting dependency monitoring for ${project.name}")

        val config = UPMConfig.getInstance()
        if (config.realTimeAnalysisEnabled) {
            // Schedule periodic analysis
            // UPMAnalysisScheduler.getInstance(project).schedulePeriodicAnalysis()

            UPMLogger.info("Dependency monitoring started", mapOf(
                "projectName" to project.name
            ))
        }
    }

    /**
     * Stop dependency monitoring.
     */
    private fun stopDependencyMonitoring() {
        LOG.debug("Stopping dependency monitoring for ${project.name}")

        // UPMAnalysisScheduler.getInstance(project).stopPeriodicAnalysis()

        UPMLogger.info("Dependency monitoring stopped", mapOf(
            "projectName" to project.name
        ))
    }

    /**
     * Connect to UPM WebSocket for real-time updates.
     */
    private fun connectToWebSocket() {
        LOG.debug("Connecting to WebSocket for ${project.name}")

        val config = UPMConfig.getInstance()
        if (config.websocketEnabled && config.apiKey.isNotEmpty()) {
            // Connect to WebSocket
            // UPMWebSocketManager.getInstance(project).connect()

            UPMLogger.info("WebSocket connection initiated", mapOf(
                "projectName" to project.name,
                "serverUrl" to config.serverUrl
            ))
        }
    }

    /**
     * Disconnect from WebSocket.
     */
    private fun disconnectFromWebSocket() {
        LOG.debug("Disconnecting from WebSocket for ${project.name}")

        // UPMWebSocketManager.getInstance(project).disconnect()

        UPMLogger.info("WebSocket connection closed", mapOf(
            "projectName" to project.name
        ))
    }

    /**
     * Clean up project services.
     */
    private fun cleanupProjectServices() {
        LOG.debug("Cleaning up project services for ${project.name}")

        upmService?.dispose()
        upmService = null

        // Clear caches
        // UPMDependencyCache.getInstance(project).clear()

        LOG.debug("Project services cleaned up")
    }

    /**
     * Get the UPM service for this project.
     */
    fun getUPMService(): UPMService? = upmService

    /**
     * Check if the project component is initialized.
     */
    fun isProjectInitialized(): Boolean = projectInitialized

    /**
     * Get project status information.
     */
    fun getProjectStatus(): Map<String, Any> {
        return mapOf(
            "projectName" to project.name,
            "projectPath" to project.basePath ?: "unknown",
            "initialized" to projectInitialized,
            "serviceActive" to (upmService != null),
            "configExists" to UPMConfig.getInstance().isConfigured()
        )
    }
}
