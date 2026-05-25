package com.queryflux.querylens.controller;

import com.queryflux.querylens.dto.ErrorResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
    }

    @Test
    void shouldHandleBadRequest() {
        ResponseEntity<ErrorResponse> response =
            handler.handleBadRequest(
                new IllegalArgumentException("bad input"));

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage()).isEqualTo("bad input");
        assertThat(response.getBody().getError()).isEqualTo("Bad Request");
    }

    @Test
    void shouldHandleGeneral() {
        ResponseEntity<ErrorResponse> response =
            handler.handleGeneral(new RuntimeException("boom"));

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getMessage())
            .isEqualTo("An unexpected error occurred");
    }

    @Test
    void errorResponseShouldHaveTimestamp() {
        ResponseEntity<ErrorResponse> response =
            handler.handleBadRequest(
                new IllegalArgumentException("x"));

        assertThat(response.getBody().getTimestamp()).isNotNull();
    }
}
