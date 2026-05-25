package com.querylens.api;

import com.querylens.model.CommonPrompt;
import com.querylens.service.CommonPromptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prompts")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class CommonPromptController {
    
    private final CommonPromptService commonPromptService;
    
    @GetMapping
    public ResponseEntity<List<CommonPrompt>> getAllPrompts(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "search", required = false) String search) {
        
        List<CommonPrompt> prompts;
        
        if (search != null && !search.trim().isEmpty()) {
            prompts = commonPromptService.searchPrompts(search.trim());
        } else if (category != null && !category.trim().isEmpty()) {
            prompts = commonPromptService.getPromptsByCategory(category.trim());
        } else {
            prompts = commonPromptService.getAllPrompts();
        }
        
        return ResponseEntity.ok(prompts);
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<CommonPrompt> getPromptById(@PathVariable Long id) {
        return commonPromptService.getPromptById(id)
                .map(prompt -> ResponseEntity.ok(prompt))
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/favorites")
    public ResponseEntity<List<CommonPrompt>> getFavoritePrompts() {
        return ResponseEntity.ok(commonPromptService.getFavoritePrompts());
    }
    
    @GetMapping("/most-used")
    public ResponseEntity<List<CommonPrompt>> getMostUsedPrompts(
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return ResponseEntity.ok(commonPromptService.getMostUsedPrompts(limit));
    }
    
    @GetMapping("/categories")
    public ResponseEntity<List<String>> getAllCategories() {
        return ResponseEntity.ok(commonPromptService.getAllCategories());
    }
    
    @PostMapping
    public ResponseEntity<CommonPrompt> createPrompt(@RequestBody CommonPrompt prompt) {
        try {
            CommonPrompt savedPrompt = commonPromptService.savePrompt(prompt);
            log.info("Created new prompt: {}", savedPrompt.getTitle());
            return ResponseEntity.status(HttpStatus.CREATED).body(savedPrompt);
        } catch (Exception e) {
            log.error("Error creating prompt", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<CommonPrompt> updatePrompt(@PathVariable Long id, @RequestBody CommonPrompt prompt) {
        return commonPromptService.updatePrompt(id, prompt)
                .map(updatedPrompt -> {
                    log.info("Updated prompt: {}", updatedPrompt.getTitle());
                    return ResponseEntity.ok(updatedPrompt);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePrompt(@PathVariable Long id) {
        if (commonPromptService.deletePrompt(id)) {
            log.info("Deleted prompt with id: {}", id);
            return ResponseEntity.noContent().build();
        } else {
            return ResponseEntity.notFound().build();
        }
    }
    
    @PostMapping("/{id}/favorite")
    public ResponseEntity<CommonPrompt> toggleFavorite(@PathVariable Long id) {
        return commonPromptService.toggleFavorite(id)
                .map(prompt -> {
                    log.info("Toggled favorite for prompt: {} to {}", prompt.getTitle(), prompt.getIsFavorite());
                    return ResponseEntity.ok(prompt);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/{id}/use")
    public ResponseEntity<CommonPrompt> incrementUsage(@PathVariable Long id) {
        return commonPromptService.incrementUsage(id)
                .map(prompt -> {
                    log.info("Incremented usage for prompt: {} (now {})", prompt.getTitle(), prompt.getUsageCount());
                    return ResponseEntity.ok(prompt);
                })
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PostMapping("/initialize")
    public ResponseEntity<Map<String, String>> initializeDefaultPrompts() {
        try {
            commonPromptService.initializeDefaultPrompts();
            return ResponseEntity.ok(Map.of("message", "Default prompts initialized successfully"));
        } catch (Exception e) {
            log.error("Error initializing default prompts", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to initialize default prompts"));
        }
    }
}