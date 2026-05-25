package com.upm.plugin

import com.intellij.openapi.application.ApplicationManager
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.upm.plugin.config.UPMConfig
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.BeforeEach

class UPMServiceManagerTest : BasePlatformTestCase() {

    private lateinit var serviceManager: UPMServiceManager

    @BeforeEach
    fun setUp() {
        serviceManager = UPMServiceManager.getInstance()
    }

    @Test
    fun `test service manager initialization`() {
        // Then
        assertNotNull(serviceManager)
        assertFalse(serviceManager.areServicesRunning())
        assertEquals(0, serviceManager.getServicesStatus()["serviceCount"])
    }

    @Test
    fun `test start services`() {
        // Given
        val config = UPMConfig.getInstance()
        config.applyDefaults()

        // When
        serviceManager.startServices()

        // Then
        assertTrue(serviceManager.areServicesRunning())
        assertTrue((serviceManager.getServicesStatus()["serviceCount"] as Int) > 0)

        // Cleanup
        serviceManager.stopServices()
    }

    @Test
    fun `test stop services`() {
        // Given
        serviceManager.startServices()
        assertTrue(serviceManager.areServicesRunning())

        // When
        serviceManager.stopServices()

        // Then
        assertFalse(serviceManager.areServicesRunning())
    }

    @Test
    fun `test service registration`() {
        // Given
        val testService = TestService()

        // When
        serviceManager.registerService(TestService::class.java, testService)

        // Then
        assertNotNull(serviceManager.getService(TestService::class.java))
        assertEquals(testService, serviceManager.getService(TestService::class.java))
    }

    @Test
    fun `test get services status`() {
        // Given
        serviceManager.registerService(TestService::class.java, TestService())

        // When
        val status = serviceManager.getServicesStatus()

        // Then
        assertTrue(status.containsKey("running"))
        assertTrue(status.containsKey("serviceCount"))
        assertTrue(status.containsKey("services"))
        assertEquals(1, status["serviceCount"])
    }

    @Test
    fun `test duplicate start services`() {
        // Given
        serviceManager.startServices()
        assertTrue(serviceManager.areServicesRunning())

        // When
        serviceManager.startServices() // Should not cause issues

        // Then
        assertTrue(serviceManager.areServicesRunning())

        // Cleanup
        serviceManager.stopServices()
    }

    // Test service class
    class TestService : Disposable {
        var disposed = false

        override fun dispose() {
            disposed = true
        }
    }
}

interface Disposable {
    fun dispose()
}
