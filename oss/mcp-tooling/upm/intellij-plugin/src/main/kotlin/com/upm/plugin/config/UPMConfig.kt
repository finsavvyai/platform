package com.upm.plugin.config

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.diagnostic.logger
import com.intellij.util.xmlb.XmlSerializerUtil
import com.upm.plugin.utils.UPMLogger
import java.util.*

/**
 * Configuration class for UPM plugin settings.
 *
 * Stores plugin configuration including:
 * - Server connection settings
 * - Authentication credentials
 * - Feature toggles
 * - Analysis preferences
 */
@State(
    name = "UPMConfig",
    storages = [Storage("upm-config.xml")]
)
class UPMConfig : PersistentStateComponent<UPMConfig.State> {

    companion object {
        private val LOG = logger<UPMConfig>()

        fun getInstance(): UPMConfig {
            return ApplicationManager.getApplication().getService(UPMConfig::class.java)
        }
    }

    data class State(
        var serverUrl: String = "https://api.upm.com",
        var apiToken: String = "",
        var apiKey: String = "",
        var organizationId: String = "",
        var workspaceId: String = "",

        // Feature toggles
        var realTimeAnalysisEnabled: Boolean = true,
        var websocketEnabled: Boolean = true,
        var buildPreventionEnabled: Boolean = true,
        var vulnerabilityHighlightingEnabled: Boolean = true,
        var policyCheckingEnabled: Boolean = true,

        // Analysis settings
        var analysisInterval: Int = 30, // minutes
        var maxDependenciesToAnalyze: Int = 1000,
        var vulnerabilitySeverityThreshold: String = "medium", // low, medium, high, critical

        // Connection settings
        var connectionTimeout: Int = 30, // seconds
        var readTimeout: Int = 60, // seconds
        var maxRetries: Int = 3,
        var retryDelay: Int = 5, // seconds

        // SSL settings
        var ignoreSslErrors: Boolean = false,
        var customCaCertificate: String = "",

        // UI settings
        var showNotifications: Boolean = true,
        var showInlineWarnings: Boolean = true,
        var highlightVulnerableDependencies: Boolean = true,
        var showDependencyTree: Boolean = true,

        // Cache settings
        var cacheEnabled: Boolean = true,
        var cacheExpiry: Int = 24, // hours
        var maxCacheSize: Int = 100, // MB

        // Logging settings
        var logLevel: String = "INFO",
        var enableApiLogging: Boolean = false,
        var enablePerformanceLogging: Boolean = false,

        // Last known state
        var lastAnalysisTime: Long = 0,
        var lastSyncTime: Long = 0,
        var lastKnownProjectCount: Int = 0,

        // User preferences
        var autoUpdateDependencies: Boolean = false,
        var suggestAlternativePackages: Boolean = true,
        var showBreakingChangeWarnings: Boolean = true,

        // Build settings
        var failBuildOnCriticalVulnerabilities: Boolean = true,
        var failBuildOnPolicyViolation: Boolean = false,
        var allowedViolationTypes: Set<String> = setOf(),

        // Notification settings
        var notifyOnVulnerability: Boolean = true,
        var notifyOnPolicyViolation: Boolean = true,
        var notifyOnDependencyUpdate: Boolean = false,
        var notificationEmail: String = "",

        // Advanced settings
        var debugMode: Boolean = false,
        var telemetryEnabled: Boolean = true,
        var betaFeaturesEnabled: Boolean = false,
        var customHeaders: Map<String, String> = emptyMap()
    )

    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        XmlSerializerUtil.copyBean(state, this.state)
    }

    // Convenience methods

    /**
     * Check if configuration is complete.
     */
    fun isConfigured(): Boolean {
        return state.serverUrl.isNotEmpty() &&
               (state.apiToken.isNotEmpty() || state.apiKey.isNotEmpty())
    }

    /**
     * Check if configuration is valid.
     */
    fun isValidConfiguration(): Boolean {
        return state.serverUrl.isValidUrl() &&
               (state.apiToken.isNotEmpty() || state.apiKey.isNotEmpty()) &&
               state.organizationId.isNotEmpty()
    }

    /**
     * Apply default configuration.
     */
    fun applyDefaults() {
        state.serverUrl = "https://api.upm.com"
        state.realTimeAnalysisEnabled = true
        state.websocketEnabled = true
        state.buildPreventionEnabled = true
        state.vulnerabilityHighlightingEnabled = true
        state.policyCheckingEnabled = true
        state.analysisInterval = 30
        state.vulnerabilitySeverityThreshold = "medium"
        state.showNotifications = true
        state.showInlineWarnings = true
        state.highlightVulnerableDependencies = true
        state.cacheEnabled = true
        state.logLevel = "INFO"
        state.failBuildOnCriticalVulnerabilities = true
        state.notifyOnVulnerability = true
        state.notifyOnPolicyViolation = true

        LOG.info("Applied default configuration")
    }

    /**
     * Save configuration.
     */
    fun save() {
        // This will trigger persistence automatically
        UPMLogger.info("Configuration saved", mapOf(
            "serverUrl" to state.serverUrl,
            "hasToken" to state.apiToken.isNotEmpty(),
            "hasApiKey" to state.apiKey.isNotEmpty(),
            "organizationId" to state.organizationId
        ))
    }

    /**
     * Reset configuration to defaults.
     */
    fun reset() {
        state = State()
        save()
        LOG.info("Configuration reset to defaults")
    }

    /**
     * Save authentication token.
     */
    fun saveAuthToken(token: String) {
        state.apiToken = token
        state.lastSyncTime = System.currentTimeMillis()
        save()
    }

    /**
     * Clear authentication token.
     */
    fun clearAuthToken() {
        state.apiToken = ""
        save()
    }

    /**
     * Update server URL.
     */
    fun updateServerUrl(url: String) {
        state.serverUrl = url.trim().removeSuffix("/")
        save()
    }

    /**
     * Get API base URL.
     */
    fun getApiBaseUrl(): String = "${state.serverUrl}/api/v1"

    /**
     * Get WebSocket URL.
     */
    fun getWebSocketUrl(): String = "${state.serverUrl.replace("http", "ws")}/ws"

    /**
     * Check if severity meets threshold.
     */
    fun meetsSeverityThreshold(severity: String): Boolean {
        val levels = listOf("low", "medium", "high", "critical")
        val thresholdIndex = levels.indexOf(state.vulnerabilitySeverityThreshold.lowercase())
        val severityIndex = levels.indexOf(severity.lowercase())
        return severityIndex >= thresholdIndex
    }

    /**
     * Get connection timeout in milliseconds.
     */
    fun getConnectionTimeoutMs(): Long = state.connectionTimeout * 1000L

    /**
     * Get read timeout in milliseconds.
     */
    fun getReadTimeoutMs(): Long = state.readTimeout * 1000L

    /**
     * Update last analysis time.
     */
    fun updateLastAnalysisTime() {
        state.lastAnalysisTime = System.currentTimeMillis()
        save()
    }

    /**
     * Check if analysis should run.
     */
    fun shouldRunAnalysis(): Boolean {
        if (!state.realTimeAnalysisEnabled) return false

        val intervalMs = state.analysisInterval * 60 * 1000L
        val timeSinceLastAnalysis = System.currentTimeMillis() - state.lastAnalysisTime

        return timeSinceLastAnalysis >= intervalMs
    }

    /**
     * Get configuration as map for API calls.
     */
    fun toMap(): Map<String, Any> {
        return mapOf(
            "serverUrl" to state.serverUrl,
            "organizationId" to state.organizationId,
            "workspaceId" to state.workspaceId,
            "realTimeAnalysis" to state.realTimeAnalysisEnabled,
            "websocketEnabled" to state.websocketEnabled,
            "buildPrevention" to state.buildPreventionEnabled,
            "vulnerabilityThreshold" to state.vulnerabilitySeverityThreshold,
            "analysisInterval" to state.analysisInterval,
            "showNotifications" to state.showNotifications,
            "cacheEnabled" to state.cacheEnabled,
            "telemetryEnabled" to state.telemetryEnabled
        )
    }

    /**
     * Load configuration from map.
     */
    fun fromMap(config: Map<String, Any>) {
        config["serverUrl"]?.let { state.serverUrl = it.toString() }
        config["organizationId"]?.let { state.organizationId = it.toString() }
        config["workspaceId"]?.let { state.workspaceId = it.toString() }
        config["apiToken"]?.let { state.apiToken = it.toString() }
        config["apiKey"]?.let { state.apiKey = it.toString() }
        config["realTimeAnalysis"]?.let { state.realTimeAnalysisEnabled = it as Boolean }
        config["websocketEnabled"]?.let { state.websocketEnabled = it as Boolean }
        config["buildPrevention"]?.let { state.buildPreventionEnabled = it as Boolean }
        config["vulnerabilityThreshold"]?.let { state.vulnerabilitySeverityThreshold = it.toString() }
        config["analysisInterval"]?.let { state.analysisInterval = (it as Number).toInt() }
        config["showNotifications"]?.let { state.showNotifications = it as Boolean }
        config["cacheEnabled"]?.let { state.cacheEnabled = it as Boolean }
        config["telemetryEnabled"]?.let { state.telemetryEnabled = it as Boolean }

        save()
    }

    /**
     * Validate URL format.
     */
    private fun String.isValidUrl(): Boolean {
        return try {
            java.net.URL(this).protocol in listOf("http", "https")
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Get masked API token for logging.
     */
    fun getMaskedApiToken(): String {
        return if (state.apiToken.isEmpty()) {
            ""
        } else if (state.apiToken.length <= 8) {
            "*".repeat(state.apiToken.length)
        } else {
            state.apiToken.substring(0, 4) + "*".repeat(state.apiToken.length - 8) + state.apiToken.takeLast(4)
        }
    }

    /**
     * Get masked API key for logging.
     */
    fun getMaskedApiKey(): String {
        return if (state.apiKey.isEmpty()) {
            ""
        } else if (state.apiKey.length <= 8) {
            "*".repeat(state.apiKey.length)
        } else {
            state.apiKey.substring(0, 4) + "*".repeat(state.apiKey.length - 8) + state.apiKey.takeLast(4)
        }
    }
}
