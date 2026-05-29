package com.querylens.service;

import com.querylens.model.CommonPrompt;
import com.querylens.repository.CommonPromptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommonPromptService {
    
    private final CommonPromptRepository commonPromptRepository;
    
    public List<CommonPrompt> getAllPrompts() {
        return commonPromptRepository.findAllOrderByCreatedAt();
    }
    
    public List<CommonPrompt> getPromptsByCategory(String category) {
        return commonPromptRepository.findByCategoryOrderByCreatedAt(category);
    }
    
    public List<CommonPrompt> getFavoritePrompts() {
        return commonPromptRepository.findFavorites();
    }
    
    public List<CommonPrompt> getMostUsedPrompts(int limit) {
        return commonPromptRepository.findMostUsed(limit);
    }
    
    public List<String> getAllCategories() {
        return commonPromptRepository.findAllCategories();
    }
    
    public List<CommonPrompt> searchPrompts(String search) {
        return commonPromptRepository.searchPrompts(search);
    }
    
    public Optional<CommonPrompt> getPromptById(Long id) {
        return commonPromptRepository.findById(id);
    }
    
    public CommonPrompt savePrompt(CommonPrompt prompt) {
        if (prompt.getCreatedAt() == null) {
            prompt.setCreatedAt(LocalDateTime.now());
        }
        if (prompt.getUsageCount() == null) {
            prompt.setUsageCount(0);
        }
        if (prompt.getIsFavorite() == null) {
            prompt.setIsFavorite(false);
        }
        return commonPromptRepository.save(prompt);
    }
    
    public Optional<CommonPrompt> updatePrompt(Long id, CommonPrompt updatedPrompt) {
        return commonPromptRepository.findById(id)
                .map(existingPrompt -> {
                    existingPrompt.setTitle(updatedPrompt.getTitle());
                    existingPrompt.setDescription(updatedPrompt.getDescription());
                    existingPrompt.setPromptText(updatedPrompt.getPromptText());
                    existingPrompt.setCategory(updatedPrompt.getCategory());
                    existingPrompt.setIsFavorite(updatedPrompt.getIsFavorite());
                    return commonPromptRepository.save(existingPrompt);
                });
    }
    
    public boolean deletePrompt(Long id) {
        if (commonPromptRepository.existsById(id)) {
            commonPromptRepository.deleteById(id);
            return true;
        }
        return false;
    }
    
    public Optional<CommonPrompt> toggleFavorite(Long id) {
        return commonPromptRepository.findById(id)
                .map(prompt -> {
                    prompt.setIsFavorite(!prompt.getIsFavorite());
                    return commonPromptRepository.save(prompt);
                });
    }
    
    public Optional<CommonPrompt> incrementUsage(Long id) {
        return commonPromptRepository.findById(id)
                .map(prompt -> {
                    prompt.incrementUsage();
                    return commonPromptRepository.save(prompt);
                });
    }
    
    public void initializeDefaultPrompts() {
        try {
            if (commonPromptRepository.count() == 0) {
            log.info("Initializing default common prompts...");
            
            List<CommonPrompt> defaultPrompts = Arrays.asList(
                new CommonPrompt(
                    "Count All Records",
                    "Count the total number of records in a table",
                    "Count all records in the main table",
                    "Basic Queries"
                ),
                new CommonPrompt(
                    "Show Recent Data",
                    "Display the most recent records",
                    "Show me the latest 10 records",
                    "Basic Queries"
                ),
                new CommonPrompt(
                    "Find Top Values",
                    "Find records with highest values",
                    "Show me the top 10 records by value",
                    "Analytics"
                ),
                new CommonPrompt(
                    "Monthly Summary",
                    "Get monthly aggregated data",
                    "Show monthly summary of sales by month",
                    "Analytics"
                ),
                new CommonPrompt(
                    "Search by Name",
                    "Find records containing specific text",
                    "Find all records where name contains 'Product'",
                    "Filtering"
                ),
                new CommonPrompt(
                    "Date Range Query",
                    "Filter records by date range",
                    "Show records from last month",
                    "Filtering"
                ),
                new CommonPrompt(
                    "Average Calculation",
                    "Calculate average values",
                    "What is the average value across all records",
                    "Calculations"
                ),
                new CommonPrompt(
                    "Group by Category",
                    "Group and count by category",
                    "Group records by category and show counts",
                    "Grouping"
                ),
                new CommonPrompt(
                    "Find Duplicates",
                    "Identify duplicate records",
                    "Show me duplicate records based on name",
                    "Data Quality"
                ),
                new CommonPrompt(
                    "Performance Metrics",
                    "Calculate key performance metrics",
                    "Show performance metrics for this quarter",
                    "Business Intelligence"
                )
            );
            
                defaultPrompts.forEach(commonPromptRepository::save);
                log.info("Initialized {} default prompts", defaultPrompts.size());
            }
        } catch (Exception e) {
            log.warn("Could not initialize default prompts, table may not exist yet: {}", e.getMessage());
        }
    }
}