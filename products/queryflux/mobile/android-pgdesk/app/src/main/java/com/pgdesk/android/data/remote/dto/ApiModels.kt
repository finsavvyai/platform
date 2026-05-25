package com.pgdesk.android.data.remote.dto

import com.google.gson.annotations.SerializedName
import java.util.Date

// Connection DTOs
data class TestConnectionRequest(
    val host: String,
    val port: Int,
    val database: String,
    val username: String,
    val password: String,
    val sslMode: String = "prefer",
    val timeout: Int = 30
)

data class TestConnectionResponse(
    val success: Boolean,
    val message: String,
    val latency: Long? = null,
    val serverVersion: String? = null,
    val connectionId: String? = null
)

data class ValidateConnectionRequest(
    val connectionConfig: TestConnectionRequest
)

data class ValidationResponse(
    val isValid: Boolean,
    val issues: List<ValidationIssue> = emptyList(),
    val recommendations: List<String> = emptyList()
)

data class ValidationIssue(
    val severity: String, // "error", "warning", "info"
    val message: String,
    val field: String? = null
)

// AI Query Generation DTOs
data class QueryGenerationRequest(
    val naturalLanguage: String,
    val connectionId: String,
    val context: QueryContext? = null,
    val preferences: QueryPreferences? = null
)

data class QueryGenerationResponse(
    val query: String,
    val explanation: String,
    val confidence: Double,
    val alternatives: List<AlternativeQuery> = emptyList(),
    val warnings: List<String> = emptyList(),
    val estimatedExecutionTime: Long? = null
)

data class QueryContext(
    val tables: List<String> = emptyList(),
    val recentQueries: List<String> = emptyList(),
    val userRole: String? = null
)

data class QueryPreferences(
    val performanceOptimized: Boolean = true,
    val readableFormat: Boolean = true,
    val includeComments: Boolean = false
)

data class AlternativeQuery(
    val query: String,
    val explanation: String,
    val confidence: Double,
    val performanceScore: Double? = null
)

// Query Optimization DTOs
data class QueryOptimizationRequest(
    val query: String,
    val connectionId: String,
    val analysisLevel: String = "detailed" // "basic", "detailed", "deep"
)

data class QueryOptimizationResponse(
    val originalQuery: String,
    val optimizedQuery: String,
    val improvements: List<QueryImprovement>,
    val performanceGain: Double? = null,
    val executionPlan: ExecutionPlan? = null
)

data class QueryImprovement(
    val type: String,
    val description: String,
    val impact: String, // "high", "medium", "low"
    val beforeAfter: BeforeAfter? = null
)

data class BeforeAfter(
    val before: String,
    val after: String
)

data class ExecutionPlan(
    val nodes: List<PlanNode>,
    val totalCost: Double,
    val estimatedRows: Long
)

data class PlanNode(
    val nodeType: String,
    val relation: String? = null,
    val cost: Double,
    val rows: Long,
    val width: Int,
    val children: List<PlanNode> = emptyList()
)

// Voice Processing DTOs
data class VoiceTranscriptionRequest(
    @SerializedName("audio_data")
    val audioData: String, // Base64 encoded audio
    val format: String = "wav",
    val language: String = "en-US"
)

data class VoiceTranscriptionResponse(
    val transcript: String,
    val confidence: Double,
    val alternatives: List<TranscriptAlternative> = emptyList()
)

data class TranscriptAlternative(
    val transcript: String,
    val confidence: Double
)

data class VoiceToSQLRequest(
    val transcript: String,
    val connectionId: String,
    val context: QueryContext? = null
)

data class VoiceToSQLResponse(
    val query: String,
    val explanation: String,
    val confidence: Double,
    val needsConfirmation: Boolean = false,
    val clarificationQuestions: List<String> = emptyList()
)

// Natural Language Processing DTOs
data class NLPToSQLRequest(
    val text: String,
    val connectionId: String,
    val context: QueryContext? = null
)

data class NLPToSQLResponse(
    val query: String,
    val explanation: String,
    val confidence: Double,
    val entities: List<ExtractedEntity> = emptyList(),
    val intent: String
)

data class ExtractedEntity(
    val type: String, // "table", "column", "value", "operation"
    val value: String,
    val confidence: Double
)

data class IntentDetectionRequest(
    val text: String,
    val context: Map<String, Any> = emptyMap()
)

data class IntentDetectionResponse(
    val intent: String,
    val confidence: Double,
    val entities: List<ExtractedEntity> = emptyList(),
    val suggestedActions: List<String> = emptyList()
)

// Analysis DTOs
data class SchemaAnalysisResponse(
    val tables: List<TableAnalysis>,
    val relationships: List<Relationship>,
    val indexes: List<IndexAnalysis>,
    val recommendations: List<SchemaRecommendation>,
    val healthScore: Double
)

data class TableAnalysis(
    val name: String,
    val rowCount: Long,
    val sizeBytes: Long,
    val columns: List<ColumnAnalysis>,
    val indexes: List<String>,
    val foreignKeys: List<String>,
    val primaryKey: String?,
    val lastAnalyzed: Date
)

data class ColumnAnalysis(
    val name: String,
    val type: String,
    val nullable: Boolean,
    val defaultValue: String?,
    val uniqueValues: Long? = null,
    val nullPercentage: Double? = null
)

data class Relationship(
    val fromTable: String,
    val toTable: String,
    val type: String, // "one-to-one", "one-to-many", "many-to-many"
    val confidence: Double
)

data class IndexAnalysis(
    val name: String,
    val table: String,
    val columns: List<String>,
    val type: String,
    val isUnique: Boolean,
    val sizeBytes: Long,
    val usageScore: Double
)

data class SchemaRecommendation(
    val type: String,
    val description: String,
    val impact: String,
    val implementation: String,
    val priority: Int
)

// Performance Analysis DTOs
data class PerformanceAnalysisResponse(
    val metrics: List<PerformanceMetricDto>,
    val trends: List<PerformanceTrend>,
    val bottlenecks: List<Bottleneck>,
    val recommendations: List<PerformanceRecommendation>
)

data class PerformanceMetricDto(
    val name: String,
    val value: Double,
    val unit: String,
    val timestamp: Date,
    val threshold: Double? = null,
    val status: String // "good", "warning", "critical"
)

data class PerformanceTrend(
    val metric: String,
    val direction: String, // "up", "down", "stable"
    val changePercentage: Double,
    val timeframe: String
)

data class Bottleneck(
    val type: String,
    val description: String,
    val severity: String,
    val suggestedFix: String
)

data class PerformanceRecommendation(
    val title: String,
    val description: String,
    val impact: String,
    val effort: String, // "low", "medium", "high"
    val category: String
)

// Query Execution DTOs
data class QueryExecutionRequest(
    val query: String,
    val connectionId: String,
    val limit: Int? = null,
    val timeout: Int = 30
)

data class QueryExecutionResponse(
    val success: Boolean,
    val data: QueryResult? = null,
    val error: String? = null,
    val executionTime: Long,
    val rowsAffected: Int,
    val queryId: String
)

data class QueryResult(
    val columns: List<ColumnInfo>,
    val rows: List<List<Any?>>,
    val totalRows: Long,
    val hasMore: Boolean = false
)

data class ColumnInfo(
    val name: String,
    val type: String,
    val nullable: Boolean
)

// Health Check DTOs
data class HealthCheckResponse(
    val status: String,
    val version: String,
    val uptime: Long,
    val services: Map<String, ServiceHealth>
)

data class ServiceHealth(
    val status: String,
    val responseTime: Long? = null,
    val lastCheck: Date
)

data class VersionResponse(
    val version: String,
    val buildDate: String,
    val gitCommit: String? = null
)

// Additional DTOs for completeness
data class AnomalyDetectionRequest(
    val connectionId: String,
    val timeRange: TimeRange,
    val metrics: List<String> = emptyList()
)

data class AnomalyDetectionResponse(
    val anomalies: List<Anomaly>,
    val confidence: Double,
    val analysisTimestamp: Date
)

data class Anomaly(
    val metric: String,
    val timestamp: Date,
    val value: Double,
    val expectedValue: Double,
    val severity: String,
    val description: String
)

data class TimeRange(
    val start: Date,
    val end: Date
)

data class AIInsightsResponse(
    val insights: List<AIInsightDto>,
    val summary: InsightSummary
)

data class AIInsightDto(
    val id: String,
    val type: String,
    val title: String,
    val description: String,
    val severity: String,
    val confidence: Double,
    val createdAt: Date,
    val metadata: Map<String, Any> = emptyMap()
)

data class InsightSummary(
    val totalInsights: Int,
    val criticalCount: Int,
    val warningCount: Int,
    val infoCount: Int,
    val lastUpdated: Date
)