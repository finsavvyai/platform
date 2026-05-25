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
 * Maven plugin goal to download cross-language dependencies managed by UDP.
 * This goal downloads dependencies from multiple ecosystems and prepares them for use in Java projects.
 */
@Mojo(
    name = "download-dependencies",
    defaultPhase = LifecyclePhase.GENERATE_RESOURCES,
    requiresDependencyResolution = ResolutionScope.COMPILE
)
public class DownloadDependenciesMojo extends AbstractMojo {

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
     * Directory where cross-language dependencies will be downloaded.
     */
    @Parameter(property = "udp.dependenciesDirectory", defaultValue = "${project.build.directory}/udp-dependencies")
    private File dependenciesDirectory;

    /**
     * Skip dependency download execution.
     */
    @Parameter(property = "udp.skip", defaultValue = "false")
    private boolean skip;

    /**
     * Force re-download of dependencies even if they already exist.
     */
    @Parameter(property = "udp.forceDownload", defaultValue = "false")
    private boolean forceDownload;

    /**
     * Resolve dependencies before downloading.
     */
    @Parameter(property = "udp.resolveDependencies", defaultValue = "true")
    private boolean resolveDependencies;

    /**
     * Include transitive dependencies in download.
     */
    @Parameter(property = "udp.includeTransitive", defaultValue = "true")
    private boolean includeTransitive;

    /**
     * Verify dependency integrity after download.
     */
    @Parameter(property = "udp.verifyIntegrity", defaultValue = "true")
    private boolean verifyIntegrity;

    @Override
    public void execute() throws MojoExecutionException, MojoFailureException {
        if (skip) {
            getLog().info("Skipping UDP dependency download");
            return;
        }

        getLog().info("Downloading UDP cross-language dependencies...");

        try {
            // Load UDP configuration
            UdpConfiguration config = loadConfiguration();

            // Get all dependencies
            List<UdpConfiguration.DependencySpec> allDependencies = config.getAllDependencies();

            if (allDependencies.isEmpty()) {
                getLog().info("No dependencies found in UDP configuration");
                return;
            }

            // Filter dependencies to download (exclude Java dependencies as Maven handles those)
            List<UdpConfiguration.DependencySpec> dependenciesToDownload = getDependenciesToDownload(allDependencies);

            if (dependenciesToDownload.isEmpty()) {
                getLog().info("No cross-language dependencies to download");
                return;
            }

            getLog().info("Found " + dependenciesToDownload.size() + " dependencies to download:");
            for (UdpConfiguration.DependencySpec dep : dependenciesToDownload) {
                getLog().info("  - " + dep.toString());
            }

            // Prepare dependencies directory
            prepareDependenciesDirectory();

            // Resolve dependencies if requested
            if (resolveDependencies) {
                resolveDependenciesViaUdp(config, dependenciesToDownload);
            }

            // Download dependencies via UDP service
            downloadDependenciesViaUdp(config, dependenciesToDownload);

            // Verify integrity if requested
            if (verifyIntegrity) {
                verifyDownloadedDependencies(dependenciesToDownload);
            }

            // Generate dependency metadata
            generateDependencyMetadata(dependenciesToDownload);

            getLog().info("UDP dependency download completed successfully");

        } catch (Exception e) {
            throw new MojoExecutionException("Failed to download UDP dependencies", e);
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

    private List<UdpConfiguration.DependencySpec> getDependenciesToDownload(List<UdpConfiguration.DependencySpec> allDeps) {
        return allDeps.stream()
                .filter(dep -> !isJavaDependency(dep))
                .collect(Collectors.toList());
    }

    private boolean isJavaDependency(UdpConfiguration.DependencySpec dep) {
        String ecosystem = dep.getEcosystem();
        return "maven".equals(ecosystem) || "java".equals(ecosystem) || "gradle".equals(ecosystem);
    }

    private void prepareDependenciesDirectory() throws IOException {
        if (dependenciesDirectory.exists() && forceDownload) {
            getLog().info("Cleaning existing dependencies directory: " + dependenciesDirectory.getAbsolutePath());
            FileUtils.deleteDirectory(dependenciesDirectory);
        }

        if (!dependenciesDirectory.exists()) {
            boolean created = dependenciesDirectory.mkdirs();
            if (!created) {
                throw new IOException("Failed to create dependencies directory: " + dependenciesDirectory.getAbsolutePath());
            }
        }

        // Create ecosystem-specific subdirectories
        createEcosystemDirectories();
    }

    private void createEcosystemDirectories() throws IOException {
        String[] ecosystems = {"python", "npm", "cargo", "nuget", "gem"};
        for (String ecosystem : ecosystems) {
            File ecosystemDir = new File(dependenciesDirectory, ecosystem);
            if (!ecosystemDir.exists()) {
                boolean created = ecosystemDir.mkdirs();
                if (!created) {
                    throw new IOException("Failed to create ecosystem directory: " + ecosystemDir.getAbsolutePath());
                }
            }
        }
    }

    private void resolveDependenciesViaUdp(UdpConfiguration config, List<UdpConfiguration.DependencySpec> dependencies)
            throws IOException {
        getLog().info("Resolving dependencies via UDP service...");

        UdpApiClient apiClient = new UdpApiClient(config.getUdpService(), getLog());

        try {
            // Check UDP service health first
            if (!apiClient.checkHealth()) {
                throw new IOException("UDP service is not healthy. Please ensure the UDP service is running at: " +
                    config.getUdpService().getUrl());
            }

            // Resolve dependencies
            JsonNode response = apiClient.resolveDependencies(dependencies);

            if (response.has("success") && response.get("success").asBoolean()) {
                getLog().info("Dependency resolution completed successfully");

                if (response.has("resolved_packages")) {
                    JsonNode resolvedPackages = response.get("resolved_packages");
                    getLog().info("Resolved " + resolvedPackages.size() + " packages:");

                    for (JsonNode pkg : resolvedPackages) {
                        String name = pkg.get("name").asText();
                        String version = pkg.get("version").asText();
                        String ecosystem = pkg.get("ecosystem").asText();
                        getLog().debug("  - " + ecosystem + ":" + name + "@" + version);
                    }
                }

                if (response.has("conflicts") && response.get("conflicts").size() > 0) {
                    JsonNode conflicts = response.get("conflicts");
                    getLog().warn("Found " + conflicts.size() + " dependency conflicts:");
                    for (JsonNode conflict : conflicts) {
                        getLog().warn("  - " + conflict.get("description").asText());
                    }
                }

            } else {
                String errorMsg = response.has("error") ? response.get("error").asText() : "Unknown error";
                throw new IOException("Dependency resolution failed: " + errorMsg);
            }

        } finally {
            apiClient.close();
        }
    }

    private void downloadDependenciesViaUdp(UdpConfiguration config, List<UdpConfiguration.DependencySpec> dependencies)
            throws IOException {
        getLog().info("Downloading dependencies via UDP service...");

        UdpApiClient apiClient = new UdpApiClient(config.getUdpService(), getLog());

        try {
            // Download dependencies
            JsonNode response = apiClient.downloadDependencies(dependencies, dependenciesDirectory.getAbsolutePath());

            if (response.has("success") && response.get("success").asBoolean()) {
                getLog().info("Dependency download completed successfully");

                if (response.has("downloaded_files")) {
                    JsonNode downloadedFiles = response.get("downloaded_files");
                    getLog().info("Downloaded " + downloadedFiles.size() + " files:");

                    for (JsonNode file : downloadedFiles) {
                        String filepath = file.get("path").asText();
                        long size = file.get("size").asLong();
                        getLog().debug("  - " + filepath + " (" + formatFileSize(size) + ")");
                    }
                }

                if (response.has("cache_hits")) {
                    int cacheHits = response.get("cache_hits").asInt();
                    if (cacheHits > 0) {
                        getLog().info("Used cached versions for " + cacheHits + " dependencies");
                    }
                }

                if (response.has("warnings")) {
                    JsonNode warnings = response.get("warnings");
                    for (JsonNode warning : warnings) {
                        getLog().warn("Download warning: " + warning.asText());
                    }
                }

            } else {
                String errorMsg = response.has("error") ? response.get("error").asText() : "Unknown error";
                throw new IOException("Dependency download failed: " + errorMsg);
            }

        } finally {
            apiClient.close();
        }
    }

    private void verifyDownloadedDependencies(List<UdpConfiguration.DependencySpec> dependencies) {
        getLog().info("Verifying downloaded dependencies...");

        int verified = 0;
        int missing = 0;

        for (UdpConfiguration.DependencySpec dep : dependencies) {
            File depDir = new File(dependenciesDirectory, dep.getEcosystem() + "/" + sanitizeName(dep.getName()));

            if (depDir.exists() && depDir.isDirectory()) {
                File[] files = depDir.listFiles();
                if (files != null && files.length > 0) {
                    getLog().debug("Verified dependency: " + dep.getName() + " (" + files.length + " files)");
                    verified++;
                } else {
                    getLog().warn("Empty dependency directory: " + dep.getName());
                    missing++;
                }
            } else {
                getLog().warn("Missing dependency: " + dep.getName());
                missing++;
            }
        }

        getLog().info("Verification completed: " + verified + " verified, " + missing + " missing");

        if (missing > 0) {
            getLog().warn("Some dependencies were not downloaded successfully. Check the logs above for details.");
        }
    }

    private void generateDependencyMetadata(List<UdpConfiguration.DependencySpec> dependencies) throws IOException {
        getLog().info("Generating dependency metadata...");

        File metadataFile = new File(dependenciesDirectory, "udp-dependencies.properties");

        StringBuilder metadata = new StringBuilder();
        metadata.append("# UDP Dependencies Metadata\n");
        metadata.append("# Generated by UDP Maven Plugin\n");
        metadata.append("udp.dependencies.count=").append(dependencies.size()).append("\n");
        metadata.append("udp.dependencies.directory=").append(dependenciesDirectory.getAbsolutePath()).append("\n");
        metadata.append("udp.generated.timestamp=").append(System.currentTimeMillis()).append("\n");
        metadata.append("\n");

        for (int i = 0; i < dependencies.size(); i++) {
            UdpConfiguration.DependencySpec dep = dependencies.get(i);
            String prefix = "udp.dependency." + i;

            metadata.append(prefix).append(".name=").append(dep.getName()).append("\n");
            metadata.append(prefix).append(".version=").append(dep.getVersion()).append("\n");
            metadata.append(prefix).append(".ecosystem=").append(dep.getEcosystem()).append("\n");

            if (dep.getBridge() != null) {
                metadata.append(prefix).append(".bridge=").append(dep.getBridge()).append("\n");
            }

            File depPath = new File(dependenciesDirectory, dep.getEcosystem() + "/" + sanitizeName(dep.getName()));
            metadata.append(prefix).append(".path=").append(depPath.getAbsolutePath()).append("\n");
            metadata.append("\n");
        }

        FileUtils.writeStringToFile(metadataFile, metadata.toString(), "UTF-8");
        getLog().info("Generated dependency metadata: " + metadataFile.getAbsolutePath());
    }

    private String sanitizeName(String name) {
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024.0));
        return String.format("%.1f GB", bytes / (1024.0 * 1024.0 * 1024.0));
    }
}