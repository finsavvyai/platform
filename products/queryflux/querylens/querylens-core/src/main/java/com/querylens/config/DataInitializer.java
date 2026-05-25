package com.querylens.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("duckdb")
public class DataInitializer implements CommandLineRunner {
    
    @Override
    public void run(String... args) throws Exception {
        System.out.println("DuckDB initialization complete");
    }
}
