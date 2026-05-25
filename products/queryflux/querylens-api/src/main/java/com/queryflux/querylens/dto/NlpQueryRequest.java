package com.queryflux.querylens.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NlpQueryRequest {

    @NotBlank(message = "Question is required")
    private String question;

    private String schema;

    private String databaseId;

    private String dialect;
}
