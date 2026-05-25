package com.udp.gradle;

import org.gradle.api.provider.Property;

/**
 * Gradle extension for UDP plugin configuration
 */
public abstract class UdpExtension {

    /**
     * UDP service URL
     */
    public abstract Property<String> getServiceUrl();

    /**
     * API key for UDP service authentication
     */
    public abstract Property<String> getApiKey();

    /**
     * Organization ID for UDP service
     */
    public abstract Property<String> getOrganizationId();

    /**
     * Path to udp.yml configuration file
     */
    public abstract Property<String> getConfigFile();

    /**
     * Enable verbose logging
     */
    public abstract Property<Boolean> getVerbose();

    /**
     * Skip UDP processing (useful for CI/CD scenarios)
     */
    public abstract Property<Boolean> getSkip();

    public UdpExtension() {
        getServiceUrl().convention("http://localhost:8040");
        getConfigFile().convention("udp.yml");
        getVerbose().convention(false);
        getSkip().convention(false);
    }
}