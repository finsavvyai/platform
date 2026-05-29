package com.queryflux.querylens.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SchemaContextServiceTest {

    private SchemaContextService service;

    @BeforeEach
    void setUp() {
        service = new SchemaContextService();
    }

    @Test
    void shouldFormatSimpleTablesArray() {
        String json = """
            [
              {"name": "users", "columns": [
                {"name": "id", "type": "int", "isPrimaryKey": true, "nullable": false},
                {"name": "email", "type": "varchar", "nullable": false}
              ]},
              {"name": "orders", "columns": [
                {"name": "id", "type": "int"},
                {"name": "total", "type": "decimal"}
              ]}
            ]
            """;

        String result = service.formatSchemaForPrompt(json);
        assertThat(result).contains("users(id INT PK NOT NULL");
        assertThat(result).contains("email VARCHAR NOT NULL");
        assertThat(result).contains("orders(id INT, total DECIMAL)");
    }

    @Test
    void shouldFormatNestedDatabaseSchema() {
        String json = """
            {"databases": [
              {"name": "mydb", "schemas": [
                {"name": "public", "tables": [
                  {"name": "products", "columns": [
                    {"name": "name", "type": "varchar"}
                  ]}
                ]}
              ]}
            ]}
            """;

        String result = service.formatSchemaForPrompt(json);
        assertThat(result).contains("Database: mydb");
        assertThat(result).contains("Schema: public");
        assertThat(result).contains("products(name VARCHAR)");
    }

    @Test
    void shouldFormatTablesProperty() {
        String json = """
            {"tables": [
              {"name": "items", "columns": [
                {"name": "price", "type": "decimal"}
              ]}
            ]}
            """;

        String result = service.formatSchemaForPrompt(json);
        assertThat(result).contains("items(price DECIMAL)");
    }

    @Test
    void shouldHandleNull() {
        String result = service.formatSchemaForPrompt(null);
        assertThat(result).isEqualTo("No schema available");
    }

    @Test
    void shouldHandleBlank() {
        String result = service.formatSchemaForPrompt("  ");
        assertThat(result).isEqualTo("No schema available");
    }

    @Test
    void shouldFallbackOnInvalidJson() {
        String raw = "users(id, name, email)";
        String result = service.formatSchemaForPrompt(raw);
        assertThat(result).isEqualTo(raw);
    }

    @Test
    void shouldHandleColumnsWithoutType() {
        String json = """
            [{"name": "t", "columns": [{"name": "col"}]}]
            """;
        String result = service.formatSchemaForPrompt(json);
        assertThat(result).contains("t(col)");
    }

    @Test
    void shouldHandleTableWithNoColumns() {
        String json = """
            [{"name": "empty_table"}]
            """;
        String result = service.formatSchemaForPrompt(json);
        assertThat(result).contains("empty_table()");
    }
}
