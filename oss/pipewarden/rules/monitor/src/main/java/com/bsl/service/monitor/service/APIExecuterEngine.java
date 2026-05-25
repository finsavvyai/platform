package com.bsl.service.monitor.service;

import com.bsl.service.monitor.config.SanityAPIProperties;
import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.sanity.api.APIExecuterDTO;
import com.bsl.service.monitor.xml.ResponseHandler;
import com.bsl.service.monitor.xml.XmlHandler;
import com.bsl.service.monitor.MonitorUtils;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

import static com.bsl.service.monitor.utils.FileUtils.XML_REQ_DIR;

@Log
@Component
@EnableConfigurationProperties(value = SanityAPIProperties.class)

public class APIExecuterEngine {

    @Autowired
    SanityAPIProperties sanityAPIProperties;


    public List<ResponseDetails> execute() {

        HashMap<String, Object> requestInput = new HashMap<>();
        List<APIExecuterDTO> apiExecuterDTOList = sanityAPIProperties.getServices();
        List<ResponseDetails> responseDetailsList = new ArrayList<>();

        if (apiExecuterDTOList == null || apiExecuterDTOList.isEmpty()) {
            log.info("No API services configured or empty service list");
            return responseDetailsList;
        }

        for (APIExecuterDTO apiExecuterDTO : apiExecuterDTOList) {

            String project = apiExecuterDTO.getType();
            String url = apiExecuterDTO.getUrl() + MonitorUtils.PROJECT_URL_NAMES.get(project);

            requestInput.put("Project", project);

            requestInput.put("ProjectUrlConfiguration", url);

            for (String requestName : apiExecuterDTO.getRequests()) {
                ResponseDetails responseDetails = new ResponseDetails();
                responseDetails.setDbName(apiExecuterDTO.getName());
                responseDetails.setProjName(project);
                responseDetails.setRequestName(requestName);

                requestInput.put("XmlFileName", requestName);
                requestInput.put("XmlDir", XML_REQ_DIR);

                XmlHandler xmlExecuter = null;
                try {
                    xmlExecuter = new XmlHandler(requestInput);
                } catch (Exception e) {
                    log.warning("Reading of request " + requestName + " failed: " + e.getMessage());
                }
                String respXML = xmlExecuter.execute();
                List<String> dbIgnoreList = null;
                if (apiExecuterDTO.getDbignorelist() != null) {
                    dbIgnoreList = Arrays.asList(apiExecuterDTO.getDbignorelist());
                }
                boolean isSuccess = ResponseHandler.parseCheckConnResponse(respXML, requestName, responseDetails, dbIgnoreList);
                if (!isSuccess) {
                    responseDetailsList.add(responseDetails);
                }
            }

        }
        return responseDetailsList;
    }


}
