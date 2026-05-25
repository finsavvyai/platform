package com.upm.plugin

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.ApplicationComponent
import com.intellij.openapi.diagnostic.logger
import com.upm.plugin.api.*
import com.upm.plugin.config.UPMConfig
import com.upm.plugin.utils.UPMLogger
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Service manager for UPM plugin components.
 *
 * Manages the lifecycle of all plugin services:
 * - Dependency analysis services
 * - WebSocket communication
 * - Background tasks
 * - Cache management
 */
class UPMServiceManager : ApplicationComponent {

    companion object {
        private val LOG = logger<UPMServiceManager>()

        @Volatile
        private var instance: UPMServiceManager? = null

        fun getInstance(): UPMServiceManager {
            return instance ?: synchronized(this) {
                instance ?: UPMServiceManager().also { instance = it }
            }
        }
    }

    private val services = ConcurrentHashMap<Class<out Any>, Any>()
    private val servicesRunning = AtomicBoolean(false)

    override fun getComponentName(): String = "UPMServiceManager"

    override fun initComponent() {
        LOG.debug("Initializing Service Manager")
        instance = this
    }

    override fun disposeComponent() {
        stopServices()
        services.clear()
        instance = null
    }

    /**
     * Start all plugin services.
     */
    fun startServices() {
        if (servicesRunning.get()) {
            LOG.warn("Services already running")
            return
        }

        LOG.info("Starting UPM services")

        try {
            val config = UPMConfig.getInstance()

            // Initialize core services in order
            initializeDependencyAnalyzer()
            initializeVulnerabilityService()
            initializePolicyService()
            initializeWebSocketManager()
            initializeCacheManager()
            initializeTaskScheduler()

            servicesRunning.set(true)

            UPMLogger.info("All services started successfully")
            LOG.info("All UPM services started successfully")

        } catch (e: Exception) {
            LOG.error("Failed to start services", e)
            UPMLogger.error("Service startup failed", mapOf(
                "error" to e.message
            ))
            stopServices()
            throw e
        }
    }

    /**
     * Stop all plugin services.
     */
    fun stopServices() {
        if (!servicesRunning.get()) {
            return
        }

        LOG.info("Stopping UPM services")

        try {
            // Stop services in reverse order
            stopTaskScheduler()
            stopWebSocketManager()
            stopPolicyService()
            stopVulnerabilityService()
            stopDependencyAnalyzer()
            stopCacheManager()

            servicesRunning.set(false)

            UPMLogger.info("All services stopped")
            LOG.info("All UPM services stopped")

        } catch (e: Exception) {
            LOG.error("Error stopping services", e)
        }
    }

    /**
     * Get a registered service.
     */
    @Suppress("UNCHECKED_CAST")
    fun <T> getService(serviceClass: Class<T>): T? {
        return services[serviceClass] as? T
    }

    /**
     * Register a service.
     */
    fun <T> registerService(serviceClass: Class<T>, service: T) {
        services[serviceClass as Class<out Any>] = service
        LOG.debug("Registered service: ${serviceClass.simpleName}")
    }

    /**
     * Check if services are running.
     */
    fun areServicesRunning(): Boolean = servicesRunning.get()

    // Service initialization methods

    private fun initializeDependencyAnalyzer() {
        val analyzer = DefaultDependencyAnalyzer()
        registerService(DependencyAnalyzer::class.java, analyzer)
        LOG.debug("Dependency analyzer initialized")
    }

    private fun initializeVulnerabilityService() {
        val service = DefaultVulnerabilityService()
        registerService(VulnerabilityService::class.java, service)
        LOG.debug("Vulnerability service initialized")
    }

    private fun initializePolicyService() {
        val service = DefaultPolicyService()
        registerService(PolicyService::class.java, service)
        LOG.debug("Policy service initialized")
    }

    private fun initializeWebSocketManager() {
        val config = UPMConfig.getInstance()
        if (config.websocketEnabled) {
            val manager = DefaultWebSocketManager()
            registerService(WebSocketManager::class.java, manager)
            LOG.debug("WebSocket manager initialized")
        }
    }

    private fun initializeCacheManager() {
        val manager = DefaultCacheManager()
        registerService(CacheManager::class.java, manager)
        LOG.debug("Cache manager initialized")
    }

    private fun initializeTaskScheduler() {
        val scheduler = DefaultTaskScheduler()
        registerService(TaskScheduler::class.java, scheduler)
        LOG.debug("Task scheduler initialized")
    }

    // Service stopping methods

    private fun stopDependencyAnalyzer() {
        val analyzer = getService(DependencyAnalyzer::class.java)
        if (analyzer is Disposable) {
            analyzer.dispose()
        }
    }

    private fun stopVulnerabilityService() {
        val service = getService(VulnerabilityService::class.java)
        if (service is Disposable) {
            service.dispose()
        }
    }

    private fun stopPolicyService() {
        val service = getService(PolicyService::class.java)
        if (service is Disposable) {
            service.dispose()
        }
    }

    private fun stopWebSocketManager() {
        val manager = getService(WebSocketManager::class.java)
        if (manager is Disposable) {
            manager.dispose()
        }
    }

    private fun stopCacheManager() {
        val manager = getService(CacheManager::class.java)
        if (manager is Disposable) {
            manager.dispose()
        }
    }

    private fun stopTaskScheduler() {
        val scheduler = getService(TaskScheduler::class.java)
        if (scheduler is Disposable) {
            scheduler.dispose()
        }
    }

    /**
     * Get status of all services.
     */
    fun getServicesStatus(): Map<String, Any> {
        return mapOf(
            "running" to servicesRunning.get(),
            "serviceCount" to services.size,
            "services" to services.keys.map { it.simpleName }.sorted()
        )
    }
}
