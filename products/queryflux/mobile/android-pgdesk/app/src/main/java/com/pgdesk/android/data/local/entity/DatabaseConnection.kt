package com.pgdesk.android.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import java.util.Date

@Entity(tableName = "database_connections")
@Parcelize
data class DatabaseConnection(
    @PrimaryKey
    val id: String,
    val name: String,
    val host: String,
    val port: Int,
    val database: String,
    val username: String,
    val encryptedPassword: String, // Encrypted using Android Keystore
    val sslMode: String = "prefer",
    val color: String = "#2196F3", // Material Blue
    val isActive: Boolean = false,
    val lastConnected: Date? = null,
    val createdAt: Date = Date(),
    val updatedAt: Date = Date(),
    val connectionTimeout: Int = 30,
    val maxPoolSize: Int = 10,
    val tags: List<String> = emptyList(),
    val environment: String = "development", // development, staging, production
    val isFavorite: Boolean = false,
    val aiOptimizationEnabled: Boolean = true,
    val performanceMonitoring: Boolean = true,
    val backupEnabled: Boolean = false,
    val description: String? = null
) : Parcelable

@Entity(tableName = "query_history")
data class QueryHistory(
    @PrimaryKey
    val id: String,
    val connectionId: String,
    val query: String,
    val executionTime: Long, // milliseconds
    val rowsAffected: Int,
    val isSuccessful: Boolean,
    val error: String? = null,
    val executedAt: Date = Date(),
    val queryType: QueryType = QueryType.SELECT,
    val aiGenerated: Boolean = false,
    val voiceInput: Boolean = false,
    val optimizationSuggestions: List<String> = emptyList()
)

@Entity(tableName = "query_templates")
data class QueryTemplate(
    @PrimaryKey
    val id: String,
    val name: String,
    val query: String,
    val description: String? = null,
    val category: String = "custom",
    val tags: List<String> = emptyList(),
    val isShared: Boolean = false,
    val createdAt: Date = Date(),
    val usageCount: Int = 0,
    val aiGenerated: Boolean = false,
    val parameters: List<QueryParameter> = emptyList()
)

@Entity(tableName = "performance_metrics")
data class PerformanceMetric(
    @PrimaryKey
    val id: String,
    val connectionId: String,
    val metricType: MetricType,
    val value: Double,
    val unit: String,
    val timestamp: Date = Date(),
    val threshold: Double? = null,
    val isAlert: Boolean = false,
    val metadata: Map<String, String> = emptyMap()
)

@Entity(tableName = "ai_insights")
data class AIInsight(
    @PrimaryKey
    val id: String,
    val connectionId: String? = null,
    val insightType: InsightType,
    val title: String,
    val description: String,
    val severity: InsightSeverity = InsightSeverity.INFO,
    val recommendation: String? = null,
    val confidence: Double, // 0.0 to 1.0
    val createdAt: Date = Date(),
    val isRead: Boolean = false,
    val actionTaken: Boolean = false,
    val metadata: Map<String, Any> = emptyMap()
)

@Entity(tableName = "user_preferences")
data class UserPreference(
    @PrimaryKey
    val key: String,
    val value: String,
    val type: PreferenceType = PreferenceType.STRING,
    val updatedAt: Date = Date()
)

@Entity(tableName = "cached_queries")
data class CachedQuery(
    @PrimaryKey
    val id: String,
    val connectionId: String,
    val query: String,
    val result: String, // JSON serialized result
    val cachedAt: Date = Date(),
    val expiresAt: Date,
    val hitCount: Int = 0,
    val isValid: Boolean = true
)

@Entity(tableName = "security_profiles")
data class SecurityProfile(
    @PrimaryKey
    val id: String,
    val connectionId: String,
    val certificatePinning: Boolean = true,
    val encryptionLevel: EncryptionLevel = EncryptionLevel.AES_256,
    val biometricRequired: Boolean = false,
    val sessionTimeout: Int = 30, // minutes
    val maxFailedAttempts: Int = 3,
    val auditLogging: Boolean = true,
    val createdAt: Date = Date(),
    val updatedAt: Date = Date()
)

// Supporting data classes
@Parcelize
data class QueryParameter(
    val name: String,
    val type: String,
    val defaultValue: String? = null,
    val required: Boolean = true,
    val description: String? = null
) : Parcelable

enum class QueryType {
    SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, TRUNCATE, VACUUM, ANALYZE, EXPLAIN
}

enum class MetricType {
    CONNECTION_COUNT, ACTIVE_QUERIES, CPU_USAGE, MEMORY_USAGE, DISK_IO,
    CACHE_HIT_RATE, TRANSACTION_RATE, ERROR_RATE, RESPONSE_TIME, DEADLOCKS
}

enum class InsightType {
    PERFORMANCE_OPTIMIZATION, SECURITY_RECOMMENDATION, SCHEMA_IMPROVEMENT,
    QUERY_OPTIMIZATION, INDEX_SUGGESTION, RESOURCE_USAGE, ANOMALY_DETECTION,
    COST_OPTIMIZATION, BACKUP_REMINDER, UPDATE_AVAILABLE
}

enum class InsightSeverity {
    INFO, WARNING, CRITICAL, SUCCESS
}

enum class PreferenceType {
    STRING, INT, BOOLEAN, FLOAT, JSON
}

enum class EncryptionLevel {
    AES_128, AES_192, AES_256, RSA_2048, RSA_4096
}