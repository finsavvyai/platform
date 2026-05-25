package ai.lunaos.intellij.services

import ai.lunaos.intellij.settings.LunaSettingsState
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

@Service
class LunaApiClient {

    private val log = Logger.getInstance(LunaApiClient::class.java)
    private val gson = Gson()
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private fun baseUrl(): String =
        LunaSettingsState.getInstance().apiEndpoint.trimEnd('/')

    private fun authHeader(): String =
        "Bearer ${LunaSettingsState.getInstance().apiKey}"

    companion object {
        fun getInstance(): LunaApiClient =
            ApplicationManager.getApplication().getService(LunaApiClient::class.java)
    }

    fun fetchAgents(): List<Agent> {
        val req = get("/api/agents")
        return execute(req) { body ->
            val type = object : TypeToken<ApiResponse<List<Agent>>>() {}.type
            gson.fromJson<ApiResponse<List<Agent>>>(body, type).data ?: emptyList()
        }
    }

    fun runAgent(agentId: String, context: String): RunResult {
        val payload = gson.toJson(mapOf("agentId" to agentId, "context" to context))
        val req = post("/api/runs", payload)
        return execute(req) { body ->
            val type = object : TypeToken<ApiResponse<RunResult>>() {}.type
            gson.fromJson<ApiResponse<RunResult>>(body, type).data
                ?: throw IOException("Empty run result")
        }
    }

    fun fetchRuns(limit: Int = 20): List<RunSummary> {
        val req = get("/api/runs?limit=$limit")
        return execute(req) { body ->
            val type = object : TypeToken<ApiResponse<List<RunSummary>>>() {}.type
            gson.fromJson<ApiResponse<List<RunSummary>>>(body, type).data ?: emptyList()
        }
    }

    fun fetchRunLogs(runId: String): List<LogEntry> {
        val req = get("/api/runs/$runId/logs")
        return execute(req) { body ->
            val type = object : TypeToken<ApiResponse<List<LogEntry>>>() {}.type
            gson.fromJson<ApiResponse<List<LogEntry>>>(body, type).data ?: emptyList()
        }
    }

    fun executePipe(expression: String): PipeResult {
        val payload = gson.toJson(mapOf("expression" to expression))
        val req = post("/api/pipes/execute", payload)
        return execute(req) { body ->
            val type = object : TypeToken<ApiResponse<PipeResult>>() {}.type
            gson.fromJson<ApiResponse<PipeResult>>(body, type).data
                ?: throw IOException("Empty pipe result")
        }
    }

    fun analyzeCode(code: String, agentId: String): String {
        val payload = gson.toJson(mapOf("code" to code, "agentId" to agentId))
        val req = post("/api/analyze", payload)
        return execute(req) { body ->
            val type = object : TypeToken<ApiResponse<AnalysisResult>>() {}.type
            gson.fromJson<ApiResponse<AnalysisResult>>(body, type).data?.summary
                ?: "No results"
        }
    }

    fun testConnection(endpoint: String, key: String) {
        val req = Request.Builder()
            .url("${endpoint.trimEnd('/')}/health")
            .header("Authorization", "Bearer $key")
            .get().build()
        http.newCall(req).execute().use { res ->
            if (!res.isSuccessful) throw IOException("HTTP ${res.code}: ${res.message}")
        }
    }

    private fun get(path: String): Request = Request.Builder()
        .url("${baseUrl()}$path")
        .header("Authorization", authHeader())
        .header("Accept", "application/json")
        .get().build()

    private fun post(path: String, json: String): Request = Request.Builder()
        .url("${baseUrl()}$path")
        .header("Authorization", authHeader())
        .header("Content-Type", "application/json")
        .post(json.toRequestBody("application/json".toMediaType()))
        .build()

    private fun <T> execute(req: Request, parse: (String) -> T): T {
        http.newCall(req).execute().use { res ->
            val body = res.body?.string() ?: throw IOException("Empty response")
            if (!res.isSuccessful) {
                log.warn("API error ${res.code}: $body")
                throw IOException("API error ${res.code}: $body")
            }
            return parse(body)
        }
    }

    data class ApiResponse<T>(val data: T?, val error: String?)
    data class Agent(val id: String, val name: String, val description: String, val category: String, val tier: String)
    data class RunResult(val id: String, val status: String)
    data class RunSummary(val id: String, val agentName: String, val status: String, val startedAt: String, val durationMs: Long?)
    data class LogEntry(val level: String, val message: String, val timestamp: String)
    data class AnalysisResult(val summary: String, val issues: List<String>)
    data class PipeResult(val status: String, val output: String, val steps: List<StepResult>)
    data class StepResult(val command: String, val status: String, val durationMs: Long, val output: String)
}
