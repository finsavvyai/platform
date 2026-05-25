package ai.clawpipe.springai;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for the ClawPipe Spring AI integration.
 *
 * <p>Bind via {@code application.yml}:
 * <pre>
 * clawpipe:
 *   api-key: cp_xxx
 *   gateway-url: https://api.clawpipe.ai
 *   default-model: auto
 *   default-provider: openai
 * </pre>
 */
@ConfigurationProperties(prefix = "clawpipe")
public class ClawPipeProperties {

    /** ClawPipe API key (required). Must start with {@code cp_}. */
    private String apiKey;

    /** Base URL of the ClawPipe gateway. */
    private String gatewayUrl = "https://api.clawpipe.ai";

    /** Default model identifier passed to the router. {@code auto} lets ClawPipe choose. */
    private String defaultModel = "auto";

    /** Default provider hint passed to the router. {@code openai} is the default. */
    private String defaultProvider = "openai";

    /** HTTP read timeout in seconds. */
    private int timeoutSeconds = 120;

    /** Enable the ClawPipe booster stage (deterministic transforms). */
    private boolean enableBooster = true;

    /** Enable the ClawPipe prompt cache stage. */
    private boolean enableCache = true;

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getGatewayUrl() {
        return gatewayUrl;
    }

    public void setGatewayUrl(String gatewayUrl) {
        this.gatewayUrl = gatewayUrl;
    }

    public String getDefaultModel() {
        return defaultModel;
    }

    public void setDefaultModel(String defaultModel) {
        this.defaultModel = defaultModel;
    }

    public String getDefaultProvider() {
        return defaultProvider;
    }

    public void setDefaultProvider(String defaultProvider) {
        this.defaultProvider = defaultProvider;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }

    public boolean isEnableBooster() {
        return enableBooster;
    }

    public void setEnableBooster(boolean enableBooster) {
        this.enableBooster = enableBooster;
    }

    public boolean isEnableCache() {
        return enableCache;
    }

    public void setEnableCache(boolean enableCache) {
        this.enableCache = enableCache;
    }
}
