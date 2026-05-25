package com.bsl.service.monitor.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "twilio")
@Data
public class TwilioProperties {
    private String sender;
    private String sid;
    private String token;
    private String []recipients;

}
