package com.queryflux.querylens.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NlpQueryResponseTest {

    @Test
    void shouldBuildWithAllFields() {
        NlpQueryResponse response = NlpQueryResponse.builder()
            .sql("SELECT 1")
            .confidence(0.95)
            .explanation("test explanation")
            .build();

        assertThat(response.getSql()).isEqualTo("SELECT 1");
        assertThat(response.getConfidence()).isEqualTo(0.95);
        assertThat(response.getExplanation()).isEqualTo("test explanation");
    }

    @Test
    void shouldAllowNullFields() {
        NlpQueryResponse response = new NlpQueryResponse();
        assertThat(response.getSql()).isNull();
        assertThat(response.getConfidence()).isNull();
        assertThat(response.getExplanation()).isNull();
    }

    @Test
    void shouldSupportSetters() {
        NlpQueryResponse response = new NlpQueryResponse();
        response.setSql("SELECT 1");
        response.setConfidence(0.8);
        response.setExplanation("desc");

        assertThat(response.getSql()).isEqualTo("SELECT 1");
        assertThat(response.getConfidence()).isEqualTo(0.8);
        assertThat(response.getExplanation()).isEqualTo("desc");
    }
}
