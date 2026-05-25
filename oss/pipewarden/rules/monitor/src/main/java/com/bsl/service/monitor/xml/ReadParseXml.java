package com.bsl.service.monitor.xml;

import java.util.ArrayList;
import java.util.List;


public class ReadParseXml {
     final static  String parameterName = "<parameter name";
     final static String secondparameterName = "</parameter>";
     String filePath ;
     String directory;
     String environment;
     String projectName;

    public ReadParseXml(String filePath,String directory,String environment,String projectName) {
       this.filePath = filePath;
       this.directory = directory;
       this.environment =environment;
       this.projectName = projectName;
    }


// found some parameter in xml file(value of nodes)
   static public  String findParameter( String response,String parameter){
        String result = null;
        parameter = parameterName + "="+'"'+parameter+'"';

       Integer indParam = response.indexOf(parameter);
        if(indParam > 0) {
            String respSubString = response.substring(indParam);

            Integer nameStart = respSubString.indexOf(">");
            Integer nameEnd = respSubString.indexOf("</");
            result = respSubString.substring(nameStart+1,nameEnd);
        }

        return result;
    }

    // found some parameter in xml file(value of nodes)
    static public  List<String> findParametersByValue(String response, String reqValue){
        String parameter = parameterName + "="+'"';

        String respSubString = response;

        List<String> resList = new ArrayList<>();

        Integer indParam = respSubString.indexOf(parameter);

        if(indParam < 0){
            return null;
        }


        while (indParam >= 0 && (respSubString.length() > parameter.length())) {

                respSubString = respSubString.substring(indParam);
                respSubString.indexOf(parameter);
                Integer nameStart = respSubString.indexOf(">");
                Integer nameEnd = respSubString.indexOf("</");

                String name = respSubString.substring(parameter.length(), nameStart).replace("\"", "");
                String value = respSubString.substring(nameStart + 1, nameEnd);
               // System.out.println("name" + name + " value" + value);
                respSubString = respSubString.substring(nameEnd + secondparameterName.length() + 2);

                indParam = respSubString.indexOf(parameter);
                if (value.equals(reqValue)) {
                    resList.add(name);
                }

        }

        return resList;
    }

    // found some parameter in xml file(value of nodes)
    static public  String findAttribute(String response,String attribute ){

        String respSubString = response;

        String result = null;

        Integer indParam = respSubString.indexOf(attribute);

        if(indParam > 0) {
            respSubString = response.substring(indParam);
            Integer nameStart = respSubString.indexOf(">");
            Integer nameEnd = respSubString.indexOf("</");
            result = respSubString.substring(nameStart+1,nameEnd);
        }

        return result;
    }


}
