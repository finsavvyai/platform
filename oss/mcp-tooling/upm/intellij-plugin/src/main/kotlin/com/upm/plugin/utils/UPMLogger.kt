package com.upm.plugin.utils

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import org.slf4j.LoggerFactory
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.*

/**
 * Enhanced logger for UPM plugin with structured logging capabilities.
 *
 * Provides:
 * - Structured logging with context
 * - Different log levels
 * - Project-specific logging
 * - Integration with both IntelliJ and SLF4J loggers
 * - Log aggregation for troubleshooting
 */
object UPMLogger {

    private val logger = LoggerFactory.getLogger(UPMLogger::class.java)
    private val intellijLogger = Logger.getInstance(UPMLogger::class.java)
    private val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS")

    private val logBuffer = Collections.synchronizedList mutableListOf<LogEntry>()
    private val maxBufferSize = 1000

    /**
     * Initialize the logger.
     */
    fun initialize() {
        logger.info("UPM Logger initialized")
        intellijLogger.info("UPM Logger initialized")
    }

    /**
     * Log debug message.
     */
    fun debug(message: String, context: Map<String, Any> = emptyMap()) {
        log(LogLevel.DEBUG, message, context, null)
    }

    /**
     * Log info message.
     */
    fun info(message: String, context: Map<String, Any> = emptyMap()) {
        log(LogLevel.INFO, message, context, null)
    }

    /**
     * Log warning message.
     */
    fun warn(message: String, context: Map<String, Any> = emptyMap()) {
        log(LogLevel.WARN, message, context, null)
    }

    /**
     * Log error message.
     */
    fun error(message: String, context: Map<String, Any> = emptyMap(), error: Throwable? = null) {
        log(LogLevel.ERROR, message, context, error)
    }

    /**
     * Log trace message.
     */
    fun trace(message: String, context: Map<String, Any> = emptyMap()) {
        log(LogLevel.TRACE, message, context, null)
    }

    /**
     * Log project-specific message.
     */
    fun projectLog(project: Project, level: LogLevel, message: String, context: Map<String, Any> = emptyMap()) {
        val projectContext = context + mapOf(
            "projectName" to project.name,
            "projectPath" to (project.basePath ?: "unknown"),
            "projectId" to project.locationHash
        )
        log(level, message, projectContext, null)
    }

    /**
     * Log API request.
     */
    fun logApiRequest(method: String, url: String, headers: Map<String, String> = emptyMap()) {
        val context = mapOf(
            "method" to method,
            "url" to url,
            "headers" to headers.filter { !it.key.contains("auth", ignoreCase = true) }
        )
        log(LogLevel.DEBUG, "API Request: $method $url", context, null)
    }

    /**
     * Log API response.
     */
    fun logApiResponse(method: String, url: String, statusCode: Int, duration: Long) {
        val context = mapOf(
            "method" to method,
            "url" to url,
            "statusCode" to statusCode,
            "duration" to duration
        )
        val level = if (statusCode < 400) LogLevel.INFO else LogLevel.WARN
        log(level, "API Response: $method $url - $statusCode (${duration}ms)", context, null)
    }

    /**
     * Log plugin event.
     */
    fun logEvent(event: String, data: Map<String, Any> = emptyMap()) {
        val context = mapOf("eventType" to "plugin_event") + data
        log(LogLevel.INFO, "Plugin Event: $event", context, null)
    }

    /**
     * Log performance metric.
     */
    fun logPerformance(operation: String, duration: Long, context: Map<String, Any> = emptyMap()) {
        val perfContext = context + mapOf(
            "operation" to operation,
            "duration" to duration,
            "unit" to "ms"
        )
        log(LogLevel.DEBUG, "Performance: $operation took ${duration}ms", perfContext, null)
    }

    /**
     * Log user action.
     */
    fun logUserAction(action: String, details: Map<String, Any> = emptyMap()) {
        val context = mapOf(
            "actionType" to "user_action",
            "timestamp" to System.currentTimeMillis()
        ) + details
        log(LogLevel.INFO, "User Action: $action", context, null)
    }

    /**
     * Get recent log entries.
     */
    fun getRecentLogs(count: Int = 100): List<LogEntry> {
        return synchronized(logBuffer) {
            logBuffer.takeLast(count)
        }
    }

    /**
     * Clear log buffer.
     */
    fun clearLogs() {
        synchronized(logBuffer) {
            logBuffer.clear()
        }
    }

    /**
     * Get log statistics.
     */
    fun getLogStatistics(): Map<String, Any> {
        return synchronized(logBuffer) {
            val levelCounts = logBuffer.groupingBy { it.level }.eachCount()
            mapOf(
                "totalLogs" to logBuffer.size,
                "levelCounts" to levelCounts,
                "lastLogTime" to logBuffer.lastOrNull()?.timestamp,
                "bufferSize" to logBuffer.size
            )
        }
    }

    /**
     * Internal logging method.
     */
    private fun log(level: LogLevel, message: String, context: Map<String, Any>, error: Throwable?) {
        val timestamp = LocalDateTime.now()
        val logEntry = LogEntry(
            timestamp = timestamp,
            level = level,
            message = message,
            context = context,
            error = error
        )

        // Add to buffer
        synchronized(logBuffer) {
            logBuffer.add(logEntry)
            if (logBuffer.size > maxBufferSize) {
                logBuffer.removeAt(0)
            }
        }

        // Format message
        val formattedMessage = formatMessage(logEntry)

        // Log to appropriate logger
        when (level) {
            LogLevel.TRACE -> {
                logger.trace(formattedMessage, error)
                intellijLogger.trace(formattedMessage)
            }
            LogLevel.DEBUG -> {
                logger.debug(formattedMessage, error)
                intellijLogger.debug(formattedMessage)
            }
            LogLevel.INFO -> {
                logger.info(formattedMessage, error)
                intellijLogger.info(formattedMessage)
            }
            LogLevel.WARN -> {
                logger.warn(formattedMessage, error)
                intellijLogger.warn(formattedMessage)
            }
            LogLevel.ERROR -> {
                logger.error(formattedMessage, error)
                intellijLogger.error(formattedMessage)
            }
        }
    }

    /**
     * Format log message with context.
     */
    private fun formatMessage(entry: LogEntry): String {
        val builder = StringBuilder()

        // Timestamp and level
        builder.append("[${entry.timestamp.format(formatter)}] [${entry.level}] ")

        // Message
        builder.append(entry.message)

        // Context
        if (entry.context.isNotEmpty()) {
            builder.append(" | Context: ")
            entry.context.entries.joinToString(", ") { "${it.key}=${it.value}" }
                .let { builder.append(it) }
        }

        return builder.toString()
    }
}

/**
 * Log entry data class.
 */
data class LogEntry(
    val timestamp: LocalDateTime,
    val level: LogLevel,
    val message: String,
    val context: Map<String, Any>,
    val error: Throwable?
)

/**
 * Log levels enum.
 */
enum class LogLevel {
    TRACE, DEBUG, INFO, WARN, ERROR
}

/**
 * Project-specific logger wrapper.
 */
class ProjectLogger(private val project: Project) {

    fun debug(message: String, context: Map<String, Any> = emptyMap()) {
        UPMLogger.projectLog(project, LogLevel.DEBUG, message, context)
    }

    fun info(message: String, context: Map<String, Any> = emptyMap()) {
        UPMLogger.projectLog(project, LogLevel.INFO, message, context)
    }

    fun warn(message: String, context: Map<String, Any> = emptyMap()) {
        UPMLogger.projectLog(project, LogLevel.WARN, message, context)
    }

    fun error(message: String, context: Map<String, Any> = emptyMap(), error: Throwable? = null) {
        UPMLogger.projectLog(project, LogLevel.ERROR, message, context, error)
    }
}

/**
 * Performance logger for measuring operation duration.
 */
class PerformanceLogger(private val operation: String) {
    private val startTime = System.currentTimeMillis()
    private val context = mutableMapOf<String, Any>()

    /**
     * Add context to the performance log.
     */
    fun addContext(key: String, value: Any): PerformanceLogger {
        context[key] = value
        return this
    }

    /**
     * Log the operation completion.
     */
    fun logCompletion(additionalContext: Map<String, Any> = emptyMap()) {
        val duration = System.currentTimeMillis() - startTime
        val allContext = context + additionalContext
        UPMLogger.logPerformance(operation, duration, allContext)
    }
}

/**
 * Timer utility for performance measurement.
 */
inline fun <T> measureTime(operation: String, context: Map<String, Any> = emptyMap, block: () -> T): T {
    val startTime = System.currentTimeMillis()
    val result = block()
    val duration = System.currentTimeMillis() - startTime
    UPMLogger.logPerformance(operation, duration, context)
    return result
}
