package com.udp.gradle;

import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.api.tasks.TaskProvider;

/**
 * UDP Gradle Plugin - Integrates Universal Dependency Platform with Gradle builds
 *
 * This plugin provides:
 * - Cross-language dependency management via udp.yml
 * - Bridge code generation for multi-ecosystem integration
 * - Integration with Gradle's dependency resolution
 * - Build lifecycle integration
 */
public class UdpPlugin implements Plugin<Project> {

    @Override
    public void apply(Project project) {
        // Create UDP extension for configuration
        UdpExtension extension = project.getExtensions().create("udp", UdpExtension.class);

        // Register UDP tasks
        TaskProvider<UdpAnalyzeTask> analyzeTask = project.getTasks().register("udpAnalyze", UdpAnalyzeTask.class, task -> {
            task.setGroup("udp");
            task.setDescription("Analyze udp.yml and validate cross-language dependencies");
            task.getUdpConfigFile().convention(project.file("udp.yml"));
        });

        TaskProvider<UdpDownloadTask> downloadTask = project.getTasks().register("udpDownload", UdpDownloadTask.class, task -> {
            task.setGroup("udp");
            task.setDescription("Download cross-ecosystem dependencies from UDP service");
            task.dependsOn(analyzeTask);
            task.getUdpConfigFile().convention(project.file("udp.yml"));
            task.getDependenciesDir().convention(project.file("lib/udp"));
        });

        TaskProvider<UdpGenerateBridgesTask> generateBridgesTask = project.getTasks().register("udpGenerateBridges", UdpGenerateBridgesTask.class, task -> {
            task.setGroup("udp");
            task.setDescription("Generate bridge code for cross-language interoperability");
            task.dependsOn(downloadTask);
            task.getUdpConfigFile().convention(project.file("udp.yml"));
            task.getBridgeOutputDir().convention(project.file("src/main/java/udp/bridges"));
        });

        TaskProvider<UdpSetupTask> setupTask = project.getTasks().register("udpSetup", UdpSetupTask.class, task -> {
            task.setGroup("udp");
            task.setDescription("Complete UDP setup: analyze, download, and generate bridges");
            task.dependsOn(generateBridgesTask);
        });

        // Integrate with Gradle lifecycle
        project.getTasks().named("compileJava").configure(task -> {
            task.dependsOn(generateBridgesTask);
        });

        project.getTasks().named("processResources").configure(task -> {
            task.dependsOn(downloadTask);
        });

        // Add UDP dependencies directory to runtime classpath
        project.afterEvaluate(proj -> {
            proj.getDependencies().add("implementation", proj.fileTree("lib/udp") {
                include("**/*.jar");
            });
        });
    }
}