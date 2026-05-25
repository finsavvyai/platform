package com.bsl.service.monitor.xml;

import com.bsl.service.monitor.http.HttpRequestSender;

import java.util.HashMap;


public  class XmlHandler  {

    protected HashMap<String, Object> inputParameters;
    protected HashMap<String, Object> testStepOutput = new HashMap<>();

    protected XmlRequest xmlRequest;

    protected long startTime;

    public XmlHandler(HashMap<String, Object> parameters) throws Exception {
        setup(parameters);
    }

    public void setup(HashMap<String, Object> parameters) throws Exception {

        inputParameters = parameters;
        String project = (String) inputParameters.get("Project");

        String xmlFileName = (String) inputParameters.get("XmlFileName");


        /////////////////////////////////////////////////////////////////////////////////////////////////
        // Create xml request                                                                          //
        //   constructor will                                                                          //
        //    getTemplateFileName                                                                      //
        //    loadXmlTemplateFile                                                                      //
        //    extractPlaceHoldersFromXml                                                               //
        //    placeInputParamersIntoXml                                                                //
        xmlRequest = new XmlRequest(xmlFileName, project, inputParameters);
        startTime = System.currentTimeMillis();
        //                                                                                             //
        /////////////////////////////////////////////////////////////////////////////////////////////////


    }

    public String execute()  {
        return HttpRequestSender.sendRequest(xmlRequest.getXmlRequest(), (String)inputParameters.get("ProjectUrlConfiguration"));

    }

    public XmlRequest getXmlRequest() {
        return xmlRequest;
    }


}
