package com.pgdesk.android.data.remote

import com.pgdesk.android.data.remote.dto.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // Connection Management
    @POST("api/v1/connections/test")
    suspend fun testConnection(@Body request: TestConnectionRequest): Response<TestConnectionResponse>

    @POST("api/v1/connections/validate")
    suspend fun validateConnection(@Body request: ValidateConnectionRequest): Response<ValidationResponse>

    // AI-Powered Query Generation
    @POST("api/v1/ai/query/generate")
    suspend fun generateQuery(@Body request: QueryGenerationRequest): Response<QueryGenerationResponse>

    @POST("api/v1/ai/query/optimize")
    suspend fun optimizeQuery(@Body request: QueryOptimizationRequest): Response<QueryOptimizationResponse>

    @POST("api/v1/ai/query/explain")
    suspend fun explainQuery(@Body request: QueryExplanationRequest): Response<QueryExplanationResponse>

    // Voice to SQL
    @POST("api/v1/ai/voice/transcribe")
    suspend fun transcribeAudio(@Body request: VoiceTranscriptionRequest): Response<VoiceTranscriptionResponse>

    @POST("api/v1/ai/voice/to-sql")
    suspend fun convertVoiceToSQL(@Body request: VoiceToSQLRequest): Response<VoiceToSQLResponse>

    // Natural Language Processing
    @POST("api/v1/ai/nlp/to-sql")
    suspend fun naturalLanguageToSQL(@Body request: NLPToSQLRequest): Response<NLPToSQLResponse>

    @POST("api/v1/ai/nlp/intent")
    suspend fun detectIntent(@Body request: IntentDetectionRequest): Response<IntentDetectionResponse>

    // Database Analysis & Insights
    @GET("api/v1/analysis/schema/{connectionId}")
    suspend fun getSchemaAnalysis(@Path("connectionId") connectionId: String): Response<SchemaAnalysisResponse>

    @GET("api/v1/analysis/performance/{connectionId}")
    suspend fun getPerformanceAnalysis(@Path("connectionId") connectionId: String): Response<PerformanceAnalysisResponse>

    @POST("api/v1/analysis/anomaly")
    suspend fun detectAnomalies(@Body request: AnomalyDetectionRequest): Response<AnomalyDetectionResponse>

    @GET("api/v1/analysis/insights/{connectionId}")
    suspend fun getAIInsights(@Path("connectionId") connectionId: String): Response<AIInsightsResponse>

    // Query Execution
    @POST("api/v1/query/execute")
    suspend fun executeQuery(@Body request: QueryExecutionRequest): Response<QueryExecutionResponse>

    @POST("api/v1/query/batch")
    suspend fun executeBatchQuery(@Body request: BatchQueryRequest): Response<BatchQueryResponse>

    @GET("api/v1/query/history/{connectionId}")
    suspend fun getQueryHistory(
        @Path("connectionId") connectionId: String,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0
    ): Response<QueryHistoryResponse>

    // Performance Monitoring
    @GET("api/v1/monitoring/metrics/{connectionId}")
    suspend fun getPerformanceMetrics(
        @Path("connectionId") connectionId: String,
        @Query("from") from: Long,
        @Query("to") to: Long
    ): Response<PerformanceMetricsResponse>

    @POST("api/v1/monitoring/alerts")
    suspend fun createAlert(@Body request: CreateAlertRequest): Response<CreateAlertResponse>

    @GET("api/v1/monitoring/alerts/{connectionId}")
    suspend fun getAlerts(@Path("connectionId") connectionId: String): Response<AlertsResponse>

    // Schema Management
    @GET("api/v1/schema/tables/{connectionId}")
    suspend fun getTables(@Path("connectionId") connectionId: String): Response<TablesResponse>

    @GET("api/v1/schema/table/{connectionId}/{tableName}")
    suspend fun getTableDetails(
        @Path("connectionId") connectionId: String,
        @Path("tableName") tableName: String
    ): Response<TableDetailsResponse>

    @GET("api/v1/schema/indexes/{connectionId}")
    suspend fun getIndexes(@Path("connectionId") connectionId: String): Response<IndexesResponse>

    @POST("api/v1/schema/recommend-indexes")
    suspend fun recommendIndexes(@Body request: IndexRecommendationRequest): Response<IndexRecommendationResponse>

    // Data Export/Import
    @POST("api/v1/data/export")
    suspend fun exportData(@Body request: DataExportRequest): Response<DataExportResponse>

    @POST("api/v1/data/import")
    suspend fun importData(@Body request: DataImportRequest): Response<DataImportResponse>

    // User Preferences & Settings
    @GET("api/v1/user/preferences")
    suspend fun getUserPreferences(): Response<UserPreferencesResponse>

    @PUT("api/v1/user/preferences")
    suspend fun updateUserPreferences(@Body request: UpdatePreferencesRequest): Response<UpdatePreferencesResponse>

    // Health Check
    @GET("api/v1/health")
    suspend fun healthCheck(): Response<HealthCheckResponse>

    @GET("api/v1/version")
    suspend fun getVersion(): Response<VersionResponse>

    // Machine Learning Models
    @POST("api/v1/ml/predict")
    suspend fun makePrediction(@Body request: PredictionRequest): Response<PredictionResponse>

    @GET("api/v1/ml/models")
    suspend fun getAvailableModels(): Response<ModelsResponse>

    // Real-time Features
    @GET("api/v1/realtime/status/{connectionId}")
    suspend fun getRealtimeStatus(@Path("connectionId") connectionId: String): Response<RealtimeStatusResponse>
}