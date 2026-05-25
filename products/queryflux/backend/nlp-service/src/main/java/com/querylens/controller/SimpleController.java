package com.querylens.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SimpleController {

    @GetMapping("/api/status")
    public String status() {
        return "QueryLens is running with DuckDB configured";
    }
}
