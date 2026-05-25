package com.upm.plugin.api

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
import com.intellij.openapi.diagnostic.logger
import com.intellij.util.io.HttpRequests
import com.upm.plugin.config.UPMConfig
import com.upm.plugin.utils.UPMLogger
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.io.IOException
import java.net.URI
import java.time.Duration
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * REST API client for communicating with UPM backend.
 *
 * Handles:
 * - HTTP requests to UPM API endpoints
 * - WebSocket connections for real-time updates
 * - Authentication and authorization
 * - Error handling and retry logic
 */
class UPMRestApiClient private constructor() {

    companion object {
        private val LOG = logger<UPMRestApiClient>()

        @Volatile
        private var instance: UPMRestApiClient? = null

        fun getInstance(): UPMRestApiClient {
            return instance ?: synchronized(this) {
                instance ?: UPMRestApiClient().also { instance = it }
            }
        }
    }

    private val gson: Gson = GsonBuilder()
        .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
        .create()

    private val httpClient: OkHttpClient
    private val config: UPMConfig = UPMConfig.getInstance()
    private val isConnected = AtomicBoolean(false)
    private val listeners = CopyOnWriteArrayList<UPMRestApiListener>()

    private var webSocketClient: WebSocketClient? = null
    private val executor = Executors.newScheduledThreadPool(4)

    init {
        val builder = OkHttpClient.Builder()
            .connectTimeout(Duration.ofSeconds(30))
            .readTimeout(Duration.ofSeconds(60))
            .writeTimeout(Duration.ofSeconds(60))
            .retryOnConnectionFailure(true)

        // Configure SSL if needed
        if (config.ignoreSslErrors) {
            configureInsecureSsl(builder)
        }

        // Add authentication interceptor
        builder.addInterceptor(AuthInterceptor())

        // Add logging interceptor
        builder.addInterceptor(LoggingInterceptor())

        httpClient = builder.build()
    }

    // API Endpoint Methods

    /**
     * Authenticate with the backend.
     */
    suspend fun authenticate(credentials: AuthCredentials): AuthResult {
        return try {
            val json = gson.toJson(credentials)
            val body = json.toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("${config.serverUrl}/api/v1/auth/login")
                .post(body)
                .build()

            val response = httpClient.newCall(request).execute()

            if (response.isSuccessful) {
                val authResponse = gson.fromJson(
                    response.body?.string(),
                    AuthResponse::class.java
                )
                config.saveAuthToken(authResponse.token)
                isConnected.set(true)

                UPMLogger.info("Authentication successful")
                AuthResult.Success(authResponse.token, authResponse.user)
            } else {
                val error = parseError(response)
                UPMLogger.error("Authentication failed", mapOf("error" to error.message))
                AuthResult.Error(error.message, response.code)
            }
        } catch (e: Exception) {
            LOG.error("Authentication error", e)
            UPMLogger.error("Authentication error", mapOf("error" to e.message))
            AuthResult.Error(e.message ?: "Unknown error", 0)
        }
    }

    /**
     * Analyze project dependencies.
     */
    suspend fun analyzeDependencies(projectId: String): DependencyAnalysisResult {
        return try {
            val request = Request.Builder()
                .url("${config.serverUrl}/api/v1/dependencies/analyze")
                .addHeader("X-Project-ID", projectId)
                .get()
                .build()

            val response = httpClient.newCall(request).execute()

            if (response.isSuccessful) {
                val result = gson.fromJson(
                    response.body?.string(),
                    DependencyAnalysisResult::class.java
                )
                notifyListeners { onDependenciesAnalyzed(result) }
                result
            } else {
                throw UPMApiException("Failed to analyze dependencies: ${response.code}", response.code)
            }
        } catch (e: Exception) {
            LOG.error("Dependency analysis failed", e)
            throw e
        }
    }

    /**
     * Get vulnerabilities for a project.
     */
    suspend fun getVulnerabilities(projectId: String): List<Vulnerability> {
        return try {
            val request = Request.Builder()
                .url("${config.serverUrl}/api/v1/vulnerabilities?project_id=$projectId")
                .get()
                .build()

            val response = httpClient.newCall(request).execute()

            if (response.isSuccessful) {
                val type = object : TypeToken<List<Vulnerability>>() {}.type
                val vulnerabilities = gson.fromJson<List<Vulnerability>>(response.body?.string(), type)
                notifyListeners { onVulnerabilitiesReceived(vulnerabilities) }
                vulnerabilities
            } else {
                throw UPMApiException("Failed to get vulnerabilities: ${response.code}", response.code)
            }
        } catch (e: Exception) {
            LOG.error("Failed to get vulnerabilities", e)
            throw e
        }
    }

    /**
     * Get policy violations for a project.
     */
    suspend fun getPolicyViolations(projectId: String): List<PolicyViolation> {
        return try {
            val request = Request.Builder()
                .url("${config.serverUrl}/api/v1/violations?project_id=$projectId")
                .get()
                .build()

            val response = httpClient.newCall(request).execute()

            if (response.isSuccessful) {
                val type = object : TypeToken<List<PolicyViolation>>() {}.type
                val violations = gson.fromJson<List<PolicyViolation>>(response.body?.string(), type)
                notifyListeners { onPolicyViolationsReceived(violations) }
                violations
            } else {
                throw UPMApiException("Failed to get policy violations: ${response.code}", response.code)
            }
        } catch (e: Exception) {
            LOG.error("Failed to get policy violations", e)
            throw e
        }
    }

    /**
     * Submit exception request for a policy violation.
     */
    suspend fun submitExceptionRequest(violationId: String, reason: String): ExceptionRequest {
        return try {
            val requestJson = gson.toJson(mapOf(
                "violation_id" to violationId,
                "reason" to reason,
                "exception_type" to "TEMPORARY"
            ))

            val body = requestJson.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("${config.serverUrl}/api/v1/exceptions")
                .post(body)
                .build()

            val response = httpClient.newCall(request).execute()

            if (response.isSuccessful) {
                val exception = gson.fromJson(
                    response.body?.string(),
                    ExceptionRequest::class.java
                )
                notifyListeners { onExceptionRequestSubmitted(exception) }
                exception
            } else {
                throw UPMApiException("Failed to submit exception request: ${response.code}", response.code)
            }
        } catch (e: Exception) {
            LOG.error("Failed to submit exception request", e)
            throw e
        }
    }

    // WebSocket Methods

    /**
     * Connect to WebSocket for real-time updates.
     */
    fun connectWebSocket() {
        if (webSocketClient?.isOpen == true) {
            LOG.debug("WebSocket already connected")
            return
        }

        try {
            val wsUrl = "${config.serverUrl.replace("http", "ws")}/ws/ide"
            webSocketClient = object : WebSocketClient(URI.create(wsUrl)) {
                override fun onOpen(handshake: ServerHandshake) {
                    LOG.info("WebSocket connected")
                    isConnected.set(true)
                    notifyListeners { onWebSocketConnected() }

                    // Send authentication message
                    sendAuthentication()
                }

                override fun onMessage(message: String) {
                    handleWebSocketMessage(message)
                }

                override fun onClose(code: Int, reason: String, remote: Boolean) {
                    LOG.info("WebSocket closed: $code - $reason")
                    isConnected.set(false)
                    notifyListeners { onWebSocketDisconnected(code, reason) }

                    // Schedule reconnection
                    scheduleReconnection()
                }

                override fun onError(ex: Exception) {
                    LOG.error("WebSocket error", ex)
                    notifyListeners { onWebSocketError(ex) }
                }
            }

            webSocketClient?.connect()

        } catch (e: Exception) {
            LOG.error("Failed to connect WebSocket", e)
            notifyListeners { onWebSocketError(e) }
        }
    }

    /**
     * Disconnect from WebSocket.
     */
    fun disconnectWebSocket() {
        webSocketClient?.close()
        webSocketClient = null
        isConnected.set(false)
    }

    // Listener Management

    /**
     * Add API listener.
     */
    fun addListener(listener: UPMRestApiListener) {
        listeners.add(listener)
    }

    /**
     * Remove API listener.
     */
    fun removeListener(listener: UPMRestApiListener) {
        listeners.remove(listener)
    }

    /**
     * Check if connected to backend.
     */
    fun isConnected(): Boolean = isConnected.get()

    // Private Helper Methods

    private fun sendAuthentication() {
        val token = config.apiToken
        if (token.isNotEmpty()) {
            val authMessage = gson.toJson(mapOf(
                "type" to "auth",
                "token" to token
            ))
            webSocketClient?.send(authMessage)
        }
    }

    private fun handleWebSocketMessage(message: String) {
        try {
            val update = gson.fromJson(message, UPMUpdate::class.java)
            notifyListeners { onRealTimeUpdate(update) }
        } catch (e: Exception) {
            LOG.error("Failed to parse WebSocket message: $message", e)
        }
    }

    private fun scheduleReconnection() {
        executor.schedule({
            if (config.websocketEnabled) {
                LOG.info("Attempting to reconnect WebSocket")
                connectWebSocket()
            }
        }, 30, TimeUnit.SECONDS)
    }

    private fun parseError(response: Response): ApiError {
        return try {
            gson.fromJson(response.body?.string(), ApiError::class.java)
        } catch (e: Exception) {
            ApiError("Unknown error", response.code)
        }
    }

    private fun configureInsecureSsl(builder: OkHttpClient.Builder) {
        try {
            val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
                override fun checkClientTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) {}
                override fun checkServerTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) {}
                override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf()
            })

            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(null, trustAllCerts, java.security.SecureRandom())

            builder.sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
            builder.hostnameVerifier { _, _ -> true }

        } catch (e: Exception) {
            LOG.error("Failed to configure insecure SSL", e)
        }
    }

    private fun notifyListeners(notification: (UPMRestApiListener) -> Unit) {
        listeners.forEach { listener ->
            try {
                notification(listener)
            } catch (e: Exception) {
                LOG.error("Error notifying listener", e)
            }
        }
    }

    // Interceptors

    private inner class AuthInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val token = config.apiToken

            return if (token.isNotEmpty()) {
                val authenticatedRequest = request.newBuilder()
                    .addHeader("Authorization", "Bearer $token")
                    .build()
                chain.proceed(authenticatedRequest)
            } else {
                chain.proceed(request)
            }
        }
    }

    private inner class LoggingInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val startTime = System.currentTimeMillis()

            try {
                val response = chain.proceed(request)
                val endTime = System.currentTimeMillis()

                LOG.debug("API Request: ${request.method} ${request.url} - ${response.code} (${endTime - startTime}ms)")

                return response
            } catch (e: Exception) {
                val endTime = System.currentTimeMillis()
                LOG.error("API Request Failed: ${request.method} ${request.url} (${endTime - startTime}ms)", e)
                throw e
            }
        }
    }
}

// Data Classes

data class AuthCredentials(
    val username: String,
    val password: String,
    val apiKey: String? = null
)

data class AuthResponse(
    val token: String,
    val user: UserInfo,
    val expiresIn: Long
)

data class UserInfo(
    val id: String,
    val username: String,
    val email: String,
    val roles: List<String>
)

sealed class AuthResult {
    data class Success(val token: String, val user: UserInfo) : AuthResult()
    data class Error(val message: String, val code: Int) : AuthResult()
}

data class ApiError(
    val message: String,
    val code: Int,
    val details: Map<String, Any>? = null
)

class UPMApiException(message: String, val code: Int) : Exception(message)

interface UPMRestApiListener {
    fun onDependenciesAnalyzed(result: DependencyAnalysisResult) {}
    fun onVulnerabilitiesReceived(vulnerabilities: List<Vulnerability>) {}
    fun onPolicyViolationsReceived(violations: List<PolicyViolation>) {}
    fun onExceptionRequestSubmitted(request: ExceptionRequest) {}
    fun onWebSocketConnected() {}
    fun onWebSocketDisconnected(code: Int, reason: String) {}
    fun onWebSocketError(error: Exception) {}
    fun onRealTimeUpdate(update: UPMUpdate) {}
}
