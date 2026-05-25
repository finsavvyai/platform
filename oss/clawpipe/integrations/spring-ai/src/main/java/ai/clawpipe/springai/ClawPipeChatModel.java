package ai.clawpipe.springai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Spring AI {@link ChatModel} backed by the ClawPipe gateway.
 *
 * <p>Routes every {@link Prompt} through the ClawPipe pipeline:
 * Booster → Packer → Cache → Router → Provider Call → Learner.
 * Per-bucket cost-reduction range pending the public measured benchmark; the pipeline applies changing application logic.
 *
 * <p>Register via Spring Boot auto-configuration or construct directly:
 * <pre>{@code
 * ClawPipeChatModel chatModel = new ClawPipeChatModel(properties);
 * ChatResponse response = chatModel.call(new Prompt("Explain recursion"));
 * String text = response.getResult().getOutput().getContent();
 * }</pre>
 */
@Component
public class ClawPipeChatModel implements ChatModel {

    private static final String PROMPT_PATH = "/v1/prompt";

    private final ClawPipeProperties properties;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public ClawPipeChatModel(ClawPipeProperties properties) {
        this(properties, buildDefaultHttpClient(properties), new ObjectMapper());
    }

    /** Package-private constructor for testing — allows HttpClient injection. */
    ClawPipeChatModel(
            ClawPipeProperties properties,
            HttpClient httpClient,
            ObjectMapper objectMapper) {
        this.properties = properties;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        String promptText = extractPromptText(prompt);
        String requestBody = buildRequestBody(promptText);
        String url = properties.getGatewayUrl().stripTrailing() + PROMPT_PATH;

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + properties.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                .build();

        HttpResponse<String> httpResponse;
        try {
            httpResponse = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new ClawPipeException("Failed to call ClawPipe gateway", e);
        }

        if (httpResponse.statusCode() >= 400) {
            throw new ClawPipeException(
                    "ClawPipe gateway returned HTTP " + httpResponse.statusCode()
                            + ": " + truncate(httpResponse.body(), 200));
        }

        ClawPipeResponse gatewayResponse = parseResponse(httpResponse.body());
        String text = gatewayResponse.getText() != null ? gatewayResponse.getText() : "";
        AssistantMessage message = new AssistantMessage(text);
        Generation generation = new Generation(message);
        return new ChatResponse(List.of(generation));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private String extractPromptText(Prompt prompt) {
        return prompt.getInstructions().stream()
                .map(org.springframework.ai.chat.messages.Message::getText)
                .collect(Collectors.joining("\n"));
    }

    private String buildRequestBody(String promptText) {
        Map<String, Object> body = new HashMap<>();
        body.put("prompt", promptText);
        body.put("model", properties.getDefaultModel());
        body.put("provider", properties.getDefaultProvider());
        body.put("enableBooster", properties.isEnableBooster());
        body.put("enableCache", properties.isEnableCache());
        try {
            return objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            throw new ClawPipeException("Failed to serialise request body", e);
        }
    }

    private ClawPipeResponse parseResponse(String body) {
        try {
            return objectMapper.readValue(body, ClawPipeResponse.class);
        } catch (JsonProcessingException e) {
            throw new ClawPipeException("Failed to parse ClawPipe gateway response", e);
        }
    }

    private static HttpClient buildDefaultHttpClient(ClawPipeProperties properties) {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(properties.getTimeoutSeconds()))
                .build();
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }

    // -------------------------------------------------------------------------
    // Inner exception
    // -------------------------------------------------------------------------

    /** Unchecked exception for ClawPipe gateway errors. */
    public static class ClawPipeException extends RuntimeException {
        public ClawPipeException(String message) {
            super(message);
        }

        public ClawPipeException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
