package com.udp.maven;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.apache.maven.plugin.logging.Log;
import org.apache.commons.lang3.StringUtils;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * HTTP client for communicating with UDP service REST API.
 * Handles authentication, request/response processing, and error handling.
 */
public class UdpApiClient {

    private static final String API_V1_PREFIX = "/api/v1";
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiKey;
    private final String organizationId;
    private final Log log;

    public UdpApiClient(UdpConfiguration.UdpServiceConfig config, Log log) {
        this.baseUrl = config.getUrl();
        this.apiKey = config.getApiKey();
        this.organizationId = config.getOrganizationId();
        this.log = log;
        this.objectMapper = new ObjectMapper();

        // Configure HTTP client with timeouts and retry behavior
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(config.getTimeout(), TimeUnit.SECONDS)
                .readTimeout(config.getTimeout(), TimeUnit.SECONDS)
                .writeTimeout(config.getTimeout(), TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build();
    }

    /**
     * Check UDP service health.
     */
    public boolean checkHealth() {
        try {
            Request request = new Request.Builder()
                    .url(baseUrl + "/health/")
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful()) {
                    log.info("UDP service is healthy");
                    return true;
                } else {
                    log.warn("UDP service health check failed: " + response.code());
                    return false;
                }
            }
        } catch (IOException e) {
            log.error("Failed to check UDP service health: " + e.getMessage());
            return false;
        }
    }

    /**
     * Get supported ecosystems from UDP service.
     */
    public JsonNode getSupportedEcosystems() throws IOException {
        Request request = buildAuthenticatedRequest()
                .url(baseUrl + API_V1_PREFIX + "/dependencies/ecosystems/supported")
                .get()
                .build();

        return executeRequest(request);
    }

    /**
     * Resolve dependencies using UDP service.
     */
    public JsonNode resolveDependencies(List<UdpConfiguration.DependencySpec> dependencies) throws IOException {
        log.info("Resolving " + dependencies.size() + " dependencies through UDP service");

        // Build resolution request
        String requestBody = buildResolutionRequest(dependencies);

        Request request = buildAuthenticatedRequest()
                .url(baseUrl + API_V1_PREFIX + "/resolution/resolve")
                .post(RequestBody.create(requestBody, JSON))
                .build();

        return executeRequest(request);
    }

    /**
     * Validate dependency graph without resolving.
     */
    public JsonNode validateDependencies(List<UdpConfiguration.DependencySpec> dependencies) throws IOException {
        log.info("Validating " + dependencies.size() + " dependencies through UDP service");

        String requestBody = buildResolutionRequest(dependencies);

        Request request = buildAuthenticatedRequest()
                .url(baseUrl + API_V1_PREFIX + "/resolution/validate")
                .post(RequestBody.create(requestBody, JSON))
                .build();

        return executeRequest(request);
    }

    /**
     * Get dependency analytics for the organization.
     */
    public JsonNode getAnalytics() throws IOException {
        if (StringUtils.isBlank(organizationId)) {
            throw new IllegalStateException("Organization ID is required for analytics");
        }

        Request request = buildAuthenticatedRequest()
                .url(baseUrl + API_V1_PREFIX + "/analytics/overview?organization_id=" + organizationId)
                .get()
                .build();

        return executeRequest(request);
    }

    /**
     * Download cross-language dependencies.
     */
    public JsonNode downloadDependencies(List<UdpConfiguration.DependencySpec> dependencies, String targetPath) throws IOException {
        log.info("Downloading dependencies to: " + targetPath);

        String requestBody = buildDownloadRequest(dependencies, targetPath);

        Request request = buildAuthenticatedRequest()
                .url(baseUrl + API_V1_PREFIX + "/dependencies/download")
                .post(RequestBody.create(requestBody, JSON))
                .build();

        return executeRequest(request);
    }

    /**
     * Generate bridge code for cross-language dependencies.
     */
    public JsonNode generateBridges(List<UdpConfiguration.DependencySpec> crossLanguageDeps, String outputPath) throws IOException {
        log.info("Generating bridge code for cross-language dependencies");

        String requestBody = buildBridgeGenerationRequest(crossLanguageDeps, outputPath);

        Request request = buildAuthenticatedRequest()
                .url(baseUrl + API_V1_PREFIX + "/dependencies/generate-bridges")
                .post(RequestBody.create(requestBody, JSON))
                .build();

        return executeRequest(request);
    }

    /**
     * Get security vulnerabilities for dependencies.
     */
    public JsonNode getVulnerabilities(List<UdpConfiguration.DependencySpec> dependencies) throws IOException {
        String requestBody = buildVulnerabilityRequest(dependencies);

        Request request = buildAuthenticatedRequest()
                .url(baseUrl + API_V1_PREFIX + "/security/vulnerabilities/scan")
                .post(RequestBody.create(requestBody, JSON))
                .build();

        return executeRequest(request);
    }

    // Private helper methods

    private Request.Builder buildAuthenticatedRequest() {
        Request.Builder builder = new Request.Builder()
                .addHeader("User-Agent", "UDP-Maven-Plugin/1.0.0")
                .addHeader("Content-Type", "application/json");

        if (StringUtils.isNotBlank(apiKey)) {
            builder.addHeader("Authorization", "Bearer " + apiKey);
        }

        return builder;
    }

    private JsonNode executeRequest(Request request) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";

            if (!response.isSuccessful()) {
                String errorMsg = String.format("UDP API request failed: %d %s - %s",
                        response.code(), response.message(), responseBody);
                throw new IOException(errorMsg);
            }

            if (StringUtils.isBlank(responseBody)) {
                throw new IOException("Empty response from UDP service");
            }

            return objectMapper.readTree(responseBody);
        }
    }

    private String buildResolutionRequest(List<UdpConfiguration.DependencySpec> dependencies) throws IOException {
        // Convert dependencies to API request format
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"requested_packages\": [");

        boolean first = true;
        for (UdpConfiguration.DependencySpec dep : dependencies) {
            if (!first) json.append(",");
            json.append("{");
            json.append("\"name\": \"").append(dep.getName()).append("\",");
            json.append("\"version\": \"").append(dep.getVersion()).append("\",");
            json.append("\"ecosystem\": \"").append(dep.getEcosystem()).append("\"");
            json.append("}");
            first = false;
        }

        json.append("],");
        json.append("\"strategy\": \"CONSERVATIVE\"");

        if (StringUtils.isNotBlank(organizationId)) {
            json.append(",\"organization_id\": \"").append(organizationId).append("\"");
        }

        json.append("}");
        return json.toString();
    }

    private String buildDownloadRequest(List<UdpConfiguration.DependencySpec> dependencies, String targetPath) throws IOException {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"dependencies\": [");

        boolean first = true;
        for (UdpConfiguration.DependencySpec dep : dependencies) {
            if (!first) json.append(",");
            json.append("{");
            json.append("\"name\": \"").append(dep.getName()).append("\",");
            json.append("\"version\": \"").append(dep.getVersion()).append("\",");
            json.append("\"ecosystem\": \"").append(dep.getEcosystem()).append("\"");
            if (dep.getBridge() != null) {
                json.append(",\"bridge\": \"").append(dep.getBridge()).append("\"");
            }
            json.append("}");
            first = false;
        }

        json.append("],");
        json.append("\"target_path\": \"").append(targetPath).append("\"");

        if (StringUtils.isNotBlank(organizationId)) {
            json.append(",\"organization_id\": \"").append(organizationId).append("\"");
        }

        json.append("}");
        return json.toString();
    }

    private String buildBridgeGenerationRequest(List<UdpConfiguration.DependencySpec> dependencies, String outputPath) throws IOException {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"cross_language_dependencies\": [");

        boolean first = true;
        for (UdpConfiguration.DependencySpec dep : dependencies) {
            // Only include non-native dependencies that need bridges
            if (!"maven".equals(dep.getEcosystem()) && !"java".equals(dep.getEcosystem())) {
                if (!first) json.append(",");
                json.append("{");
                json.append("\"name\": \"").append(dep.getName()).append("\",");
                json.append("\"version\": \"").append(dep.getVersion()).append("\",");
                json.append("\"ecosystem\": \"").append(dep.getEcosystem()).append("\",");
                json.append("\"target_language\": \"java\"");
                if (dep.getBridge() != null) {
                    json.append(",\"bridge_type\": \"").append(dep.getBridge()).append("\"");
                }
                json.append("}");
                first = false;
            }
        }

        json.append("],");
        json.append("\"output_path\": \"").append(outputPath).append("\"");

        if (StringUtils.isNotBlank(organizationId)) {
            json.append(",\"organization_id\": \"").append(organizationId).append("\"");
        }

        json.append("}");
        return json.toString();
    }

    private String buildVulnerabilityRequest(List<UdpConfiguration.DependencySpec> dependencies) throws IOException {
        StringBuilder json = new StringBuilder();
        json.append("{");
        json.append("\"dependencies\": [");

        boolean first = true;
        for (UdpConfiguration.DependencySpec dep : dependencies) {
            if (!first) json.append(",");
            json.append("{");
            json.append("\"name\": \"").append(dep.getName()).append("\",");
            json.append("\"version\": \"").append(dep.getVersion()).append("\",");
            json.append("\"ecosystem\": \"").append(dep.getEcosystem()).append("\"");
            json.append("}");
            first = false;
        }

        json.append("]");

        if (StringUtils.isNotBlank(organizationId)) {
            json.append(",\"organization_id\": \"").append(organizationId).append("\"");
        }

        json.append("}");
        return json.toString();
    }

    /**
     * Close the HTTP client and release resources.
     */
    public void close() {
        if (httpClient != null) {
            httpClient.dispatcher().executorService().shutdown();
            httpClient.connectionPool().evictAll();
        }
    }
}