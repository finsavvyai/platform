package com.bsl.service.monitor.service;

import com.bsl.service.monitor.config.SanityAPIProperties;
import com.bsl.service.monitor.config.TimeBasedProperties;
import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.json.JsonHandler;
import com.bsl.service.monitor.sanity.api.APIExecuterDTO;
import com.bsl.service.monitor.MonitorUtils;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static com.bsl.service.monitor.utils.FileUtils.XML_REQ_DIR;

@Log
@Service
@EnableConfigurationProperties(value = {SanityAPIProperties.class, TimeBasedProperties.class})
public class JsonMonitoringService {

    @Autowired
    SanityAPIProperties sanityAPIProperties;

    @Autowired
    TimeBasedProperties timeBasedProperties;

    public List<ResponseDetails> executeJsonMonitoring() {
        if (!timeBasedProperties.isEnabled()) {
            log.info("JSON monitoring is disabled");
            return new ArrayList<>();
        }

        List<ResponseDetails> responseDetailsList = new ArrayList<>();
        List<APIExecuterDTO> apiExecuterDTOList = sanityAPIProperties.getServices();

        if (apiExecuterDTOList == null || apiExecuterDTOList.isEmpty()) {
            log.info("No API services configured for JSON monitoring");
            return responseDetailsList;
        }

        for (APIExecuterDTO apiExecuterDTO : apiExecuterDTOList) {
            // Check if this is a JSON-based system (not XML-based)
            if (isJsonBasedSystem(apiExecuterDTO.getType())) {
                String project = apiExecuterDTO.getType();
                String url = apiExecuterDTO.getUrl() + MonitorUtils.PROJECT_URL_NAMES.get(project);

                HashMap<String, Object> requestInput = new HashMap<>();
                requestInput.put("Project", project);
                requestInput.put("ProjectUrlConfiguration", url);

                for (String requestName : apiExecuterDTO.getRequests()) {
                    ResponseDetails responseDetails = new ResponseDetails();
                    responseDetails.setDbName(apiExecuterDTO.getName());
                    responseDetails.setProjName(project);
                    responseDetails.setRequestName(requestName);

                    requestInput.put("XmlFileName", requestName);
                    requestInput.put("XmlDir", XML_REQ_DIR);

                    // Get timeout for this specific request or use default
                    int timeoutSeconds = apiExecuterDTO.getTimeoutSeconds() != null ? 
                        apiExecuterDTO.getTimeoutSeconds() : timeBasedProperties.getDefaultTimeoutSeconds();

                    boolean isSuccess = executeJsonRequestWithTimeout(requestInput, responseDetails, timeoutSeconds);
                    if (!isSuccess) {
                        responseDetailsList.add(responseDetails);
                    }
                }
            }
        }
        return responseDetailsList;
    }

    private boolean isJsonBasedSystem(String systemType) {
        // Define which systems use JSON instead of XML
        return "teddk".equals(systemType) || "json".equals(systemType);
    }

    private boolean executeJsonRequestWithTimeout(HashMap<String, Object> requestInput, ResponseDetails responseDetails, int timeoutSeconds) {
        try {
            // Execute the request with timeout
            CompletableFuture<Boolean> future = CompletableFuture.supplyAsync(() -> {
                try {
                    return executeJsonRequest(requestInput, responseDetails);
                } catch (Exception e) {
                    log.warning("Error executing JSON request " + responseDetails.getRequestName() + ": " + e.getMessage());
                    return false;
                }
            });

            return future.get(timeoutSeconds, TimeUnit.SECONDS);

        } catch (java.util.concurrent.TimeoutException e) {
            responseDetails.setMessage("JSON request timed out after " + timeoutSeconds + " seconds");
            log.warning("JSON request " + responseDetails.getRequestName() + " timed out after " + timeoutSeconds + " seconds");
            return false;
        } catch (Exception e) {
            responseDetails.setMessage("Error executing JSON request with timeout: " + e.getMessage());
            log.warning("Error executing JSON request with timeout: " + e.getMessage());
            return false;
        }
    }

    private boolean executeJsonRequest(HashMap<String, Object> requestInput, ResponseDetails responseDetails) {
        try {
            JsonHandler jsonHandler = new JsonHandler(requestInput);
            String respJSON = jsonHandler.execute();
            
            if (respJSON == null || respJSON.trim().isEmpty()) {
                responseDetails.setMessage("JSON request returned empty response");
                return false;
            }

            responseDetails.setResponseXML(respJSON);

            // Parse the response based on the system type
            boolean isSuccess = parseJsonResponse(respJSON, responseDetails);
            
            if (isSuccess) {
                responseDetails.setMessage("JSON sanity check passed");
            } else {
                responseDetails.setMessage("JSON sanity check failed");
            }

            return isSuccess;

        } catch (Exception e) {
            responseDetails.setMessage("Error executing JSON request: " + e.getMessage());
            log.warning("Error executing JSON request " + responseDetails.getRequestName() + ": " + e.getMessage());
            return false;
        }
    }

    private boolean parseJsonResponse(String responseBody, ResponseDetails responseDetails) {
        try {
            String systemType = responseDetails.getProjName();
            
            // Parse response based on system type
            switch (systemType) {
                case "teddk":
                    return parseTEDDKResponse(responseBody, responseDetails);
                default:
                    // Default JSON parsing - check for success status
                    if (responseBody.contains("\"status\":\"Success\"") || 
                        responseBody.contains("\"success\":true") ||
                        responseBody.contains("\"result\":\"ok\"")) {
                        return true;
                    } else {
                        responseDetails.setMessage("JSON response does not indicate success");
                        return false;
                    }
            }
        } catch (Exception e) {
            responseDetails.setMessage("Error parsing JSON response: " + e.getMessage());
            return false;
        }
    }

    private boolean parseTEDDKResponse(String responseBody, ResponseDetails responseDetails) {
        try {
            // Simple JSON parsing to check for success
            if (responseBody.contains("\"status\":\"Success\"")) {
                // Check if all sanity results are valid
                if (responseBody.contains("\"COMPANY_REGISTER_API_ACCESS\":\"Valid\"") &&
                    responseBody.contains("\"COMPANY_REGISTER_VIEW_ACCESS\":\"Valid\"") &&
                    responseBody.contains("\"TEDDK_DB\":\"Valid\"") &&
                    responseBody.contains("\"TEDDK_RR2R_FTP_RESPONSE_ACCESS\":\"Valid\"") &&
                    responseBody.contains("\"TEDDK_RR2R_REQUEST_FTP_ACCESS\":\"Valid\"") &&
                    responseBody.contains("\"TEDDK_S3_RR2R_ACCESS\":\"Valid\"") &&
                    responseBody.contains("\"TEDDK_S3_SAP_ACCESS\":\"Valid\"") &&
                    responseBody.contains("\"TEDDK_SAP_FTP_RESPONSE_ACCESS\":\"Valid\"")) {
                    return true;
                } else {
                    responseDetails.setMessage("TEDDK sanity check failed: Some components are not valid");
                    return false;
                }
            } else {
                responseDetails.setMessage("TEDDK sanity check failed: Status is not Success");
                return false;
            }
        } catch (Exception e) {
            responseDetails.setMessage("Error parsing TEDDK response: " + e.getMessage());
            return false;
        }
    }
}
