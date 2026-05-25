package com.bsl.service.monitor.xml;


import com.bsl.service.monitor.utils.FileUtils;
import com.bsl.service.monitor.utils.StringUtils;
import lombok.Data;
import org.springframework.stereotype.Service;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/*import org.apache.log4j.LogManager;
import org.apache.log4j.Logger;

import javax.ws.rs.core.UriBuilder;*/

/**
 * Created by vmb5390 on 22.11.2018.
 */
@Data
@Service
public class XmlRequest {

    HashMap<String, Object> xmlInputParameters;
    private String xmlTemplateFileName;
    private String xmlRequest;
    private List<String> xmlPlaceHolders = new ArrayList<String>();

    public XmlRequest() {
    }


    public XmlRequest(String xmlFileName, String projectName, HashMap<String, Object> inputParameters) {

        String xmlDir = (String) inputParameters.get("XmlDir");

        xmlTemplateFileName = this.getTemplateFileName(xmlFileName, projectName, xmlDir);

        loadXmlTemplateFile();

        xmlInputParameters = inputParameters;

    }

    private void loadXmlTemplateFile() {
        try {
            xmlRequest = FileUtils.loadFileToString(xmlTemplateFileName);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    public String getTemplateFileName(String className, String projectName, String xmlDir) {

        String xmlProjDir = xmlDir + projectName + File.separator;

        String xmlFileName = className + ".xml";

        String xmlTemplateFileName = xmlProjDir + xmlFileName;

        xmlTemplateFileName = StringUtils.strTranslateFileSeperator(xmlTemplateFileName);

        return xmlTemplateFileName;
    }


}
