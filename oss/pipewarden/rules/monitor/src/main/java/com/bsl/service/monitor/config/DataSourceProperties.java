package com.bsl.service.monitor.config;

import com.bsl.service.monitor.ds.DataSourceDTO;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@Data
@ConfigurationProperties (prefix = "database")
public class DataSourceProperties {

    List<DataSourceDTO> dataSources;
}
