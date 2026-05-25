package com.bsl.service.monitor.dto;

import lombok.Data;

@Data
public class ResponseDetails {
    String dbName;
    String projName;
    String requestName;
    String message;
    String responseXML;

    @Override
    public String toString() {
        return  (dbName != null ?  "dbName='" + dbName + '\'' + "\n" : "") +
                (projName != null ?  "projName='" + projName + '\'' + "\n" : "") +

                "message='" + message + '\'' + "\n" +
                "---------------\n"
                ;
    }

    public String toStringHTML() {


        return "<tr>" +
                (dbName != null ?  "<th>" + dbName + "</th>" :"" )+
                (projName != null ? "<th>" +  projName + "</th>"  :"" )+
                (requestName != null ? "<th>" +  requestName + "</th>" :"" )+
                "<th>" + message + "</th>" +
                (requestName != null ? "<th>"+ responseXML + "</th>" :"" )+
                "</tr>";
    }


}
