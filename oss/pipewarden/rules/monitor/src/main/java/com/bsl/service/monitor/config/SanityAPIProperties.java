package com.bsl.service.monitor.config;


import com.bsl.service.monitor.sanity.api.APIExecuterDTO;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;


import java.util.List;

@Data
@ConfigurationProperties(prefix = "sanity-app")
public class SanityAPIProperties {
    List<APIExecuterDTO> services;

    @Override
    public String toString() {
        return "SanityAPIProperties{" +
                "endpoints=" + services +
                '}';
    }
}
