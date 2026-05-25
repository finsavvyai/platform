package com.bsl.service.monitor.json;

import com.bsl.service.monitor.utils.FileUtils;
import lombok.Data;
import lombok.extern.java.Log;

import java.util.HashMap;
import java.util.Map;

@Log
@Data
public class JsonRequest {
    private String url;
    private String method;
    private Map<String, String> headers;
    private Map<String, Object> expectedResponse;
    private String requestContent;

    public JsonRequest(String requestName, String project, HashMap<String, Object> inputParameters) throws Exception {
        loadRequestFile(requestName, project, inputParameters);
    }

    private void loadRequestFile(String requestName, String project, HashMap<String, Object> inputParameters) throws Exception {
        String fileName = "/requestXMLs/" + project + "/" + requestName + ".json";
        String fileContent = FileUtils.loadFileToString(fileName);
        
        if (fileContent == null || fileContent.trim().isEmpty()) {
            throw new Exception("Could not load JSON request file: " + fileName);
        }

        // Parse the JSON content (simplified parsing for this example)
        parseJsonContent(fileContent);
        
        // Replace any placeholders in the URL if needed
        if (inputParameters.containsKey("ProjectUrlConfiguration")) {
            String baseUrl = (String) inputParameters.get("ProjectUrlConfiguration");
            this.url = baseUrl + this.url;
        }
    }

    private void parseJsonContent(String jsonContent) {
        // Simple JSON parsing - in a real implementation, you might want to use a JSON library
        this.url = extractValue(jsonContent, "\"url\":");
        this.method = extractValue(jsonContent, "\"method\":");
        
        // Parse headers
        this.headers = new HashMap<>();
        String headersSection = extractSection(jsonContent, "\"headers\":", "}");
        if (headersSection != null) {
            parseHeaders(headersSection);
        }
        
        // Parse expected response
        String expectedResponseSection = extractSection(jsonContent, "\"expectedResponse\":", "}");
        if (expectedResponseSection != null) {
            parseExpectedResponse(expectedResponseSection);
        }
    }

    private String extractValue(String content, String key) {
        int startIndex = content.indexOf(key);
        if (startIndex == -1) return null;
        
        startIndex += key.length();
        int endIndex = content.indexOf(",", startIndex);
        if (endIndex == -1) endIndex = content.indexOf("}", startIndex);
        if (endIndex == -1) endIndex = content.indexOf("\n", startIndex);
        
        if (endIndex == -1) return null;
        
        String value = content.substring(startIndex, endIndex).trim();
        return value.replaceAll("\"", "").replaceAll("'", "");
    }

    private String extractSection(String content, String key, String endChar) {
        int startIndex = content.indexOf(key);
        if (startIndex == -1) return null;
        
        startIndex += key.length();
        int braceCount = 0;
        int endIndex = startIndex;
        
        for (int i = startIndex; i < content.length(); i++) {
            char c = content.charAt(i);
            if (c == '{') braceCount++;
            else if (c == '}') {
                braceCount--;
                if (braceCount == 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
        
        return content.substring(startIndex, endIndex);
    }

    private void parseHeaders(String headersSection) {
        // Simple header parsing
        String[] lines = headersSection.split(",");
        for (String line : lines) {
            if (line.contains(":")) {
                String[] parts = line.split(":");
                if (parts.length >= 2) {
                    String key = parts[0].trim().replaceAll("\"", "");
                    String value = parts[1].trim().replaceAll("\"", "");
                    this.headers.put(key, value);
                }
            }
        }
    }

    private void parseExpectedResponse(String expectedResponseSection) {
        // For now, just store the raw content
        this.expectedResponse = new HashMap<>();
        // In a real implementation, you would parse the JSON structure
    }

    public String getRequestContent() {
        return this.requestContent;
    }
}
