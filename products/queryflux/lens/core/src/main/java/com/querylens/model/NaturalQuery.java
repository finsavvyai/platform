package com.querylens.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;


@Data
public class NaturalQuery {
    @NotBlank(message = "Query text cannot be empty")
    private String text;
    
    @NotNull(message = "Datasource ID is required")
    private Long datasourceId;
}
