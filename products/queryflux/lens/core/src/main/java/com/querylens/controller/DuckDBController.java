package com.querylens.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class DuckDBController {

    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public DuckDBController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/api/duckdb/info")
    public Map<String, Object> getInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("db_type", "DuckDB");
        try {
            String version = jdbcTemplate.queryForObject("SELECT version()", String.class);
            info.put("version", version);
            info.put("status", "Connected");
        } catch (Exception e) {
            info.put("status", "Error");
            info.put("error", e.getMessage());
        }
        return info;
    }
}