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
import java.util.stream.Collectors;

/**
 * Maven plugin goal to setup cross-language bridges for UDP dependencies.
 * This goal generates bridge code for non-Java dependencies and sets up the runtime environment.
 */
@Mojo(
    name = "setup-bridges",
    defaultPhase = LifecyclePhase.GENERATE_SOURCES,
    requiresDependencyResolution = ResolutionScope.COMPILE
)
public class SetupBridgesMojo extends AbstractMojo {

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
     * Output directory for generated bridge code.
     */
    @Parameter(property = "udp.bridgeOutputDirectory", defaultValue = "${project.build.directory}/generated-sources/udp-bridges")
    private File bridgeOutputDirectory;

    /**
     * Skip bridge setup execution.
     */
    @Parameter(property = "udp.skip", defaultValue = "false")
    private boolean skip;

    /**
     * Force regeneration of bridge code even if it already exists.
     */
    @Parameter(property = "udp.forceRegenerate", defaultValue = "false")
    private boolean forceRegenerate;

    /**
     * Validate bridges after generation.
     */
    @Parameter(property = "udp.validateBridges", defaultValue = "true")
    private boolean validateBridges;

    @Override
    public void execute() throws MojoExecutionException, MojoFailureException {
        if (skip) {
            getLog().info("Skipping UDP bridge setup");
            return;
        }

        getLog().info("Setting up UDP cross-language bridges...");

        try {
            // Load UDP configuration
            UdpConfiguration config = loadConfiguration();

            // Get cross-language dependencies (non-Java dependencies)
            List<UdpConfiguration.DependencySpec> crossLanguageDeps = getCrossLanguageDependencies(config);

            if (crossLanguageDeps.isEmpty()) {
                getLog().info("No cross-language dependencies found, skipping bridge setup");
                return;
            }

            getLog().info("Found " + crossLanguageDeps.size() + " cross-language dependencies:");
            for (UdpConfiguration.DependencySpec dep : crossLanguageDeps) {
                getLog().info("  - " + dep.toString());
            }

            // Prepare output directory
            prepareOutputDirectory();

            // Generate bridge code via UDP service
            generateBridgeCode(config, crossLanguageDeps);

            // Add generated sources to Maven project
            addGeneratedSourcesToProject();

            // Validate bridges if requested
            if (validateBridges) {
                validateGeneratedBridges(crossLanguageDeps);
            }

            getLog().info("UDP bridge setup completed successfully");

        } catch (Exception e) {
            throw new MojoExecutionException("Failed to setup UDP bridges", e);
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

    private List<UdpConfiguration.DependencySpec> getCrossLanguageDependencies(UdpConfiguration config) {
        return config.getAllDependencies().stream()
                .filter(dep -> !isJavaDependency(dep))
                .filter(dep -> config.isBridgeEnabled(dep.getEcosystem()))
                .collect(Collectors.toList());
    }

    private boolean isJavaDependency(UdpConfiguration.DependencySpec dep) {
        String ecosystem = dep.getEcosystem();
        return "maven".equals(ecosystem) || "java".equals(ecosystem) || "gradle".equals(ecosystem);
    }

    private void prepareOutputDirectory() throws IOException {
        if (bridgeOutputDirectory.exists() && forceRegenerate) {
            getLog().info("Cleaning existing bridge output directory: " + bridgeOutputDirectory.getAbsolutePath());
            FileUtils.deleteDirectory(bridgeOutputDirectory);
        }

        if (!bridgeOutputDirectory.exists()) {
            boolean created = bridgeOutputDirectory.mkdirs();
            if (!created) {
                throw new IOException("Failed to create bridge output directory: " + bridgeOutputDirectory.getAbsolutePath());
            }
        }
    }

    private void generateBridgeCode(UdpConfiguration config, List<UdpConfiguration.DependencySpec> crossLanguageDeps)
            throws IOException {
        getLog().info("Generating bridge code via UDP service...");

        UdpApiClient apiClient = new UdpApiClient(config.getUdpService(), getLog());

        try {
            // Check UDP service health first
            if (!apiClient.checkHealth()) {
                throw new IOException("UDP service is not healthy. Please ensure the UDP service is running at: " +
                    config.getUdpService().getUrl());
            }

            // Generate bridge code
            JsonNode response = apiClient.generateBridges(crossLanguageDeps, bridgeOutputDirectory.getAbsolutePath());

            if (response.has("success") && response.get("success").asBoolean()) {
                getLog().info("Bridge generation completed successfully");

                if (response.has("generated_files")) {
                    JsonNode files = response.get("generated_files");
                    getLog().info("Generated " + files.size() + " bridge files:");
                    for (JsonNode file : files) {
                        getLog().info("  - " + file.asText());
                    }
                }

                if (response.has("warnings")) {
                    JsonNode warnings = response.get("warnings");
                    for (JsonNode warning : warnings) {
                        getLog().warn("Bridge generation warning: " + warning.asText());
                    }
                }

            } else {
                String errorMsg = response.has("error") ? response.get("error").asText() : "Unknown error";
                throw new IOException("Bridge generation failed: " + errorMsg);
            }

        } finally {
            apiClient.close();
        }
    }

    private void addGeneratedSourcesToProject() {
        // Add generated bridge sources to Maven project compilation path
        String sourcePath = bridgeOutputDirectory.getAbsolutePath();
        project.addCompileSourceRoot(sourcePath);

        getLog().info("Added generated bridge sources to compilation path: " + sourcePath);
    }

    private void validateGeneratedBridges(List<UdpConfiguration.DependencySpec> crossLanguageDeps) {
        getLog().info("Validating generated bridge code...");

        // Check that bridge files were actually generated
        File[] generatedFiles = bridgeOutputDirectory.listFiles();
        if (generatedFiles == null || generatedFiles.length == 0) {
            getLog().warn("No bridge files were generated in: " + bridgeOutputDirectory.getAbsolutePath());
            return;
        }

        // Validate each cross-language dependency has corresponding bridge
        for (UdpConfiguration.DependencySpec dep : crossLanguageDeps) {
            String expectedBridgeFile = getBridgeFileName(dep);
            File bridgeFile = new File(bridgeOutputDirectory, expectedBridgeFile);

            if (!bridgeFile.exists()) {
                getLog().warn("Bridge file not found for dependency: " + dep.toString() +
                    " (expected: " + expectedBridgeFile + ")");
            } else {
                getLog().debug("Validated bridge file for " + dep.getName() + ": " + bridgeFile.getName());
            }
        }

        getLog().info("Bridge validation completed");
    }

    private String getBridgeFileName(UdpConfiguration.DependencySpec dep) {
        // Generate expected bridge file name based on dependency
        String ecosystem = dep.getEcosystem();
        String safeName = dep.getName().replaceAll("[^a-zA-Z0-9_]", "_");

        return String.format("udp/bridges/%s/%s.java", ecosystem,
            safeName.substring(0, 1).toUpperCase() + safeName.substring(1));
    }
}