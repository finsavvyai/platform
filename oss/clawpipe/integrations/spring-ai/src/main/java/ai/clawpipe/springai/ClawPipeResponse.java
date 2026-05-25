package ai.clawpipe.springai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * JSON response envelope returned by {@code POST /v1/prompt}.
 *
 * <p>Unknown fields are silently ignored so the model is forward-compatible
 * as the gateway adds new telemetry fields.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClawPipeResponse {

    private String text;

    @JsonProperty("tokensIn")
    private int tokensIn;

    @JsonProperty("tokensOut")
    private int tokensOut;

    @JsonProperty("latencyMs")
    private long latencyMs;

    private boolean cached;
    private boolean boosted;
    private String model;
    private String provider;

    public ClawPipeResponse() {}

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public int getTokensIn() {
        return tokensIn;
    }

    public void setTokensIn(int tokensIn) {
        this.tokensIn = tokensIn;
    }

    public int getTokensOut() {
        return tokensOut;
    }

    public void setTokensOut(int tokensOut) {
        this.tokensOut = tokensOut;
    }

    public long getLatencyMs() {
        return latencyMs;
    }

    public void setLatencyMs(long latencyMs) {
        this.latencyMs = latencyMs;
    }

    public boolean isCached() {
        return cached;
    }

    public void setCached(boolean cached) {
        this.cached = cached;
    }

    public boolean isBoosted() {
        return boosted;
    }

    public void setBoosted(boolean boosted) {
        this.boosted = boosted;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    @Override
    public String toString() {
        return "ClawPipeResponse{text='" + text + "', tokensIn=" + tokensIn
                + ", tokensOut=" + tokensOut + ", latencyMs=" + latencyMs
                + ", cached=" + cached + ", boosted=" + boosted + "}";
    }
}
