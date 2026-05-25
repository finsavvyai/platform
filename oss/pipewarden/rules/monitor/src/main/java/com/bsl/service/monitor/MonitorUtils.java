package com.bsl.service.monitor;

import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

public class MonitorUtils {

//EMAIL

    public final static String REPORT_MASSAGE = "" +
            "==========================================================\n" +
            "Hi, \r\n" +
            "Please see massage\r\n " +
            "#MsgText\r\n " +
            "Best regards,\r\n" +
            "Billpro Service Monitor team" +
            "";

    public final static String REPORT_MSG_HTML = "" +
            "<html>" +
            "<body>" +
            "<style>" +
            "table {background-color:  #f5fcf9; font-size: 16px; border-collapse: collapse;}" +
            "th  {color: #393939; border: 1px solid #dde4e0; min-width:200px; padding:4px; text-align: left; font-weight: 500}" +
            "td  {color: #5f2626;border: 1px solid #dde4e0; width:80%; padding:4px;}" +
            "</style>" +
            "<p>Hi," +
            "<br/>Status details:" +
            "<table>"+
            "<p>#MsgText </p>" +
            "</table>"+
            "<p>Best Regards," +
            "<br/>Billpro Service Monitor team " +
            "</body>" +
            "</html>";

    //PROJECT CONSTANTS
    public static final Map<String, String> PROJECT_URL_NAMES =
            Arrays.stream(new String[][]{
                    {"generic", "NinjaGenericInterface"},
                    {"sp", "NinjaSPInterface"},
                    {"mdwc", "NinjaMDWCInterface"},
                    {"teddk", ""}, // TEDDK doesn't need additional path
            }).collect(Collectors.toMap(keyMapper -> keyMapper[0],
                    valueMapper -> valueMapper[1]));


    public final static String SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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";

    public final static String SLACK_TOKEN = "xoxb-408233687559-2435242269521-SD9doYMam1bK4xnzIofrvpPh";

    public final static String SUCCESS = "SUCCESS";
    public final static String FAIL = "FAIL";



}
