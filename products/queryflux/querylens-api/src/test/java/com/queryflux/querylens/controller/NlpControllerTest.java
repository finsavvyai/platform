package com.queryflux.querylens.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NlpController.class)
class NlpControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private ClawGatewayService clawGatewayService;
    @MockBean private SqlSafetyService sqlSafetyService;
    @MockBean private SchemaContextService schemaContextService;
    @MockBean private SemanticSearchService semanticSearchService;
    @MockBean private RelationshipExtractorService relationshipExtractorService;
    @MockBean private DatabaseDialectService dialectService;
    @MockBean private QueryBoosterService queryBoosterService;
    @MockBean private ReasoningCacheService reasoningCacheService;

    @Test
    void healthShouldReturnOk() throws Exception {
        mockMvc.perform(get("/api/v1/nlp/health"))
            .andExpect(status().isOk())
            .andExpect(content().string("QueryLens API is healthy"));
    }

    @Test
    void shouldReturnBoostedResultWithoutCallingAI() throws Exception {
        when(queryBoosterService.tryResolve(anyString(), any()))
            .thenReturn(Optional.of(NlpQueryResponse.builder()
                .sql("SELECT * FROM users LIMIT 100")
                .confidence(1.0)
                .explanation("Boosted")
                .build()));

        when(sqlSafetyService.validate(anyString()))
            .thenReturn(new SqlSafetyService.ValidationResult(
                true, "SELECT * FROM users LIMIT 100", null));

        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("get all from users")
            .schema("users table")
            .build();

        mockMvc.perform(post("/api/v1/nlp/query")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sql")
                .value("SELECT * FROM users LIMIT 100"))
            .andExpect(jsonPath("$.confidence").value(1.0));
    }

    @Test
    void shouldReturnCachedResultWithoutCallingAI() throws Exception {
        when(queryBoosterService.tryResolve(anyString(), any()))
            .thenReturn(Optional.empty());

        when(reasoningCacheService.get(anyString(), any()))
            .thenReturn(Optional.of(NlpQueryResponse.builder()
                .sql("SELECT COUNT(*) FROM orders")
                .confidence(0.9)
                .explanation("Cached")
                .build()));

        when(sqlSafetyService.validate(anyString()))
            .thenReturn(new SqlSafetyService.ValidationResult(
                true, "SELECT COUNT(*) FROM orders", null));

        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("how many orders are there")
            .schema("orders table")
            .build();

        mockMvc.perform(post("/api/v1/nlp/query")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sql")
                .value("SELECT COUNT(*) FROM orders"))
            .andExpect(jsonPath("$.confidence").value(0.9));
    }

    @Test
    void shouldCallClawGatewayWhenNoCacheOrBoost()
            throws Exception {
        when(queryBoosterService.tryResolve(anyString(), any()))
            .thenReturn(Optional.empty());
        when(reasoningCacheService.get(anyString(), any()))
            .thenReturn(Optional.empty());
        when(schemaContextService.formatSchemaForPrompt(anyString()))
            .thenReturn("users(id INT, name VARCHAR)");
        when(dialectService.getContext(nullable(String.class)))
            .thenReturn(new DatabaseDialectService.DialectContext(
                DatabaseDialectService.Dialect.POSTGRESQL,
                "Use PostgreSQL syntax", "DATE_TRUNC",
                "LIMIT n", "||", "~", true, true));
        when(semanticSearchService.findRelevantSchema(
                anyString(), any()))
            .thenReturn(new SemanticSearchService.SemanticContext(
                false, List.of(), ""));
        when(relationshipExtractorService.extract(any()))
            .thenReturn(
                new RelationshipExtractorService.RelationshipGraph(
                    List.of(), ""));

        when(clawGatewayService.generateSQL(
                anyString(), any(), any(), anyString(), any()))
            .thenReturn(NlpQueryResponse.builder()
                .sql("SELECT * FROM users")
                .confidence(0.9)
                .explanation("via Claw Gateway")
                .build());

        when(sqlSafetyService.validate("SELECT * FROM users"))
            .thenReturn(new SqlSafetyService.ValidationResult(
                true, "SELECT * FROM users LIMIT 100", null));

        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("Show all users")
            .schema("users table")
            .build();

        mockMvc.perform(post("/api/v1/nlp/query")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sql")
                .value("SELECT * FROM users LIMIT 100"))
            .andExpect(jsonPath("$.confidence").value(0.9));
    }

    @Test
    void shouldRejectUnsafeSQL() throws Exception {
        when(queryBoosterService.tryResolve(anyString(), any()))
            .thenReturn(Optional.of(NlpQueryResponse.builder()
                .sql("DROP TABLE users")
                .confidence(0.5)
                .build()));

        when(sqlSafetyService.validate("DROP TABLE users"))
            .thenReturn(new SqlSafetyService.ValidationResult(
                false, null, "Forbidden operation: DROP"));

        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("Delete everything")
            .schema("users")
            .build();

        mockMvc.perform(post("/api/v1/nlp/query")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.sql").value(""))
            .andExpect(jsonPath("$.explanation")
                .value("Rejected: Forbidden operation: DROP"));
    }

    @Test
    void shouldReturn400ForMissingQuestion() throws Exception {
        NlpQueryRequest request = NlpQueryRequest.builder()
            .schema("users")
            .build();

        mockMvc.perform(post("/api/v1/nlp/query")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void shouldReturn500OnServiceError() throws Exception {
        when(queryBoosterService.tryResolve(anyString(), any()))
            .thenThrow(new RuntimeException("API timeout"));

        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("test query")
            .schema("schema")
            .build();

        mockMvc.perform(post("/api/v1/nlp/query")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.confidence").value(0.0))
            .andExpect(jsonPath("$.explanation")
                .value("Error: API timeout"));
    }
}
