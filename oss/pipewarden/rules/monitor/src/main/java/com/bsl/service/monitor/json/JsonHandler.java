package com.bsl.service.monitor.json;

import lombok.extern.java.Log;

import java.util.HashMap;

@Log
public class JsonHandler {
    protected HashMap<String, Object> inputParameters;
    protected JsonRequest jsonRequest;
    protected long startTime;

    public JsonHandler(HashMap<String, Object> parameters) throws Exception {
        setup(parameters);
    }

    public void setup(HashMap<String, Object> parameters) throws Exception {
        inputParameters = parameters;
        String project = (String) inputParameters.get("Project");
        String requestName = (String) inputParameters.get("XmlFileName");

        // Create JSON request
        jsonRequest = new JsonRequest(requestName, project, inputParameters);
        startTime = System.currentTimeMillis();
    }

    public String execute() {
        return executeJsonRequest();
    }

    private String executeJsonRequest() {
        try {
            String url = jsonRequest.getUrl();
            String method = jsonRequest.getMethod();
            
            if ("GET".equalsIgnoreCase(method)) {
                return executeGETRequest(url);
            } else {
                log.warning("Unsupported HTTP method: " + method);
                return "";
            }
        } catch (Exception e) {
            log.warning("Error executing JSON request: " + e.getMessage());
            return "";
        }
    }

    private String executeGETRequest(String url) {
        try {
            java.net.URL apiUrl = new java.net.URL(url);
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) apiUrl.openConnection();

            // Set method
            connection.setRequestMethod("GET");

            // Set headers
            if (jsonRequest.getHeaders() != null) {
                for (java.util.Map.Entry<String, String> header : jsonRequest.getHeaders().entrySet()) {
                    connection.setRequestProperty(header.getKey(), header.getValue());
                }
            }

            // Set timeout
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(30000);

            // Get response
            int responseCode = connection.getResponseCode();
            java.io.BufferedReader reader;
            
            if (responseCode == 200) {
                reader = new java.io.BufferedReader(new java.io.InputStreamReader(connection.getInputStream()));
            } else {
                reader = new java.io.BufferedReader(new java.io.InputStreamReader(connection.getErrorStream()));
            }

            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();

            return response.toString();

        } catch (Exception e) {
            log.warning("Error executing GET request: " + e.getMessage());
            return "";
        }
    }

    public JsonRequest getJsonRequest() {
        return jsonRequest;
    }
}
