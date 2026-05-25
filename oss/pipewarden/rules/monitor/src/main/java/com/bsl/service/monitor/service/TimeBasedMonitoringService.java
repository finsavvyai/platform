package com.bsl.service.monitor.service;

import com.bsl.service.monitor.config.SanityAPIProperties;
import com.bsl.service.monitor.config.TimeBasedProperties;
import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.sanity.api.APIExecuterDTO;
import com.bsl.service.monitor.xml.ResponseHandler;
import com.bsl.service.monitor.xml.XmlHandler;
import com.bsl.service.monitor.MonitorUtils;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static com.bsl.service.monitor.utils.FileUtils.XML_REQ_DIR;

@Log
@Service
@EnableConfigurationProperties(value = {SanityAPIProperties.class, TimeBasedProperties.class})
public class TimeBasedMonitoringService {

    @Autowired
    SanityAPIProperties sanityAPIProperties;

    @Autowired
    TimeBasedProperties timeBasedProperties;

    public List<ResponseDetails> executeTimeBasedMonitoring() {
        if (!timeBasedProperties.isEnabled()) {
            log.info("Time-based monitoring is disabled");
            return new ArrayList<>();
        }

        HashMap<String, Object> requestInput = new HashMap<>();
        List<APIExecuterDTO> apiExecuterDTOList = sanityAPIProperties.getServices();
        List<ResponseDetails> responseDetailsList = new ArrayList<>();

        if (apiExecuterDTOList == null || apiExecuterDTOList.isEmpty()) {
            log.info("No API services configured for time-based monitoring");
            return responseDetailsList;
        }

        for (APIExecuterDTO apiExecuterDTO : apiExecuterDTOList) {
            String project = apiExecuterDTO.getType();
            String url = apiExecuterDTO.getUrl() + MonitorUtils.PROJECT_URL_NAMES.get(project);

            requestInput.put("Project", project);
            requestInput.put("ProjectUrlConfiguration", url);

            for (String requestName : apiExecuterDTO.getRequests()) {
                // Check if this request is in the TimeBase folder
                if (isTimeBasedRequest(requestName)) {
                    ResponseDetails responseDetails = new ResponseDetails();
                    responseDetails.setDbName(apiExecuterDTO.getName());
                    responseDetails.setProjName(project);
                    responseDetails.setRequestName(requestName);

                    requestInput.put("XmlFileName", requestName);
                    requestInput.put("XmlDir", XML_REQ_DIR);

                    // Get timeout for this specific request or use default
                    int timeoutSeconds = apiExecuterDTO.getTimeoutSeconds() != null ? 
                        apiExecuterDTO.getTimeoutSeconds() : timeBasedProperties.getDefaultTimeoutSeconds();

                    boolean isSuccess = executeWithTimeout(requestInput, responseDetails, timeoutSeconds);
                    if (!isSuccess) {
                        responseDetailsList.add(responseDetails);
                    }
                }
            }
        }
        return responseDetailsList;
    }

    private boolean isTimeBasedRequest(String requestName) {
        // Check if the request XML file exists in the TimeBase folder
        String timeBasePath = XML_REQ_DIR + "mdwc/TimeBase/" + requestName + ".xml";
        try {
            return getClass().getResourceAsStream(timeBasePath) != null;
        } catch (Exception e) {
            log.warning("Error checking if request " + requestName + " is time-based: " + e.getMessage());
            return false;
        }
    }

    private boolean executeWithTimeout(HashMap<String, Object> requestInput, ResponseDetails responseDetails, int timeoutSeconds) {
        try {
            XmlHandler xmlExecuter = new XmlHandler(requestInput);
            
            // Execute the request with timeout
            CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
                try {
                    return xmlExecuter.execute();
                } catch (Exception e) {
                    log.warning("Error executing time-based request " + responseDetails.getRequestName() + ": " + e.getMessage());
                    return null;
                }
            });

            String respXML = future.get(timeoutSeconds, TimeUnit.SECONDS);
            
            if (respXML == null) {
                responseDetails.setMessage("Request failed to execute within " + timeoutSeconds + " seconds");
                return false;
            }

            // Parse the response
            List<String> dbIgnoreList = null;
            APIExecuterDTO apiExecuterDTO = findApiExecuterDTO(responseDetails.getDbName());
            if (apiExecuterDTO != null && apiExecuterDTO.getDbignorelist() != null) {
                dbIgnoreList = Arrays.asList(apiExecuterDTO.getDbignorelist());
            }

            boolean isSuccess = ResponseHandler.parseCheckConnResponse(respXML, responseDetails.getRequestName(), responseDetails, dbIgnoreList);
            
            if (isSuccess) {
                responseDetails.setMessage("Request completed successfully within " + timeoutSeconds + " seconds");
            } else {
                responseDetails.setMessage("Request failed validation within " + timeoutSeconds + " seconds");
            }
            
            return isSuccess;

        } catch (java.util.concurrent.TimeoutException e) {
            responseDetails.setMessage("Request timed out after " + timeoutSeconds + " seconds");
            log.warning("Time-based request " + responseDetails.getRequestName() + " timed out after " + timeoutSeconds + " seconds");
            return false;
        } catch (Exception e) {
            responseDetails.setMessage("Error executing time-based request: " + e.getMessage());
            log.warning("Error executing time-based request " + responseDetails.getRequestName() + ": " + e.getMessage());
            return false;
        }
    }

    private APIExecuterDTO findApiExecuterDTO(String name) {
        List<APIExecuterDTO> services = sanityAPIProperties.getServices();
        if (services == null || services.isEmpty()) {
            return null;
        }
        return services.stream()
                .filter(dto -> dto.getName().equals(name))
                .findFirst()
                .orElse(null);
    }
}
