package com.bsl.service.monitor.config;


import com.bsl.service.monitor.sanity.api.APIExecuterDTO;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "sms")
public class SMSProperties {
    String envName;
    APIExecuterDTO service;
    String recipients;

}
