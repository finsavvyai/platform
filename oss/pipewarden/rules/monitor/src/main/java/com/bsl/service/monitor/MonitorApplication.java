package com.bsl.service.monitor;

import com.bsl.service.monitor.config.DataSourceProperties;
import com.bsl.service.monitor.config.TimeBasedProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableConfigurationProperties(value = {DataSourceProperties.class, TimeBasedProperties.class})
@ConfigurationPropertiesScan("com.bsl.service.monitor.config")
@SpringBootApplication(exclude = {
		DataSourceAutoConfiguration.class })
@EnableScheduling
public class MonitorApplication {
	public static void main(String[] args) {
		SpringApplication.run(MonitorApplication.class, args);

	}

}
