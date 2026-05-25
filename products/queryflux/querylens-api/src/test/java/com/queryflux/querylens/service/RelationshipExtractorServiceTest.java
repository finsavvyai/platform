package com.queryflux.querylens.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RelationshipExtractorServiceTest {

    private final RelationshipExtractorService service = new RelationshipExtractorService();

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static final String SCHEMA_WITH_FK = """
        {
          "tables": [
            {
              "name": "orders",
              "columns": [
                { "name": "id", "type": "INT" },
                { "name": "user_id", "type": "INT",
                  "foreignKey": { "table": "users", "column": "id" } },
                { "name": "product_id", "type": "INT",
                  "foreignKey": { "table": "products", "column": "id" } }
              ]
            },
            { "name": "users",  "columns": [{ "name": "id", "type": "INT" }] },
            { "name": "products", "columns": [{ "name": "id", "type": "INT" }] }
          ]
        }
        """;

    private static final String SCHEMA_NO_FK = """
        {
          "tables": [
            { "name": "logs", "columns": [{ "name": "id", "type": "INT" }] }
          ]
        }
        """;

    private static final String SCHEMA_NESTED = """
        {
          "databases": [{
            "name": "mydb",
            "schemas": [{
              "name": "public",
              "tables": [{
                "name": "order_items",
                "columns": [
                  { "name": "order_id", "type": "INT",
                    "references": { "table": "orders", "column": "id" } }
                ]
              }]
            }]
          }]
        }
        """;

    // ── extract() ─────────────────────────────────────────────────────────────

    @Test
    void extractsOneForeignKey() {
        var graph = service.extract("""
            { "tables": [{ "name": "orders", "columns": [
              { "name": "user_id", "foreignKey": { "table": "users", "column": "id" } }
            ]}]}
            """);

        assertThat(graph.relationships()).hasSize(1);
        var rel = graph.relationships().get(0);
        assertThat(rel.fromTable()).isEqualTo("orders");
        assertThat(rel.fromColumn()).isEqualTo("user_id");
        assertThat(rel.toTable()).isEqualTo("users");
        assertThat(rel.toColumn()).isEqualTo("id");
    }

    @Test
    void extractsMultipleForeignKeys() {
        var graph = service.extract(SCHEMA_WITH_FK);

        assertThat(graph.relationships()).hasSize(2);
        assertThat(graph.relationships()).extracting(RelationshipExtractorService.Relationship::toTable)
            .containsExactlyInAnyOrder("users", "products");
    }

    @Test
    void returnsEmptyWhenNoForeignKeys() {
        var graph = service.extract(SCHEMA_NO_FK);

        assertThat(graph.relationships()).isEmpty();
        assertThat(graph.hasRelationships()).isFalse();
    }

    @Test
    void handlesNestedDatabaseSchemaFormat() {
        var graph = service.extract(SCHEMA_NESTED);

        assertThat(graph.relationships()).hasSize(1);
        assertThat(graph.relationships().get(0).fromTable()).isEqualTo("order_items");
        assertThat(graph.relationships().get(0).toTable()).isEqualTo("orders");
    }

    @Test
    void handlesReferencesKeyword() {
        var graph = service.extract("""
            { "tables": [{ "name": "payments", "columns": [
              { "name": "order_id", "references": { "table": "orders", "column": "id" } }
            ]}]}
            """);

        assertThat(graph.relationships()).hasSize(1);
        assertThat(graph.relationships().get(0).toTable()).isEqualTo("orders");
    }

    @Test
    void returnsEmptyGraphForNullInput() {
        var graph = service.extract(null);

        assertThat(graph.relationships()).isEmpty();
        assertThat(graph.joinHints()).isBlank();
    }

    @Test
    void returnsEmptyGraphForBlankInput() {
        var graph = service.extract("  ");

        assertThat(graph.hasRelationships()).isFalse();
    }

    @Test
    void returnsEmptyGraphForInvalidJson() {
        var graph = service.extract("not json {{{");

        assertThat(graph.relationships()).isEmpty();
    }

    // ── joinHints() ───────────────────────────────────────────────────────────

    @Test
    void joinHintsIsBlankWhenNoRelationships() {
        assertThat(service.extract(SCHEMA_NO_FK).joinHints()).isBlank();
    }

    @Test
    void joinHintsContainsJoinKeyword() {
        var graph = service.extract(SCHEMA_WITH_FK);

        assertThat(graph.joinHints()).contains("JOIN");
    }

    @Test
    void joinHintsContainsOnClause() {
        var graph = service.extract(SCHEMA_WITH_FK);

        assertThat(graph.joinHints()).contains("orders.user_id = users.id");
    }

    @Test
    void joinHintsContainsAllRelationships() {
        var graph = service.extract(SCHEMA_WITH_FK);

        assertThat(graph.joinHints()).contains("users");
        assertThat(graph.joinHints()).contains("products");
    }

    // ── Relationship.toString() ───────────────────────────────────────────────

    @Test
    void relationshipToStringIsReadable() {
        var rel = new RelationshipExtractorService.Relationship("orders", "user_id", "users", "id");

        assertThat(rel.toString()).isEqualTo("orders.user_id → users.id");
    }

    // ── hasRelationships() ────────────────────────────────────────────────────

    @Test
    void hasRelationshipsTrueWhenRelationshipsExist() {
        assertThat(service.extract(SCHEMA_WITH_FK).hasRelationships()).isTrue();
    }

    @Test
    void hasRelationshipsFalseWhenEmpty() {
        assertThat(service.extract(SCHEMA_NO_FK).hasRelationships()).isFalse();
    }
}
