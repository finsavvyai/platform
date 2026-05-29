package com.queryflux.querylens.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NlpQueryResponse {

    private String sql;

    private Double confidence;

    private String explanation;
}
