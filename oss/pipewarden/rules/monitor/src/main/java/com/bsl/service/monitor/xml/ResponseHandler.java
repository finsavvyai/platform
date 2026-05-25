package com.bsl.service.monitor.xml;


import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.MonitorUtils;
import lombok.extern.java.Log;

import java.util.List;

@Log
public class ResponseHandler {

      public static boolean parseCheckConnResponse(String respXML, String requestName, ResponseDetails responseDetails) {
          return parseCheckConnResponse(respXML,requestName,responseDetails,null);
      }


        public static boolean parseCheckConnResponse(String respXML, String requestName, ResponseDetails responseDetails,List<String> dbIgnoreList){

        boolean isSucceed = true;
        String msg = "";

        if(requestName.contains("CheckConnections")) {
            List<String> resList = ReadParseXml.findParametersByValue(respXML, MonitorUtils.FAIL);
            if(resList == null){
                msg = "\nCheckConnections request failed";
                isSucceed = false;
            }
            else {
                if(dbIgnoreList != null ) {
                    resList.removeAll(dbIgnoreList);
                }
                if (!resList.isEmpty()) {
                    msg = "\nDatabases: " + String.join(",", resList) + " failed";
                    isSucceed = false;
                }
            }
        }
        else if(requestName.contains("GetAvailableMsisdns")){
            String res = ReadParseXml.findParameter(respXML, "Msisdn");
            if (res == null){
                isSucceed = false;
                msg = "\nGetAvailableMsisdns failed";
            }
        }
        else if(requestName.contains("GetAvailableTelephoneNumbers")){
            String res = ReadParseXml.findAttribute(respXML, "LocalNumber");
            if (res == null){
                isSucceed = false;
                 msg = "\nGetAvailableTelephoneNumbersRequest failed";
            }
        }

        if(!isSucceed){
            responseDetails.setMessage(msg);
            responseDetails.setResponseXML("<xmp>" + respXML + "</xmp>");
            log.warning(respXML.replaceAll("\\r|\\n", ""));
        }


        return isSucceed;
    }
}
