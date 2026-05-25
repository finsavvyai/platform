package com.bsl.service.monitor.sanity.api;

import lombok.Data;

import java.util.Arrays;

@Data
public class APIExecuterDTO {
    String name;
    String type;
    String url;
    String [] requests;
    String [] dbignorelist;
    Integer timeoutSeconds; // Timeout for time-based monitoring

    @Override
    public String toString() {
        return "APIExecuterDTO{" +
                "name='" + name + '\'' +
                ", url='" + url + '\'' +
                ", requests=" + Arrays.toString(requests) +
                ", timeoutSeconds=" + timeoutSeconds +
                '}';
    }
}
