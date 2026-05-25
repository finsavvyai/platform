package com.udp.maven;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.apache.commons.lang3.StringUtils;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Configuration class for UDP (udp.yml) file parsing.
 * Represents the structure of the universal dependency configuration.
 */
public class UdpConfiguration {

    @JsonProperty("project")
    private String project;

    @JsonProperty("target_language")
    private String targetLanguage;

    @JsonProperty("java_version")
    private String javaVersion;

    @JsonProperty("dependencies")
    private Dependencies dependencies = new Dependencies();

    @JsonProperty("bridges")
    private Map<String, BridgeConfig> bridges = new HashMap<>();

    @JsonProperty("performance")
    private PerformanceConfig performance = new PerformanceConfig();

    @JsonProperty("udp_service")
    private UdpServiceConfig udpService = new UdpServiceConfig();

    // Getters and setters
    public String getProject() { return project; }
    public void setProject(String project) { this.project = project; }

    public String getTargetLanguage() { return targetLanguage; }
    public void setTargetLanguage(String targetLanguage) { this.targetLanguage = targetLanguage; }

    public String getJavaVersion() { return javaVersion; }
    public void setJavaVersion(String javaVersion) { this.javaVersion = javaVersion; }

    public Dependencies getDependencies() { return dependencies; }
    public void setDependencies(Dependencies dependencies) { this.dependencies = dependencies; }

    public Map<String, BridgeConfig> getBridges() { return bridges; }
    public void setBridges(Map<String, BridgeConfig> bridges) { this.bridges = bridges; }

    public PerformanceConfig getPerformance() { return performance; }
    public void setPerformance(PerformanceConfig performance) { this.performance = performance; }

    public UdpServiceConfig getUdpService() { return udpService; }
    public void setUdpService(UdpServiceConfig udpService) { this.udpService = udpService; }

    /**
     * Load configuration from udp.yml file.
     */
    public static UdpConfiguration load(File configFile) throws IOException {
        if (!configFile.exists()) {
            throw new IOException("UDP configuration file not found: " + configFile.getAbsolutePath());
        }

        ObjectMapper mapper = new ObjectMapper(new YAMLFactory());
        return mapper.readValue(configFile, UdpConfiguration.class);
    }

    /**
     * Get all dependencies across all ecosystems.
     */
    public List<DependencySpec> getAllDependencies() {
        List<DependencySpec> allDeps = new ArrayList<>();

        // Add Java dependencies
        if (dependencies.getJava() != null) {
            for (String dep : dependencies.getJava()) {
                allDeps.add(DependencySpec.fromString(dep, "maven"));
            }
        }

        // Add Python dependencies
        if (dependencies.getPython() != null) {
            for (String dep : dependencies.getPython()) {
                allDeps.add(DependencySpec.fromString(dep, "pypi"));
            }
        }

        // Add JavaScript dependencies
        if (dependencies.getJavascript() != null) {
            for (String dep : dependencies.getJavascript()) {
                allDeps.add(DependencySpec.fromString(dep, "npm"));
            }
        }

        // Add Rust dependencies
        if (dependencies.getRust() != null) {
            for (String dep : dependencies.getRust()) {
                allDeps.add(DependencySpec.fromString(dep, "cargo"));
            }
        }

        // Add generic dependencies
        if (dependencies.getGeneric() != null) {
            allDeps.addAll(dependencies.getGeneric());
        }

        return allDeps;
    }

    /**
     * Check if bridges are enabled for the given ecosystem.
     */
    public boolean isBridgeEnabled(String ecosystem) {
        BridgeConfig config = bridges.get(ecosystem);
        return config != null && config.isEnabled();
    }

    /**
     * Dependencies configuration structure.
     */
    public static class Dependencies {
        @JsonProperty("java")
        private List<String> java = new ArrayList<>();

        @JsonProperty("python")
        private List<String> python = new ArrayList<>();

        @JsonProperty("javascript")
        private List<String> javascript = new ArrayList<>();

        @JsonProperty("rust")
        private List<String> rust = new ArrayList<>();

        @JsonProperty("generic")
        private List<DependencySpec> generic = new ArrayList<>();

        // Getters and setters
        public List<String> getJava() { return java; }
        public void setJava(List<String> java) { this.java = java; }

        public List<String> getPython() { return python; }
        public void setPython(List<String> python) { this.python = python; }

        public List<String> getJavascript() { return javascript; }
        public void setJavascript(List<String> javascript) { this.javascript = javascript; }

        public List<String> getRust() { return rust; }
        public void setRust(List<String> rust) { this.rust = rust; }

        public List<DependencySpec> getGeneric() { return generic; }
        public void setGeneric(List<DependencySpec> generic) { this.generic = generic; }
    }

    /**
     * Bridge configuration for cross-language dependencies.
     */
    public static class BridgeConfig {
        @JsonProperty("enabled")
        private boolean enabled = true;

        @JsonProperty("runtime")
        private String runtime;

        @JsonProperty("version")
        private String version;

        @JsonProperty("dependencies_path")
        private String dependenciesPath;

        @JsonProperty("target")
        private String target;

        // Getters and setters
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }

        public String getRuntime() { return runtime; }
        public void setRuntime(String runtime) { this.runtime = runtime; }

        public String getVersion() { return version; }
        public void setVersion(String version) { this.version = version; }

        public String getDependenciesPath() { return dependenciesPath; }
        public void setDependenciesPath(String dependenciesPath) { this.dependenciesPath = dependenciesPath; }

        public String getTarget() { return target; }
        public void setTarget(String target) { this.target = target; }
    }

    /**
     * Performance optimization configuration.
     */
    public static class PerformanceConfig {
        @JsonProperty("preload_bridges")
        private boolean preloadBridges = true;

        @JsonProperty("cache_modules")
        private boolean cacheModules = true;

        @JsonProperty("parallel_loading")
        private boolean parallelLoading = true;

        @JsonProperty("cache_directory")
        private String cacheDirectory = ".udp/cache";

        // Getters and setters
        public boolean isPreloadBridges() { return preloadBridges; }
        public void setPreloadBridges(boolean preloadBridges) { this.preloadBridges = preloadBridges; }

        public boolean isCacheModules() { return cacheModules; }
        public void setCacheModules(boolean cacheModules) { this.cacheModules = cacheModules; }

        public boolean isParallelLoading() { return parallelLoading; }
        public void setParallelLoading(boolean parallelLoading) { this.parallelLoading = parallelLoading; }

        public String getCacheDirectory() { return cacheDirectory; }
        public void setCacheDirectory(String cacheDirectory) { this.cacheDirectory = cacheDirectory; }
    }

    /**
     * UDP service configuration.
     */
    public static class UdpServiceConfig {
        @JsonProperty("url")
        private String url = "http://localhost:8040";

        @JsonProperty("api_key")
        private String apiKey;

        @JsonProperty("organization_id")
        private String organizationId;

        @JsonProperty("timeout")
        private int timeout = 30;

        @JsonProperty("retry_count")
        private int retryCount = 3;

        // Getters and setters
        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }

        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }

        public String getOrganizationId() { return organizationId; }
        public void setOrganizationId(String organizationId) { this.organizationId = organizationId; }

        public int getTimeout() { return timeout; }
        public void setTimeout(int timeout) { this.timeout = timeout; }

        public int getRetryCount() { return retryCount; }
        public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
    }

    /**
     * Dependency specification with ecosystem information.
     */
    public static class DependencySpec {
        @JsonProperty("name")
        private String name;

        @JsonProperty("version")
        private String version;

        @JsonProperty("ecosystem")
        private String ecosystem;

        @JsonProperty("bridge")
        private String bridge;

        @JsonProperty("optional")
        private boolean optional = false;

        public DependencySpec() {}

        public DependencySpec(String name, String version, String ecosystem) {
            this.name = name;
            this.version = version;
            this.ecosystem = ecosystem;
        }

        /**
         * Parse dependency from string format (e.g., "org.apache.commons:commons-lang3:3.12.0").
         */
        public static DependencySpec fromString(String depString, String ecosystem) {
            if (StringUtils.isBlank(depString)) {
                throw new IllegalArgumentException("Dependency string cannot be blank");
            }

            String[] parts = depString.split(":");
            if (parts.length < 2) {
                throw new IllegalArgumentException("Invalid dependency format: " + depString);
            }

            String name = parts.length == 3 ? parts[0] + ":" + parts[1] : parts[0];
            String version = parts.length == 3 ? parts[2] : parts[1];

            return new DependencySpec(name, version, ecosystem);
        }

        // Getters and setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getVersion() { return version; }
        public void setVersion(String version) { this.version = version; }

        public String getEcosystem() { return ecosystem; }
        public void setEcosystem(String ecosystem) { this.ecosystem = ecosystem; }

        public String getBridge() { return bridge; }
        public void setBridge(String bridge) { this.bridge = bridge; }

        public boolean isOptional() { return optional; }
        public void setOptional(boolean optional) { this.optional = optional; }

        @Override
        public String toString() {
            return String.format("%s:%s@%s (%s)", name, version, ecosystem, bridge != null ? bridge : "direct");
        }
    }
}