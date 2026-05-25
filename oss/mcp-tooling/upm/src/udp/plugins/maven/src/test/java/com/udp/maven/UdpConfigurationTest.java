package com.udp.maven;

import org.junit.Test;
import org.junit.Before;
import static org.junit.Assert.*;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Unit tests for UdpConfiguration class.
 */
public class UdpConfigurationTest {

    private Path tempDir;

    @Before
    public void setUp() throws IOException {
        tempDir = Files.createTempDirectory("udp-test");
    }

    @Test
    public void testLoadValidConfiguration() throws IOException {
        // Create a test UDP configuration file
        String configContent =
            "project: test-project\n" +
            "target_language: java\n" +
            "java_version: \"8\"\n" +
            "dependencies:\n" +
            "  java:\n" +
            "    - \"org.apache.commons:commons-lang3:3.12.0\"\n" +
            "    - \"com.fasterxml.jackson.core:jackson-databind:2.15.2\"\n" +
            "  python:\n" +
            "    - \"requests:2.28.1\"\n" +
            "    - \"pandas:1.5.2\"\n" +
            "  javascript:\n" +
            "    - \"lodash:4.17.21\"\n" +
            "bridges:\n" +
            "  python:\n" +
            "    enabled: true\n" +
            "    runtime: jython\n" +
            "    version: \"3.8\"\n" +
            "  javascript:\n" +
            "    enabled: true\n" +
            "    runtime: graalvm\n" +
            "udp_service:\n" +
            "  url: \"http://localhost:8040\"\n" +
            "  organization_id: \"test-org-123\"\n" +
            "  timeout: 30\n";

        File configFile = tempDir.resolve("udp.yml").toFile();
        Files.write(configFile.toPath(), configContent.getBytes());

        // Load the configuration
        UdpConfiguration config = UdpConfiguration.load(configFile);

        // Verify project settings
        assertEquals("test-project", config.getProject());
        assertEquals("java", config.getTargetLanguage());
        assertEquals("8", config.getJavaVersion());

        // Verify dependencies
        List<UdpConfiguration.DependencySpec> allDeps = config.getAllDependencies();
        assertEquals(5, allDeps.size());

        // Verify Java dependencies
        assertEquals(2, config.getDependencies().getJava().size());
        assertTrue(config.getDependencies().getJava().contains("org.apache.commons:commons-lang3:3.12.0"));

        // Verify Python dependencies
        assertEquals(2, config.getDependencies().getPython().size());
        assertTrue(config.getDependencies().getPython().contains("requests:2.28.1"));

        // Verify JavaScript dependencies
        assertEquals(1, config.getDependencies().getJavascript().size());
        assertTrue(config.getDependencies().getJavascript().contains("lodash:4.17.21"));

        // Verify bridges
        assertTrue(config.isBridgeEnabled("python"));
        assertTrue(config.isBridgeEnabled("javascript"));
        assertFalse(config.isBridgeEnabled("rust")); // Not configured

        UdpConfiguration.BridgeConfig pythonBridge = config.getBridges().get("python");
        assertNotNull(pythonBridge);
        assertTrue(pythonBridge.isEnabled());
        assertEquals("jython", pythonBridge.getRuntime());
        assertEquals("3.8", pythonBridge.getVersion());

        // Verify UDP service config
        UdpConfiguration.UdpServiceConfig serviceConfig = config.getUdpService();
        assertEquals("http://localhost:8040", serviceConfig.getUrl());
        assertEquals("test-org-123", serviceConfig.getOrganizationId());
        assertEquals(30, serviceConfig.getTimeout());
    }

    @Test
    public void testDependencySpecFromString() {
        // Test Maven-style dependency
        UdpConfiguration.DependencySpec dep1 = UdpConfiguration.DependencySpec.fromString(
            "org.apache.commons:commons-lang3:3.12.0", "maven");

        assertEquals("org.apache.commons:commons-lang3", dep1.getName());
        assertEquals("3.12.0", dep1.getVersion());
        assertEquals("maven", dep1.getEcosystem());

        // Test simple name:version dependency
        UdpConfiguration.DependencySpec dep2 = UdpConfiguration.DependencySpec.fromString(
            "requests:2.28.1", "pypi");

        assertEquals("requests", dep2.getName());
        assertEquals("2.28.1", dep2.getVersion());
        assertEquals("pypi", dep2.getEcosystem());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testInvalidDependencyString() {
        UdpConfiguration.DependencySpec.fromString("invalid", "maven");
    }

    @Test(expected = IllegalArgumentException.class)
    public void testBlankDependencyString() {
        UdpConfiguration.DependencySpec.fromString("", "maven");
    }

    @Test(expected = IOException.class)
    public void testLoadNonExistentFile() throws IOException {
        File nonExistentFile = new File("/path/that/does/not/exist/udp.yml");
        UdpConfiguration.load(nonExistentFile);
    }

    @Test
    public void testDefaultConfiguration() throws IOException {
        // Create minimal configuration
        String configContent = "project: minimal-project\n";

        File configFile = tempDir.resolve("udp.yml").toFile();
        Files.write(configFile.toPath(), configContent.getBytes());

        UdpConfiguration config = UdpConfiguration.load(configFile);

        // Verify defaults
        assertEquals("minimal-project", config.getProject());
        assertNotNull(config.getDependencies());
        assertNotNull(config.getBridges());
        assertNotNull(config.getPerformance());
        assertNotNull(config.getUdpService());

        // Verify default UDP service config
        assertEquals("http://localhost:8040", config.getUdpService().getUrl());
        assertEquals(30, config.getUdpService().getTimeout());
        assertEquals(3, config.getUdpService().getRetryCount());

        // Verify default performance config
        assertTrue(config.getPerformance().isPreloadBridges());
        assertTrue(config.getPerformance().isCacheModules());
        assertTrue(config.getPerformance().isParallelLoading());
        assertEquals(".udp/cache", config.getPerformance().getCacheDirectory());
    }

    @Test
    public void testComplexDependencyConfiguration() throws IOException {
        String configContent =
            "project: complex-project\n" +
            "dependencies:\n" +
            "  generic:\n" +
            "    - name: \"custom-lib\"\n" +
            "      version: \"1.0.0\"\n" +
            "      ecosystem: \"custom\"\n" +
            "      bridge: \"jni\"\n" +
            "      optional: true\n";

        File configFile = tempDir.resolve("udp.yml").toFile();
        Files.write(configFile.toPath(), configContent.getBytes());

        UdpConfiguration config = UdpConfiguration.load(configFile);

        List<UdpConfiguration.DependencySpec> genericDeps = config.getDependencies().getGeneric();
        assertEquals(1, genericDeps.size());

        UdpConfiguration.DependencySpec customDep = genericDeps.get(0);
        assertEquals("custom-lib", customDep.getName());
        assertEquals("1.0.0", customDep.getVersion());
        assertEquals("custom", customDep.getEcosystem());
        assertEquals("jni", customDep.getBridge());
        assertTrue(customDep.isOptional());
    }

    @Test
    public void testGetAllDependencies() throws IOException {
        String configContent =
            "project: multi-ecosystem\n" +
            "dependencies:\n" +
            "  java:\n" +
            "    - \"junit:junit:4.13.2\"\n" +
            "  python:\n" +
            "    - \"numpy:1.21.0\"\n" +
            "    - \"scipy:1.7.0\"\n" +
            "  javascript:\n" +
            "    - \"moment:2.29.4\"\n" +
            "  rust:\n" +
            "    - \"serde:1.0.152\"\n";

        File configFile = tempDir.resolve("udp.yml").toFile();
        Files.write(configFile.toPath(), configContent.getBytes());

        UdpConfiguration config = UdpConfiguration.load(configFile);
        List<UdpConfiguration.DependencySpec> allDeps = config.getAllDependencies();

        assertEquals(5, allDeps.size());

        // Check ecosystems are correctly assigned
        long javaDeps = allDeps.stream().filter(d -> "maven".equals(d.getEcosystem())).count();
        long pythonDeps = allDeps.stream().filter(d -> "pypi".equals(d.getEcosystem())).count();
        long jsDeps = allDeps.stream().filter(d -> "npm".equals(d.getEcosystem())).count();
        long rustDeps = allDeps.stream().filter(d -> "cargo".equals(d.getEcosystem())).count();

        assertEquals(1, javaDeps);
        assertEquals(2, pythonDeps);
        assertEquals(1, jsDeps);
        assertEquals(1, rustDeps);
    }

    @Test
    public void testBridgeEnabledCheck() throws IOException {
        String configContent =
            "project: bridge-test\n" +
            "bridges:\n" +
            "  python:\n" +
            "    enabled: true\n" +
            "  javascript:\n" +
            "    enabled: false\n" +
            "  rust:\n" +
            "    enabled: true\n";

        File configFile = tempDir.resolve("udp.yml").toFile();
        Files.write(configFile.toPath(), configContent.getBytes());

        UdpConfiguration config = UdpConfiguration.load(configFile);

        assertTrue(config.isBridgeEnabled("python"));
        assertFalse(config.isBridgeEnabled("javascript"));
        assertTrue(config.isBridgeEnabled("rust"));
        assertFalse(config.isBridgeEnabled("nonexistent"));
    }
}