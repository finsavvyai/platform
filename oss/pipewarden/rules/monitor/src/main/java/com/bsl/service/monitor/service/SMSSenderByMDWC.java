package com.bsl.service.monitor.service;

import com.bsl.service.monitor.config.SMSProperties;
import com.bsl.service.monitor.config.SanityAPIProperties;
import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.xml.ResponseHandler;
import com.bsl.service.monitor.xml.XmlHandler;
import com.bsl.service.monitor.utils.FileUtils;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;

@Log
@Component
@EnableConfigurationProperties(value = SanityAPIProperties.class)

public class SMSSenderByMDWC {

    @Autowired
    SMSProperties smsProperties;


    public void sendMessageRequest(String message) {

        HashMap<String, Object> requestInput = new HashMap<>();

        requestInput.put("Environment", smsProperties.getEnvName());
        requestInput.put("Project", smsProperties.getService().getName());
        requestInput.put("ProjectUrlConfiguration", smsProperties.getService().getUrl());

        String requestName = null;
        if (smsProperties.getService().getRequests().length > 0) {
            requestName = smsProperties.getService().getRequests()[0];
        }

        requestInput.put("XmlFileName", requestName);
        requestInput.put("XmlDir", FileUtils.XML_REQ_DIR);

        XmlHandler xmlExecuter = null;

        try {
            xmlExecuter = new XmlHandler(requestInput);
        } catch (Exception e) {
            log.warning("Reading of request " + smsProperties.getService() + " failed: " + e.getMessage());
        }

        String[] phoneNumbers = smsProperties.getRecipients().split(";");
        for (String phoneNumber : phoneNumbers) {

            String filledXMLReq = xmlExecuter.getXmlRequest().getXmlRequest()
                    .replace("#msisdn", phoneNumber)
                    .replace("#msg", message);
            xmlExecuter.getXmlRequest().setXmlRequest(filledXMLReq);
            String respXML = xmlExecuter.execute();
            ResponseDetails responseDetails = new ResponseDetails();
            boolean isSuccess = ResponseHandler.parseCheckConnResponse(respXML, requestName, responseDetails);
            if (!isSuccess) {
                log.warning(responseDetails.toString());
            }
        }
    }


}
