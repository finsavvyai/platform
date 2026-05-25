package com.bsl.service.monitor.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "time-based-monitoring")
public class TimeBasedProperties {
    private int defaultTimeoutSeconds = 30;
    private boolean enabled = true;
}
