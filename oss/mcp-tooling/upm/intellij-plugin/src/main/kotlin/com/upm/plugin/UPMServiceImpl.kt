package com.upm.plugin

import com.intellij.openapi.project.Project
import com.upm.plugin.api.*
import com.upm.plugin.config.UPMConfig
import com.upm.plugin.utils.UPMLogger
import com.upm.plugin.utils.measureTime
import kotlinx.coroutines.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Implementation of UPMService for IntelliJ IDEA plugin.
 */
class UPMServiceImpl(private val project: Project) : UPMService {

    companion object {
        private val LOG = com.intellij.openapi.diagnostic.logger<UPMServiceImpl>()
    }

    private val config = UPMConfig.getInstance()
    private val apiClient = UPMRestApiClient.getInstance()
    private val updateListeners = CopyOnWriteArrayList<UPMUpdateListener>()
    private val dependencyCache = ConcurrentHashMap<String, Dependency>()
    private val vulnerabilityCache = ConcurrentHashMap<String, List<Vulnerability>>()

    private var isActive = false
    private var analysisJob: Job? = null
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun getProject(): Project = project

    override fun initialize() {
        LOG.info("Initializing UPM service for project: ${project.name}")

        try {
            // Connect to API
            if (config.isConfigured()) {
                apiClient.addListener(createApiListener())
                if (config.websocketEnabled) {
                    apiClient.connectWebSocket()
                }
            }

            isActive = true

            UPMLogger.info("UPM service initialized", mapOf(
                "projectName" to project.name,
                "configured" to config.isConfigured()
            ))

        } catch (e: Exception) {
            LOG.error("Failed to initialize UPM service", e)
            UPMLogger.error("Service initialization failed", mapOf(
                "projectName" to project.name,
                "error" to e.message
            ))
        }
    }

    override fun dispose() {
        LOG.info("Disposing UPM service for project: ${project.name}")

        isActive = false
        updateListeners.clear()
        dependencyCache.clear()
        vulnerabilityCache.clear()

        analysisJob?.cancel()
        coroutineScope.cancel()

        UPMLogger.info("UPM service disposed", mapOf(
            "projectName" to project.name
        ))
    }

    override fun isActive(): Boolean = isActive

    override fun getStatus(): Map<String, Any> {
        return mapOf(
            "active" to isActive,
            "projectName" to project.name,
            "connected" to apiClient.isConnected(),
            "configured" to config.isConfigured(),
            "cacheSize" to dependencyCache.size,
            "listenerCount" to updateListeners.size
        )
    }

    override suspend fun analyzeDependencies(): DependencyAnalysisResult {
        return measureTime("analyzeDependencies", mapOf("project" to project.name)) {
            try {
                LOG.info("Starting dependency analysis for ${project.name}")

                // For now, return a mock result
                val result = DependencyAnalysisResult(
                    projectId = project.locationHash,
                    timestamp = System.currentTimeMillis(),
                    totalDependencies = 0,
                    vulnerableDependencies = 0,
                    outdatedDependencies = 0,
                    policyViolations = 0,
                    dependencies = emptyList(),
                    vulnerabilities = emptyList(),
                    violations = emptyList()
                )

                config.updateLastAnalysisTime()

                UPMLogger.info("Dependency analysis completed", mapOf(
                    "projectName" to project.name,
                    "totalDependencies" to result.totalDependencies
                ))

                result

            } catch (e: Exception) {
                LOG.error("Dependency analysis failed", e)
                throw e
            }
        }
    }

    override suspend fun getDependencyTree(): DependencyNode {
        TODO("Not yet implemented - will be implemented in Task 3.1.2")
    }

    override suspend fun getDependencyVulnerabilities(dependencyId: String): List<Vulnerability> {
        return vulnerabilityCache[dependencyId] ?: emptyList()
    }

    override suspend fun getOutdatedDependencies(): List<OutdatedDependency> {
        TODO("Not yet implemented - will be implemented in Task 3.1.2")
    }

    override suspend fun checkPolicyCompliance(): PolicyComplianceResult {
        TODO("Not yet implemented - will be implemented in Task 3.1.2")
    }

    override suspend fun getPolicyViolations(): List<PolicyViolation> {
        TODO("Not yet implemented - will be implemented in Task 3.1.2")
    }

    override suspend fun requestException(violationId: String, reason: String): ExceptionRequest {
        return apiClient.submitExceptionRequest(violationId, reason)
    }

    override fun shouldBlockBuild(): Boolean {
        if (!config.buildPreventionEnabled) return false

        // TODO: Check for critical violations
        // This will be implemented in Task 3.1.4

        return false
    }

    override fun getBuildBlockingViolations(): List<PolicyViolation> {
        TODO("Not yet implemented - will be implemented in Task 3.1.4")
    }

    override fun subscribeToUpdate(listener: UPMUpdateListener) {
        updateListeners.add(listener)
        LOG.debug("Added update listener for ${project.name}")
    }

    override fun unsubscribeFromUpdate(listener: UPMUpdateListener) {
        updateListeners.remove(listener)
        LOG.debug("Removed update listener for ${project.name}")
    }

    override fun updateConfiguration(config: Map<String, Any>) {
        val configManager = UPMConfig.getInstance()
        configManager.fromMap(config)

        // Reconnect WebSocket if settings changed
        if (config["websocketEnabled"] == true && !apiClient.isConnected()) {
            apiClient.connectWebSocket()
        }

        LOG.info("Configuration updated for ${project.name}")
    }

    override fun getConfiguration(): Map<String, Any> {
        return UPMConfig.getInstance().toMap() + mapOf(
            "projectName" to project.name
        )
    }

    // Private helper methods

    private fun createApiListener(): UPMRestApiListener {
        return object : UPMRestApiListener {
            override fun onDependenciesAnalyzed(result: DependencyAnalysisResult) {
                // Cache dependencies
                result.dependencies.forEach { dep ->
                    dependencyCache[dep.id] = dep
                }

                // Notify listeners
                val update = UPMUpdate(
                    type = UpdateType.ANALYSIS_COMPLETED,
                    projectId = project.locationHash,
                    timestamp = System.currentTimeMillis(),
                    data = result
                )

                notifyUpdateListeners(update)
            }

            override fun onVulnerabilitiesReceived(vulnerabilities: List<Vulnerability>) {
                // Cache vulnerabilities
                vulnerabilities.forEach { vuln ->
                    vulnerabilityCache[vuln.id] = vulnerabilities
                }

                // Notify listeners
                val update = UPMUpdate(
                    type = UpdateType.VULNERABILITY_DETECTED,
                    projectId = project.locationHash,
                    timestamp = System.currentTimeMillis(),
                    data = vulnerabilities
                )

                notifyUpdateListeners(update)
            }

            override fun onPolicyViolationsReceived(violations: List<PolicyViolation>) {
                // Notify listeners
                val update = UPMUpdate(
                    type = UpdateType.POLICY_VIOLATION,
                    projectId = project.locationHash,
                    timestamp = System.currentTimeMillis(),
                    data = violations
                )

                notifyUpdateListeners(update)
            }

            override fun onRealTimeUpdate(update: UPMUpdate) {
                if (update.projectId == project.locationHash) {
                    notifyUpdateListeners(update)
                }
            }
        }
    }

    private fun notifyUpdateListeners(update: UPMUpdate) {
        updateListeners.forEach { listener ->
            try {
                listener.onUpdate(update)
            } catch (e: Exception) {
                LOG.error("Error notifying update listener", e)
            }
        }
    }
}
