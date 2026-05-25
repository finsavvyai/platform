package com.bsl.service.monitor.ds;

import com.bsl.service.monitor.utils.EncryptorUtils;
import lombok.Data;

@Data
public class DataSourceDTO {
    private String jdbcUrl;
    private String user;
    private String password;
    private String name;
    private String driverClassName;

    public void setPassword(String password) {
        this.password = EncryptorUtils.decrypt(password);
    }
}
