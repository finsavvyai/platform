package com.bsl.service.monitor.config;

import com.bsl.service.monitor.utils.EncryptorUtils;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "email")
@Data
public class EmailProperties {
    private String host;
    private String testHost;
    private String senderEmail;
    private String senderPassword;
    private String recipients;
    private String zapierRecipients;
    private String  from;
    private int  port;
    private boolean  ssl;
    private boolean  auth;
    private boolean  testmode;
    private boolean  starttlsenable;

    public void setSenderPassword(String senderPassword) {
        this.senderPassword = EncryptorUtils.decrypt(senderPassword);
    }
}
