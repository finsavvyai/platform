package com.udp.maven.mojos;

import com.fasterxml.jackson.databind.JsonNode;
import com.udp.maven.UdpApiClient;
import com.udp.maven.UdpConfiguration;
import org.apache.commons.io.FileUtils;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.*;
import org.apache.maven.project.MavenProject;

import java.io.File;
import java.io.IOException;
import java.util.List;

/**
 * Maven plugin goal to analyze dependencies using UDP service.
 * This goal performs comprehensive dependency analysis including vulnerabilities, licensing, and compliance.
 */
@Mojo(
    name = "analyze",
    defaultPhase = LifecyclePhase.VERIFY,
    requiresDependencyResolution = ResolutionScope.COMPILE_PLUS_RUNTIME
)
public class AnalyzeMojo extends AbstractMojo {

    /**
     * The Maven project instance.
     */
    @Parameter(defaultValue = "${project}", readonly = true, required = true)
    private MavenProject project;

    /**
     * Path to the UDP configuration file (udp.yml).
     */
    @Parameter(property = "udp.configFile", defaultValue = "${project.basedir}/udp.yml")
    private File configFile;

    /**
     * Output directory for analysis reports.
     */
    @Parameter(property = "udp.reportsDirectory", defaultValue = "${project.build.directory}/udp-reports")
    private File reportsDirectory;

    /**
     * Skip analysis execution.
     */
    @Parameter(property = "udp.skip", defaultValue = "false")
    private boolean skip;

    /**
     * Fail build on high severity vulnerabilities.
     */
    @Parameter(property = "udp.failOnHighSeverity", defaultValue = "false")
    private boolean failOnHighSeverity;

    /**
     * Fail build on critical severity vulnerabilities.
     */
    @Parameter(property = "udp.failOnCriticalSeverity", defaultValue = "true")
    private boolean failOnCriticalSeverity;

    /**
     * Include transitive dependencies in analysis.
     */
    @Parameter(property = "udp.includeTransitive", defaultValue = "true")
    private boolean includeTransitive;

    /**
     * Generate detailed analysis report.
     */
    @Parameter(property = "udp.generateDetailedReport", defaultValue = "true")
    private boolean generateDetailedReport;

    /**
     * Include dependency graph analysis.
     */
    @Parameter(property = "udp.includeDependencyGraph", defaultValue = "true")
    private boolean includeDependencyGraph;

    @Override
    public void execute() throws MojoExecutionException, MojoFailureException {
        if (skip) {
            getLog().info("Skipping UDP dependency analysis");
            return;
        }

        getLog().info("Analyzing dependencies using UDP service...");

        try {
            // Load UDP configuration
            UdpConfiguration config = loadConfiguration();

            // Get all dependencies for analysis
            List<UdpConfiguration.DependencySpec> dependencies = config.getAllDependencies();

            if (dependencies.isEmpty()) {
                getLog().info("No dependencies found to analyze");
                return;
            }

            getLog().info("Analyzing " + dependencies.size() + " dependencies:");
            for (UdpConfiguration.DependencySpec dep : dependencies) {
                getLog().info("  - " + dep.toString());
            }

            // Prepare reports directory
            prepareReportsDirectory();

            // Perform comprehensive analysis
            performVulnerabilityAnalysis(config, dependencies);
            performDependencyAnalysis(config, dependencies);

            if (includeDependencyGraph) {
                performDependencyGraphAnalysis(config, dependencies);
            }

            // Generate analytics overview
            generateAnalyticsOverview(config);

            getLog().info("UDP dependency analysis completed successfully");
            getLog().info("Analysis reports available in: " + reportsDirectory.getAbsolutePath());

        } catch (Exception e) {
            throw new MojoExecutionException("Failed to analyze dependencies", e);
        }
    }

    private UdpConfiguration loadConfiguration() throws IOException {
        if (!configFile.exists()) {
            throw new IOException("UDP configuration file not found: " + configFile.getAbsolutePath() +
                "\nPlease create a udp.yml file in your project root or specify the path using -Dudp.configFile=<path>");
        }

        getLog().debug("Loading UDP configuration from: " + configFile.getAbsolutePath());
        return UdpConfiguration.load(configFile);
    }

    private void prepareReportsDirectory() throws IOException {
        if (!reportsDirectory.exists()) {
            boolean created = reportsDirectory.mkdirs();
            if (!created) {
                throw new IOException("Failed to create reports directory: " + reportsDirectory.getAbsolutePath());
            }
        }
    }

    private void performVulnerabilityAnalysis(UdpConfiguration config, List<UdpConfiguration.DependencySpec> dependencies)
            throws IOException, MojoFailureException {
        getLog().info("Performing vulnerability analysis...");

        UdpApiClient apiClient = new UdpApiClient(config.getUdpService(), getLog());

        try {
            // Check UDP service health first
            if (!apiClient.checkHealth()) {
                throw new IOException("UDP service is not healthy. Please ensure the UDP service is running at: " +
                    config.getUdpService().getUrl());
            }

            // Get vulnerability analysis
            JsonNode response = apiClient.getVulnerabilities(dependencies);

            if (response.has("vulnerabilities")) {
                JsonNode vulnerabilities = response.get("vulnerabilities");
                procesVulnerabilityResults(vulnerabilities);
            }

            // Save vulnerability report
            saveVulnerabilityReport(response);

        } finally {
            apiClient.close();
        }
    }

    private void procesVulnerabilityResults(JsonNode vulnerabilities) throws MojoFailureException {
        int total = vulnerabilities.size();
        int critical = 0;
        int high = 0;
        int medium = 0;
        int low = 0;

        getLog().info("Found " + total + " vulnerabilities:");

        for (JsonNode vuln : vulnerabilities) {
            String severity = vuln.get("severity").asText().toLowerCase();
            String packageName = vuln.get("package_name").asText();
            String vulnId = vuln.get("vulnerability_id").asText();
            String title = vuln.has("title") ? vuln.get("title").asText() : "Unknown vulnerability";

            switch (severity) {
                case "critical":
                    critical++;
                    getLog().error("CRITICAL: " + packageName + " - " + vulnId + ": " + title);
                    break;
                case "high":
                    high++;
                    getLog().warn("HIGH: " + packageName + " - " + vulnId + ": " + title);
                    break;
                case "medium":
                    medium++;
                    getLog().warn("MEDIUM: " + packageName + " - " + vulnId + ": " + title);
                    break;
                case "low":
                    low++;
                    getLog().info("LOW: " + packageName + " - " + vulnId + ": " + title);
                    break;
            }
        }

        getLog().info("Vulnerability summary: " + critical + " critical, " + high + " high, " +
            medium + " medium, " + low + " low");

        // Check if we should fail the build
        if (failOnCriticalSeverity && critical > 0) {
            throw new MojoFailureException("Build failed due to " + critical + " critical severity vulnerabilities");
        }

        if (failOnHighSeverity && high > 0) {
            throw new MojoFailureException("Build failed due to " + high + " high severity vulnerabilities");
        }
    }

    private void saveVulnerabilityReport(JsonNode response) throws IOException {
        File reportFile = new File(reportsDirectory, "vulnerability-report.json");
        FileUtils.writeStringToFile(reportFile, response.toPrettyString(), "UTF-8");
        getLog().info("Vulnerability report saved to: " + reportFile.getAbsolutePath());
    }

    private void performDependencyAnalysis(UdpConfiguration config, List<UdpConfiguration.DependencySpec> dependencies)
            throws IOException {
        getLog().info("Performing dependency resolution analysis...");

        UdpApiClient apiClient = new UdpApiClient(config.getUdpService(), getLog());

        try {
            // Validate dependencies
            JsonNode validationResponse = apiClient.validateDependencies(dependencies);
            saveValidationReport(validationResponse);

            // Resolve dependencies
            JsonNode resolutionResponse = apiClient.resolveDependencies(dependencies);
            saveResolutionReport(resolutionResponse);

            // Process resolution results
            processResolutionResults(resolutionResponse);

        } finally {
            apiClient.close();
        }
    }

    private void processResolutionResults(JsonNode response) {
        if (response.has("success") && response.get("success").asBoolean()) {
            if (response.has("resolved_packages")) {
                int resolvedCount = response.get("resolved_packages").size();
                getLog().info("Successfully resolved " + resolvedCount + " packages");
            }

            if (response.has("conflicts") && response.get("conflicts").size() > 0) {
                JsonNode conflicts = response.get("conflicts");
                getLog().warn("Found " + conflicts.size() + " dependency conflicts:");
                for (JsonNode conflict : conflicts) {
                    getLog().warn("  - " + conflict.get("description").asText());
                }
            }

            if (response.has("resolution_time")) {
                double resolutionTime = response.get("resolution_time").asDouble();
                getLog().info("Resolution completed in " + String.format("%.2f", resolutionTime) + " seconds");
            }
        } else {
            String errorMsg = response.has("error") ? response.get("error").asText() : "Unknown error";
            getLog().error("Dependency resolution failed: " + errorMsg);
        }
    }

    private void saveValidationReport(JsonNode response) throws IOException {
        File reportFile = new File(reportsDirectory, "validation-report.json");
        FileUtils.writeStringToFile(reportFile, response.toPrettyString(), "UTF-8");
        getLog().debug("Validation report saved to: " + reportFile.getAbsolutePath());
    }

    private void saveResolutionReport(JsonNode response) throws IOException {
        File reportFile = new File(reportsDirectory, "resolution-report.json");
        FileUtils.writeStringToFile(reportFile, response.toPrettyString(), "UTF-8");
        getLog().debug("Resolution report saved to: " + reportFile.getAbsolutePath());
    }

    private void performDependencyGraphAnalysis(UdpConfiguration config, List<UdpConfiguration.DependencySpec> dependencies)
            throws IOException {
        getLog().info("Performing dependency graph analysis...");

        // This would call UDP's graph analysis endpoints
        // For now, we'll create a placeholder report
        generateDependencyGraphReport(dependencies);
    }

    private void generateDependencyGraphReport(List<UdpConfiguration.DependencySpec> dependencies) throws IOException {
        StringBuilder report = new StringBuilder();
        report.append("# Dependency Graph Analysis Report\n\n");
        report.append("Generated: ").append(new java.util.Date()).append("\n");
        report.append("Project: ").append(project.getName()).append("\n");
        report.append("Version: ").append(project.getVersion()).append("\n\n");

        report.append("## Dependencies by Ecosystem\n\n");

        // Group dependencies by ecosystem
        java.util.Map<String, java.util.List<UdpConfiguration.DependencySpec>> byEcosystem =
            dependencies.stream().collect(
                java.util.stream.Collectors.groupingBy(UdpConfiguration.DependencySpec::getEcosystem)
            );

        for (java.util.Map.Entry<String, java.util.List<UdpConfiguration.DependencySpec>> entry : byEcosystem.entrySet()) {
            report.append("### ").append(entry.getKey().toUpperCase()).append("\n\n");
            for (UdpConfiguration.DependencySpec dep : entry.getValue()) {
                report.append("- ").append(dep.getName()).append(" v").append(dep.getVersion());
                if (dep.getBridge() != null) {
                    report.append(" (bridge: ").append(dep.getBridge()).append(")");
                }
                report.append("\n");
            }
            report.append("\n");
        }

        File reportFile = new File(reportsDirectory, "dependency-graph.md");
        FileUtils.writeStringToFile(reportFile, report.toString(), "UTF-8");
        getLog().info("Dependency graph report saved to: " + reportFile.getAbsolutePath());
    }

    private void generateAnalyticsOverview(UdpConfiguration config) throws IOException {
        getLog().info("Generating analytics overview...");

        UdpApiClient apiClient = new UdpApiClient(config.getUdpService(), getLog());

        try {
            // Get analytics overview from UDP service
            JsonNode analyticsResponse = apiClient.getAnalytics();

            // Save analytics report
            File reportFile = new File(reportsDirectory, "analytics-overview.json");
            FileUtils.writeStringToFile(reportFile, analyticsResponse.toPrettyString(), "UTF-8");
            getLog().info("Analytics overview saved to: " + reportFile.getAbsolutePath());

            // Log key metrics
            if (analyticsResponse.has("package_statistics")) {
                JsonNode packageStats = analyticsResponse.get("package_statistics");
                if (packageStats.has("total_packages")) {
                    getLog().info("Total packages tracked: " + packageStats.get("total_packages").asInt());
                }
            }

            if (analyticsResponse.has("vulnerability_statistics")) {
                JsonNode vulnStats = analyticsResponse.get("vulnerability_statistics");
                if (vulnStats.has("total_vulnerabilities")) {
                    getLog().info("Total vulnerabilities tracked: " + vulnStats.get("total_vulnerabilities").asInt());
                }
            }

        } catch (Exception e) {
            getLog().warn("Failed to generate analytics overview: " + e.getMessage());
        } finally {
            apiClient.close();
        }
    }
}