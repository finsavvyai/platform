package com.querylens;

import com.querylens.service.CommonPromptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@RequiredArgsConstructor
@Slf4j
public class QueryLensApplication implements CommandLineRunner {
    
    private final CommonPromptService commonPromptService;
    
    public static void main(String[] args) {
        SpringApplication.run(QueryLensApplication.class, args);
    }
    
    @Override
    public void run(String... args) throws Exception {
        try {
            // Initialize default prompts on startup
            commonPromptService.initializeDefaultPrompts();
            log.info("Default prompts initialized successfully");
        } catch (Exception e) {
            log.warn("Failed to initialize default prompts, but application will continue: {}", e.getMessage());
            // Don't fail the application startup if prompts can't be initialized
        }
    }
}
