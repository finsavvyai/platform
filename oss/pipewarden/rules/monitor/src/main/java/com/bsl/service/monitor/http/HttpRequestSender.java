package com.bsl.service.monitor.http;

import lombok.extern.java.Log;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;

@Log
public class HttpRequestSender {
    String parameterName = "<parameter name";
    String filePath;
    String directory;
    String environment;
    String projectName;

    public HttpRequestSender(String filePath, String directory, String environment, String projectName) {
        this.filePath = filePath;
        this.directory = directory;
        this.environment = environment;
        this.projectName = projectName;
    }



    static public String sendRequest(String xmlRequestBody, String requestUrl) {
        boolean isDebug = false;
        return sendRequest(xmlRequestBody, requestUrl, isDebug);
    }

    //send xml request to server return request as string
    static public String sendRequest(String xmlRequestBody, String requestUrl, boolean isDebug) {

        StringBuffer response = new StringBuffer();
        if (requestUrl == null || xmlRequestBody == null) {
            return "";
        }

        try {
            URL url = new URL(requestUrl);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();

            con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("POST");
            con.setRequestProperty("Content-Type", "application/soap+xml; charset=utf-8");
            con.setDoOutput(true);

            DataOutputStream wr = new DataOutputStream(con.getOutputStream());
            wr.writeBytes(xmlRequestBody);
            wr.flush();
            wr.close();


            int responseCode = con.getResponseCode();
            BufferedReader in = null;

            if (responseCode == 200) {
                in = new BufferedReader(new InputStreamReader(con.getInputStream()));
            } else {
                in = new BufferedReader(new InputStreamReader(con.getErrorStream()));
            }

            String inputLine = "";
            int i;
            while ((i = in.read()) != -1) {
                response = response.append(inputLine.valueOf((char) i));
            }
            in.close();

        } catch (Exception e) {
            e.printStackTrace();
        }


        return response.toString();
    }


}
