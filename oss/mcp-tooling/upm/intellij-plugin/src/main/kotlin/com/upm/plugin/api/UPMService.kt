package com.upm.plugin.api

import com.intellij.openapi.project.Project
import com.intellij.util.messages.Topic
import java.util.*

/**
 * Main service interface for UPM plugin functionality.
 *
 * This interface provides the core contract for all UPM operations
 * within the IntelliJ IDEA plugin.
 */
interface UPMService {

    companion object {
        val UPM_SERVICE_TOPIC = Topic("UPM Service", UPMServiceListener::class.java)
    }

    /**
     * Get the associated project.
     */
    fun getProject(): Project

    /**
     * Initialize the service for the given project.
     */
    fun initialize()

    /**
     * Dispose of the service and clean up resources.
     */
    fun dispose()

    /**
     * Check if the service is active.
     */
    fun isActive(): Boolean

    /**
     * Get service status information.
     */
    fun getStatus(): Map<String, Any>

    // Dependency Analysis Operations

    /**
     * Analyze project dependencies.
     */
    suspend fun analyzeDependencies(): DependencyAnalysisResult

    /**
     * Analyze dependencies for a specific file asynchronously.
     */
    fun analyzeDependenciesAsync(psiFile: com.intellij.psi.PsiFile, callback: (List<DependencyInfo>) -> Unit)

    /**
     * Get dependencies for a specific file.
     */
    fun analyzeDependencies(psiFile: com.intellij.psi.PsiFile): List<DependencyInfo>

    /**
     * Get dependency tree for the project.
     */
    suspend fun getDependencyTree(): DependencyNode

    /**
     * Get vulnerabilities for a specific dependency.
     */
    suspend fun getDependencyVulnerabilities(dependencyId: String): List<Vulnerability>

    /**
     * Get outdated dependencies.
     */
    suspend fun getOutdatedDependencies(): List<OutdatedDependency>

    // Policy Compliance Operations

    /**
     * Check policy compliance for the project.
     */
    suspend fun checkPolicyCompliance(): PolicyComplianceResult

    /**
     * Get policy violations.
     */
    suspend fun getPolicyViolations(): List<PolicyViolation>

    /**
     * Request exception for a policy violation.
     */
    suspend fun requestException(violationId: String, reason: String): ExceptionRequest

    // Build Integration

    /**
     * Check if build should be blocked.
     */
    fun shouldBlockBuild(): Boolean

    /**
     * Get build blocking violations.
     */
    fun getBuildBlockingViolations(): List<PolicyViolation>

    // Real-time Updates

    /**
     * Subscribe to real-time updates.
     */
    fun subscribeToUpdate(listener: UPMUpdateListener)

    /**
     * Unsubscribe from real-time updates.
     */
    fun unsubscribeFromUpdate(listener: UPMUpdateListener)

    // Configuration

    /**
     * Update service configuration.
     */
    fun updateConfiguration(config: Map<String, Any>)

    /**
     * Get current configuration.
     */
    fun getConfiguration(): Map<String, Any>

    // Additional methods for IDE integration

    /**
     * Get all project dependencies.
     */
    fun getProjectDependencies(project: Project): List<DependencyInfo>

    /**
     * Get dependency info for specific coordinates.
     */
    fun getDependencyInfo(groupId: String, artifactId: String, version: String): DependencyInfo?

    /**
     * Update dependency in build file.
     */
    fun updateDependencyInBuildFile(dependency: DependencyInfo): Boolean

    /**
     * Refresh dependency analysis for project.
     */
    fun refreshDependencyAnalysis(project: Project)

    /**
     * Refresh project dependencies.
     */
    fun refreshProjectDependencies(project: Project)
}

/**
 * Listener for UPM service events.
 */
interface UPMServiceListener : EventListener {

    /**
     * Called when service status changes.
     */
    fun onServiceStatusChanged(status: Map<String, Any>) {}

    /**
     * Called when dependency analysis completes.
     */
    fun onDependencyAnalysisCompleted(result: DependencyAnalysisResult) {}

    /**
     * Called when new vulnerabilities are detected.
     */
    fun onVulnerabilitiesDetected(vulnerabilities: List<Vulnerability>) {}

    /**
     * Called when policy violations are found.
     */
    fun onPolicyViolationsDetected(violations: List<PolicyViolation>) {}

    /**
     * Called when real-time update is received.
     */
    fun onRealTimeUpdate(update: UPMUpdate) {}
}

/**
 * Listener for real-time updates.
 */
interface UPMUpdateListener : EventListener {

    /**
     * Handle real-time update from UPM backend.
     */
    fun onUpdate(update: UPMUpdate)
}

/**
 * Real-time update from UPM backend.
 */
data class UPMUpdate(
    val type: UpdateType,
    val projectId: String,
    val timestamp: Long,
    val data: Any
)

enum class UpdateType {
    VULNERABILITY_DETECTED,
    POLICY_VIOLATION,
    DEPENDENCY_UPDATED,
    ANALYSIS_COMPLETED,
    BUILD_BLOCKED,
    NOTIFICATION
}
