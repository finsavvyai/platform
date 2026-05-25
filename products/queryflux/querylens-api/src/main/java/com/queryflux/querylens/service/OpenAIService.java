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

@Slf4j
@Service
public class OpenAIService {

    private final OpenAIClient client;
    private final String model;
    private final PromptBuilder promptBuilder;
    private final CostTrackingService costTrackingService;

    @Autowired
    public OpenAIService(
        @Value("${openai.api-key}") String apiKey,
        @Value("${openai.model:gpt-4o}") String model,
        PromptBuilder promptBuilder,
        CostTrackingService costTrackingService
    ) {
        this.client = OpenAIOkHttpClient.builder()
            .apiKey(apiKey)
            .build();
        this.model = model;
        this.promptBuilder = promptBuilder;
        this.costTrackingService = costTrackingService;
    }

    OpenAIService(OpenAIClient client, String model, PromptBuilder promptBuilder) {
        this.client = client;
        this.model = model;
        this.promptBuilder = promptBuilder;
        this.costTrackingService = null;
    }

    /**
     * Generate SQL using semantic context, JOIN hints, and dialect instructions.
     */
    public NlpQueryResponse generateSQLWithFullContext(
            String question,
            String semanticContext,
            String joinHints,
            String fullSchema,
            DatabaseDialectService.DialectContext dialectContext) {
        log.info("Generating SQL (full context, dialect={}) for: {}",
            dialectContext != null ? dialectContext.dialect() : "default", question);

        String systemPrompt = promptBuilder.buildSystemPromptFull(
            semanticContext, joinHints, fullSchema, dialectContext);

        ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
            .model(model)
            .maxCompletionTokens(500)
            .addDeveloperMessage(systemPrompt)
            .addUserMessage(question)
            .build();

        ChatCompletion completion = client.chat().completions().create(params);

        String rawResponse = completion.choices().stream()
            .flatMap(choice -> choice.message().content().stream())
            .findFirst()
            .orElse("");

        String sql = extractSQL(rawResponse);
        double confidence = calculateConfidence(completion);

        if (costTrackingService != null && completion.usage().isPresent()) {
            costTrackingService.recordUsage(question,
                completion.usage().get().promptTokens(),
                completion.usage().get().completionTokens());
        }

        return NlpQueryResponse.builder()
            .sql(sql)
            .confidence(confidence)
            .explanation("Generated using " + model + " (full context + dialect)")
            .build();
    }

    /**
     * Generate SQL using pre-built semantic context and JOIN hints.
     */
    public NlpQueryResponse generateSQLWithContext(
            String question,
            String semanticContext,
            String joinHints,
            String fullSchema) {
        log.info("Generating SQL (semantic context) for: {}", question);

        String systemPrompt = promptBuilder.buildSystemPromptWithContext(
            semanticContext, joinHints, fullSchema);

        ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
            .model(model)
            .maxCompletionTokens(500)
            .addDeveloperMessage(systemPrompt)
            .addUserMessage(question)
            .build();

        ChatCompletion completion = client.chat().completions().create(params);

        String rawResponse = completion.choices().stream()
            .flatMap(choice -> choice.message().content().stream())
            .findFirst()
            .orElse("");

        String sql = extractSQL(rawResponse);
        double confidence = calculateConfidence(completion);

        if (costTrackingService != null && completion.usage().isPresent()) {
            long in = completion.usage().get().promptTokens();
            long out = completion.usage().get().completionTokens();
            costTrackingService.recordUsage(question, in, out);
        }

        return NlpQueryResponse.builder()
            .sql(sql)
            .confidence(confidence)
            .explanation("Generated using " + model + " (semantic context)")
            .build();
    }

    public NlpQueryResponse generateSQL(String question, String schema) {
        log.info("Generating SQL for question: {}", question);

        String systemPrompt = promptBuilder.buildSystemPrompt(schema);

        ChatCompletionCreateParams params = ChatCompletionCreateParams.builder()
            .model(model)
            .maxCompletionTokens(500)
            .addDeveloperMessage(systemPrompt)
            .addUserMessage(question)
            .build();

        ChatCompletion completion = client.chat().completions().create(params);

        String rawResponse = completion.choices().stream()
            .flatMap(choice -> choice.message().content().stream())
            .findFirst()
            .orElse("");

        String sql = extractSQL(rawResponse);
        double confidence = calculateConfidence(completion);

        // Track token usage and cost
        if (costTrackingService != null && completion.usage().isPresent()) {
            long inputTokens = completion.usage().get().promptTokens();
            long outputTokens = completion.usage().get().completionTokens();

            var usage = costTrackingService.recordUsage(question, inputTokens, outputTokens);
            log.debug("Token usage: {} input, {} output, ${}" ,
                inputTokens, outputTokens, String.format("%.4f", usage.cost()));
        }

        log.info("Generated SQL with confidence {}: {}", confidence, sql);

        return NlpQueryResponse.builder()
            .sql(sql)
            .confidence(confidence)
            .explanation("Generated using " + model)
            .build();
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
        String finishReason = completion.choices().get(0)
            .finishReason().toString();
        return "stop".equalsIgnoreCase(finishReason) ? 0.9 : 0.7;
    }
}
