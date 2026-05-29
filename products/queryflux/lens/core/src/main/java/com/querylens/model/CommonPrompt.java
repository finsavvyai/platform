package com.querylens.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
@Table("COMMON_PROMPTS")
public class CommonPrompt {
    
    @Id
    private Long id;
    
    private String title;
    private String description;
    private String promptText;
    private String category;
    private Integer usageCount;
    private Boolean isFavorite;
    private LocalDateTime createdAt;
    private LocalDateTime lastUsedAt;
    
    public CommonPrompt(String title, String description, String promptText, String category) {
        this.title = title;
        this.description = description;
        this.promptText = promptText;
        this.category = category;
        this.usageCount = 0;
        this.isFavorite = false;
        this.createdAt = LocalDateTime.now();
    }
    
    public void incrementUsage() {
        this.usageCount = (this.usageCount == null ? 0 : this.usageCount) + 1;
        this.lastUsedAt = LocalDateTime.now();
    }
}