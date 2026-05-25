package com.queryflux.querylens.controller;

import com.queryflux.querylens.dto.NlpQueryRequest;
import com.queryflux.querylens.dto.NlpQueryResponse;
import com.queryflux.querylens.service.ClawGatewayService;
import com.queryflux.querylens.service.DatabaseDialectService;
import com.queryflux.querylens.service.QueryBoosterService;
import com.queryflux.querylens.service.ReasoningCacheService;
import com.queryflux.querylens.service.RelationshipExtractorService;
import com.queryflux.querylens.service.SchemaContextService;
import com.queryflux.querylens.service.SemanticSearchService;
import com.queryflux.querylens.service.SqlSafetyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/v1/nlp")
@RequiredArgsConstructor
public class NlpController {

    private final ClawGatewayService clawGatewayService;
    private final SqlSafetyService sqlSafetyService;
    private final SchemaContextService schemaContextService;
    private final SemanticSearchService semanticSearchService;
    private final RelationshipExtractorService relationshipExtractorService;
    private final DatabaseDialectService dialectService;
    private final QueryBoosterService queryBoosterService;
    private final ReasoningCacheService reasoningCacheService;

    @PostMapping("/query")
    public ResponseEntity<NlpQueryResponse> generateSQL(
            @Valid @RequestBody NlpQueryRequest request) {
        log.info("NLP query: {} [dialect={}]",
            request.getQuestion(), request.getDialect());

        try {
            // 1. Query Booster — skip AI for simple patterns
            Optional<NlpQueryResponse> boosted =
                queryBoosterService.tryResolve(
                    request.getQuestion(), request.getDialect());
            if (boosted.isPresent()) {
                log.info("Query boosted — no AI call needed");
                return validateAndReturn(boosted.get());
            }

            // 2. Reasoning Cache — return cached NL->SQL
            Optional<NlpQueryResponse> cached =
                reasoningCacheService.get(
                    request.getQuestion(), request.getDatabaseId());
            if (cached.isPresent()) {
                log.info("Cache hit — returning cached SQL");
                return validateAndReturn(cached.get());
            }

            // 3. Full schema for fallback / relationship extraction
            String formattedSchema = schemaContextService
                .formatSchemaForPrompt(request.getSchema());

            // 4. Dialect context (defaults to PostgreSQL)
            DatabaseDialectService.DialectContext dialectCtx =
                dialectService.getContext(request.getDialect());

            // 5. Semantic schema discovery via Vectorize
            SemanticSearchService.SemanticContext semantic =
                semanticSearchService.findRelevantSchema(
                    request.getQuestion(), request.getDatabaseId());

            // 6. FK relationship graph for JOIN hints
            RelationshipExtractorService.RelationshipGraph relGraph =
                relationshipExtractorService.extract(
                    request.getSchema());

            // 7. Generate SQL via Claw Gateway (or direct OpenAI)
            NlpQueryResponse aiResponse;
            if (semantic.available()) {
                log.info("Using semantic context ({} tables) "
                    + "+ {} FK rels + dialect {}",
                    semantic.relevantTables().size(),
                    relGraph.relationships().size(),
                    dialectCtx.dialect());
                aiResponse = clawGatewayService.generateSQL(
                    request.getQuestion(),
                    semantic.schemaContext(),
                    relGraph.joinHints(),
                    formattedSchema,
                    dialectCtx);
            } else {
                log.info("Vectorize unavailable, full schema "
                    + "+ dialect {}", dialectCtx.dialect());
                aiResponse = clawGatewayService.generateSQL(
                    request.getQuestion(),
                    null, null,
                    formattedSchema,
                    dialectCtx);
            }

            // 8. Cache the AI response for future lookups
            reasoningCacheService.put(
                request.getQuestion(),
                request.getDatabaseId(),
                aiResponse);

            // 9. Safety validation
            return validateAndReturn(aiResponse);

        } catch (Exception e) {
            log.error("Error generating SQL", e);
            return ResponseEntity.internalServerError()
                .body(NlpQueryResponse.builder()
                    .sql("")
                    .confidence(0.0)
                    .explanation("Error: " + e.getMessage())
                    .build());
        }
    }

    private ResponseEntity<NlpQueryResponse> validateAndReturn(
            NlpQueryResponse response) {
        SqlSafetyService.ValidationResult safety =
            sqlSafetyService.validate(response.getSql());

        if (!safety.valid()) {
            log.warn("Unsafe SQL rejected: {}", safety.reason());
            return ResponseEntity.badRequest()
                .body(NlpQueryResponse.builder()
                    .sql("")
                    .confidence(0.0)
                    .explanation("Rejected: " + safety.reason())
                    .build());
        }

        return ResponseEntity.ok(NlpQueryResponse.builder()
            .sql(safety.sql())
            .confidence(response.getConfidence())
            .explanation(response.getExplanation())
            .build());
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("QueryLens API is healthy");
    }
}
