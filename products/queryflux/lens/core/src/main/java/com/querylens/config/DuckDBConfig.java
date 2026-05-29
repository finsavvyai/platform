package com.querylens.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("duckdb")
public class DuckDBConfig {
    // Configuration will be loaded from application-duckdb.properties
}
