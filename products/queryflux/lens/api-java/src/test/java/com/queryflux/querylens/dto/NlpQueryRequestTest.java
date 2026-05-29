package com.queryflux.querylens.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class NlpQueryRequestTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void shouldBeValidWithQuestion() {
        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("Show all users")
            .build();

        Set<ConstraintViolation<NlpQueryRequest>> violations =
            validator.validate(request);
        assertThat(violations).isEmpty();
    }

    @Test
    void shouldBeInvalidWithBlankQuestion() {
        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("")
            .build();

        Set<ConstraintViolation<NlpQueryRequest>> violations =
            validator.validate(request);
        assertThat(violations).isNotEmpty();
    }

    @Test
    void shouldBeInvalidWithNullQuestion() {
        NlpQueryRequest request = NlpQueryRequest.builder().build();

        Set<ConstraintViolation<NlpQueryRequest>> violations =
            validator.validate(request);
        assertThat(violations).isNotEmpty();
    }

    @Test
    void shouldAllowNullSchema() {
        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("test")
            .build();

        assertThat(request.getSchema()).isNull();
        Set<ConstraintViolation<NlpQueryRequest>> violations =
            validator.validate(request);
        assertThat(violations).isEmpty();
    }

    @Test
    void shouldSetAllFields() {
        NlpQueryRequest request = NlpQueryRequest.builder()
            .question("test")
            .schema("users(id)")
            .databaseId("db-1")
            .build();

        assertThat(request.getQuestion()).isEqualTo("test");
        assertThat(request.getSchema()).isEqualTo("users(id)");
        assertThat(request.getDatabaseId()).isEqualTo("db-1");
    }
}
