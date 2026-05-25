package com.bsl.service.monitor.controller;

import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.service.APIExecuterEngine;
import com.bsl.service.monitor.service.DBSanityCheck;
import com.bsl.service.monitor.service.JsonMonitoringService;
import com.bsl.service.monitor.service.TimeBasedMonitoringService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

    @Autowired
    APIExecuterEngine apiExecuterEngine;

    @Autowired
    DBSanityCheck dbSanityCheck;

    @Autowired
    TimeBasedMonitoringService timeBasedMonitoringService;

    @Autowired
    JsonMonitoringService jsonMonitoringService;

    @GetMapping("/status")
    public Map<String, Object> getDashboardStatus() {
        Map<String, Object> status = new HashMap<>();
        
        List<ResponseDetails> apiResults = apiExecuterEngine.execute();
        List<ResponseDetails> dbResults = dbSanityCheck.execute();
        List<ResponseDetails> timeBasedResults = timeBasedMonitoringService.executeTimeBasedMonitoring();
        List<ResponseDetails> jsonResults = jsonMonitoringService.executeJsonMonitoring();
        
        status.put("api", createServiceStatus("API Services", apiResults));
        status.put("database", createServiceStatus("Database", dbResults));
        status.put("timeBased", createServiceStatus("Time-Based Monitoring", timeBasedResults));
        status.put("json", createServiceStatus("JSON Monitoring", jsonResults));
        
        boolean overallHealth = apiResults.isEmpty() && dbResults.isEmpty() && 
                               timeBasedResults.isEmpty() && jsonResults.isEmpty();
        status.put("overallHealth", overallHealth);
        status.put("lastUpdate", System.currentTimeMillis());
        
        return status;
    }

    @GetMapping("/interfaces")
    public Map<String, Object> getInterfaces() {
        Map<String, Object> interfaces = new HashMap<>();
        
        List<ResponseDetails> apiResults = apiExecuterEngine.execute();
        List<ResponseDetails> dbResults = dbSanityCheck.execute();
        List<ResponseDetails> timeBasedResults = timeBasedMonitoringService.executeTimeBasedMonitoring();
        List<ResponseDetails> jsonResults = jsonMonitoringService.executeJsonMonitoring();
        
        interfaces.put("api", apiResults);
        interfaces.put("database", dbResults);
        interfaces.put("timeBased", timeBasedResults);
        interfaces.put("json", jsonResults);
        
        return interfaces;
    }

    @PostMapping("/execute/{type}")
    public Map<String, Object> executeInterface(@PathVariable String type, @RequestParam(required = false) String name) {
        Map<String, Object> result = new HashMap<>();
        List<ResponseDetails> results;
        
        switch (type.toLowerCase()) {
            case "api":
                results = apiExecuterEngine.execute();
                break;
            case "database":
                results = dbSanityCheck.execute();
                break;
            case "timebased":
                results = timeBasedMonitoringService.executeTimeBasedMonitoring();
                break;
            case "json":
                results = jsonMonitoringService.executeJsonMonitoring();
                break;
            default:
                result.put("error", "Unknown interface type: " + type);
                return result;
        }
        
        result.put("results", results);
        result.put("success", results.isEmpty());
        result.put("timestamp", System.currentTimeMillis());
        
        return result;
    }

    private Map<String, Object> createServiceStatus(String name, List<ResponseDetails> results) {
        Map<String, Object> serviceStatus = new HashMap<>();
        serviceStatus.put("name", name);
        serviceStatus.put("status", results.isEmpty() ? "healthy" : "error");
        serviceStatus.put("errorCount", results.size());
        serviceStatus.put("details", results);
        return serviceStatus;
    }
}