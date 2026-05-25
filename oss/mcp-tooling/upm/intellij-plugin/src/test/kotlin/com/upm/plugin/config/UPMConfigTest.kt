package com.upm.plugin.config

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach

class UPMConfigTest {

    private lateinit var config: UPMConfig

    @BeforeEach
    fun setUp() {
        config = UPMConfig()
        config.loadState(UPMConfig.State())
    }

    @Test
    fun `test default configuration`() {
        // Given
        config.applyDefaults()

        // Then
        assertEquals("https://api.upm.com", config.getState().serverUrl)
        assertTrue(config.getState().realTimeAnalysisEnabled)
        assertTrue(config.getState().websocketEnabled)
        assertTrue(config.getState().buildPreventionEnabled)
        assertEquals("medium", config.getState().vulnerabilitySeverityThreshold)
        assertEquals(30, config.getState().analysisInterval)
    }

    @Test
    fun `test configuration validation`() {
        // Given
        config.updateServerUrl("https://test.upm.com")
        config.getState().apiToken = "test-token-123"
        config.getState().organizationId = "org-123"

        // Then
        assertTrue(config.isConfigured())
        assertTrue(config.isValidConfiguration())
    }

    @Test
    fun `test invalid configuration`() {
        // Given
        config.updateServerUrl("invalid-url")
        config.getState().apiToken = ""

        // Then
        assertFalse(config.isConfigured())
        assertFalse(config.isValidConfiguration())
    }

    @Test
    fun `test API token management`() {
        // Given
        val token = "test-api-token"

        // When
        config.saveAuthToken(token)

        // Then
        assertEquals(token, config.getState().apiToken)
        assertTrue(config.getState().lastSyncTime > 0)

        // When
        config.clearAuthToken()

        // Then
        assertEquals("", config.getState().apiToken)
    }

    @Test
    fun `test severity threshold filtering`() {
        // Given
        config.getState().vulnerabilitySeverityThreshold = "high"

        // Then
        assertFalse(config.meetsSeverityThreshold("low"))
        assertFalse(config.meetsSeverityThreshold("medium"))
        assertTrue(config.meetsSeverityThreshold("high"))
        assertTrue(config.meetsSeverityThreshold("critical"))
    }

    @Test
    fun `test analysis scheduling`() {
        // Given
        config.getState().analysisInterval = 60 // 1 hour
        config.getState().lastAnalysisTime = System.currentTimeMillis() - 30 * 60 * 1000 // 30 minutes ago

        // Then
        assertFalse(config.shouldRunAnalysis())

        // When
        config.getState().lastAnalysisTime = System.currentTimeMillis() - 2 * 60 * 60 * 1000 // 2 hours ago

        // Then
        assertTrue(config.shouldRunAnalysis())
    }

    @Test
    fun `test configuration serialization`() {
        // Given
        config.updateServerUrl("https://test.upm.com")
        config.getState().apiToken = "test-token"
        config.getState().realTimeAnalysisEnabled = false

        // When
        val configMap = config.toMap()

        // Then
        assertEquals("https://test.upm.com", configMap["serverUrl"])
        assertEquals(false, configMap["realTimeAnalysis"])

        // When
        val newConfig = UPMConfig()
        newConfig.loadState(UPMConfig.State())
        newConfig.fromMap(configMap)

        // Then
        assertEquals(config.getState().serverUrl, newConfig.getState().serverUrl)
        assertEquals(config.getState().realTimeAnalysisEnabled, newConfig.getState().realTimeAnalysisEnabled)
    }

    @Test
    fun `test masked API token for logging`() {
        // Given
        config.getState().apiToken = "12345678-abcd-1234-efgh-123456789012"

        // When
        val masked = config.getMaskedApiToken()

        // Then
        assertEquals("1234************9012", masked)
    }

    @Test
    fun `test URL validation`() {
        // Valid URLs
        assertTrue("https://api.upm.com".isValidUrl())
        assertTrue("http://localhost:8080".isValidUrl())

        // Invalid URLs
        assertFalse("invalid-url".isValidUrl())
        assertFalse("ftp://example.com".isValidUrl())
    }

    @Test
    fun `test timeout conversions`() {
        // Given
        config.getState().connectionTimeout = 30
        config.getState().readTimeout = 60

        // Then
        assertEquals(30000L, config.getConnectionTimeoutMs())
        assertEquals(60000L, config.getReadTimeoutMs())
    }

    @Test
    fun `test reset configuration`() {
        // Given
        config.updateServerUrl("https://custom.upm.com")
        config.getState().apiToken = "custom-token"
        config.getState().realTimeAnalysisEnabled = false

        // When
        config.reset()

        // Then
        assertEquals("https://api.upm.com", config.getState().serverUrl)
        assertEquals("", config.getState().apiToken)
        assertTrue(config.getState().realTimeAnalysisEnabled)
    }
}

// Extension function for URL validation
private fun String.isValidUrl(): Boolean {
    return try {
        java.net.URL(this).protocol in listOf("http", "https")
    } catch (e: Exception) {
        false
    }
}
