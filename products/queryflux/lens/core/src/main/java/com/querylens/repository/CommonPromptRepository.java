package com.querylens.repository;

import com.querylens.model.CommonPrompt;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommonPromptRepository extends CrudRepository<CommonPrompt, Long> {
    
    @Query("SELECT * FROM COMMON_PROMPTS ORDER BY CREATED_AT DESC")
    List<CommonPrompt> findAllOrderByCreatedAt();
    
    @Query("SELECT * FROM COMMON_PROMPTS WHERE CATEGORY = :category ORDER BY CREATED_AT DESC")
    List<CommonPrompt> findByCategoryOrderByCreatedAt(@Param("category") String category);
    
    @Query("SELECT * FROM COMMON_PROMPTS WHERE IS_FAVORITE = true ORDER BY USAGE_COUNT DESC, CREATED_AT DESC")
    List<CommonPrompt> findFavorites();
    
    @Query("SELECT * FROM COMMON_PROMPTS ORDER BY USAGE_COUNT DESC LIMIT :limit")
    List<CommonPrompt> findMostUsed(@Param("limit") int limit);
    
    @Query("SELECT DISTINCT CATEGORY FROM COMMON_PROMPTS ORDER BY CATEGORY")
    List<String> findAllCategories();
    
    @Query("SELECT * FROM COMMON_PROMPTS WHERE LOWER(TITLE) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(DESCRIPTION) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "OR LOWER(PROMPT_TEXT) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "ORDER BY USAGE_COUNT DESC, CREATED_AT DESC")
    List<CommonPrompt> searchPrompts(@Param("search") String search);
}