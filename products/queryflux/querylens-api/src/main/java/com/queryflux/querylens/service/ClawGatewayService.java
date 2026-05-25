package com.queryflux.querylens.service;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.models.ChatModel;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.queryflux.querylens.dto.NlpQueryResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Routes AI requests through the Claw Gateway for centralized
 * observability, rate limiting, cost tracking, and model routing.
 *
 * <p>When {@code claw.enabled} is true, requests go through the
 * Claw Gateway base URL instead of directly to OpenAI.</p>
 */
@Slf4j
@Service
public class ClawGatewayService {

    private final OpenAIClient client;
    private final String model;
    private final String projectId;
    private final boolean enabled;
    private final PromptBuilder promptBuilder;
    private final CostTrackingService costTrackingService;

    @Autowired
    public ClawGatewayService(
        @Value("${claw.enabled:false}") boolean enabled,
        @Value("${claw.api-key:}") String clawApiKey,
        @Value("${claw.base-url:https://gateway.clawapi.com/v1}")
            String clawBaseUrl,
        @Value("${claw.project-id:}") String projectId,
        @Value("${openai.api-key}") String openAiKey,
        @Value("${openai.model:gpt-4o}") String model,
        PromptBuilder promptBuilder,
        CostTrackingService costTrackingService
    ) {
        this.enabled = enabled;
        this.model = model;
        this.projectId = projectId;
        this.promptBuilder = promptBuilder;
        this.costTrackingService = costTrackingService;

        if (enabled && !clawApiKey.isBlank()) {
            log.info("Claw Gateway enabled — routing AI through {}",
                clawBaseUrl);
            this.client = OpenAIOkHttpClient.builder()
                .apiKey(clawApiKey)
                .baseUrl(clawBaseUrl)
                .build();
        } else {
            log.info("Claw Gateway disabled — using direct OpenAI");
            this.client = OpenAIOkHttpClient.builder()
                .apiKey(openAiKey)
                .build();
        }
    }

    /** Constructor for unit tests. */
    ClawGatewayService(
        OpenAIClient client,
        String model,
        String projectId,
        boolean enabled,
        PromptBuilder promptBuilder
    ) {
        this.client = client;
        this.model = model;
        this.projectId = projectId;
        this.enabled = enabled;
        this.promptBuilder = promptBuilder;
        this.costTrackingService = null;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Generate SQL via Claw Gateway (or direct OpenAI as fallback).
     */
    public NlpQueryResponse generateSQL(
            String question,
            String semanticContext,
            String joinHints,
            String fullSchema,
            DatabaseDialectService.DialectContext dialectCtx) {
        log.info("Claw[enabled={}] generating SQL for: {}", enabled,
            question);

        String systemPrompt = promptBuilder.buildSystemPromptFull(
            semanticContext, joinHints, fullSchema, dialectCtx);

        ChatCompletionCreateParams params = ChatCompletionCreateParams
            .builder()
            .model(model)
            .maxCompletionTokens(500)
            .addDeveloperMessage(systemPrompt)
            .addUserMessage(question)
            .build();

        ChatCompletion completion = client.chat().completions()
            .create(params);

        String rawResponse = completion.choices().stream()
            .flatMap(c -> c.message().content().stream())
            .findFirst()
            .orElse("");

        String sql = extractSQL(rawResponse);
        double confidence = calculateConfidence(completion);

        trackUsage(question, completion);

        return NlpQueryResponse.builder()
            .sql(sql)
            .confidence(confidence)
            .explanation("Generated via "
                + (enabled ? "Claw Gateway" : "OpenAI direct")
                + " (" + model + ")")
            .build();
    }

    private void trackUsage(String question,
                            ChatCompletion completion) {
        if (costTrackingService != null
                && completion.usage().isPresent()) {
            costTrackingService.recordUsage(
                question,
                completion.usage().get().promptTokens(),
                completion.usage().get().completionTokens());
        }
    }

    String extractSQL(String response) {
        String sql = response.trim();
        if (sql.startsWith("```sql")) {
            sql = sql.substring(6);
        } else if (sql.startsWith("```")) {
            sql = sql.substring(3);
        }
        if (sql.endsWith("```")) {
            sql = sql.substring(0, sql.length() - 3);
        }
        return sql.trim();
    }

    private double calculateConfidence(ChatCompletion completion) {
        String reason = completion.choices().get(0)
            .finishReason().toString();
        return "stop".equalsIgnoreCase(reason) ? 0.9 : 0.7;
    }
}
