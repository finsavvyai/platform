package com.bsl.service.monitor;

import com.bsl.service.monitor.dto.ResponseDetails;
import com.bsl.service.monitor.email.EmailProcessor;
import com.bsl.service.monitor.service.APIExecuterEngine;
import com.bsl.service.monitor.service.DBSanityCheck;
import com.bsl.service.monitor.service.SMSSenderByMDWC;
import com.bsl.service.monitor.service.TimeBasedMonitoringService;
import com.bsl.service.monitor.service.JsonMonitoringService;
import com.bsl.service.monitor.slack.SlackExecuter;
import com.bsl.service.monitor.utils.DateUtils;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Log
@Service
public class ScheduledSanity {

    @Autowired
    APIExecuterEngine apiExecuterEngine;

    @Autowired
    DBSanityCheck dbSanityCheck;

    @Autowired
    SlackExecuter slackExecuter;

    @Autowired
    SMSSenderByMDWC smsSender;

    @Autowired
    EmailProcessor emailProcessor;

    @Autowired
    TimeBasedMonitoringService timeBasedMonitoringService;

    @Autowired
    JsonMonitoringService jsonMonitoringService;

    @Value("${email_enabled}")
    boolean isEmailEnabled;

    @Value("${sms_enabled}")
    boolean isSMSEnabled;

    @Value("${zapier_enabled}")
    boolean isZapierEnabled;

    @Value("${message_subject}")
    String messageSubject;

    @Value("${envname}")
    String envName;

    @Value("${scheduler.skip_time_interval:#{null}}")
    String skipTimeInterval;


    static String fullSubjName =  null;


    @Scheduled(fixedDelayString = "${scheduler.period}")
    public void scheduleTask() {


        if(skipTimeInterval != null) {
            String[] timeArray = skipTimeInterval.split("-");
            if(timeArray.length == 2) {
                String startTime = timeArray[0];
                String endTime = timeArray[1];
                if (DateUtils.isNowInInterval(startTime, endTime)) {
                    log.info("Sanity skipped: the time is " +
                            DateUtils.getCurrentHour() + " between " + startTime + " and " + endTime);
                    return;
                }
            }
        }

        List<ResponseDetails> responseDetailsListAPI = apiExecuterEngine.execute();
        List<ResponseDetails> responseDetailsListDB = dbSanityCheck.execute();
        List<ResponseDetails> responseDetailsListTimeBased = timeBasedMonitoringService.executeTimeBasedMonitoring();
        List<ResponseDetails> responseDetailsListJson = jsonMonitoringService.executeJsonMonitoring();

        if(responseDetailsListAPI.isEmpty() && responseDetailsListDB.isEmpty() && responseDetailsListTimeBased.isEmpty() && responseDetailsListJson.isEmpty()){
            log.info("No errors found");
            return ;
        }

        String htmlMessage = createHTMLMessage(responseDetailsListAPI,responseDetailsListDB,responseDetailsListTimeBased,responseDetailsListJson);
        String plainMessage = createPlainMessage(responseDetailsListAPI,responseDetailsListDB,responseDetailsListTimeBased,responseDetailsListJson);

        if(fullSubjName == null){
            fullSubjName = messageSubject + " of " + envName;
        }

        if(isEmailEnabled) {
            emailProcessor.sendHtmlEmail(fullSubjName, htmlMessage);
        }
        if(isZapierEnabled) {
            emailProcessor.sendEmail(fullSubjName, plainMessage);
        }

        if(isSMSEnabled) {
            smsSender.sendMessageRequest(plainMessage);
        }

        log.warning("Sanity finished with errors: \n" + plainMessage);

    }



        private String createHTMLMessage(List<ResponseDetails> responseDetailsListAPI,List<ResponseDetails> responseDetailsListDB,List<ResponseDetails> responseDetailsListTimeBased,List<ResponseDetails> responseDetailsListJson) {


            String htmlMsg = "";

            if(!responseDetailsListAPI.isEmpty()) {
                htmlMsg += "<h4>API Sanity</h4>";

                htmlMsg +=  "<table>"
                        + "<tr>"
                        +" <th>envName</th>"
                        + " <th>projName</th>"
                        + " <th>requestName</th>"
                        + " <th>message</th>"
                        + " <th>responseXML</th>"
                        + "</tr>";

                for (ResponseDetails responseDetails : responseDetailsListAPI) {
                    htmlMsg += responseDetails.toStringHTML();
                }

                htmlMsg += "</table>";
            }

            if(!responseDetailsListTimeBased.isEmpty()) {
                htmlMsg += "<h4>Time-Based Monitoring</h4>";

                htmlMsg +=  "<table>"
                        + "<tr>"
                        +" <th>envName</th>"
                        + " <th>projName</th>"
                        + " <th>requestName</th>"
                        + " <th>message</th>"
                        + " <th>responseXML</th>"
                        + "</tr>";

                for (ResponseDetails responseDetails : responseDetailsListTimeBased) {
                    htmlMsg += responseDetails.toStringHTML();
                }

                htmlMsg += "</table>";
            }

            if(!responseDetailsListJson.isEmpty()) {
                htmlMsg += "<h4>JSON Monitoring</h4>";

                htmlMsg +=  "<table>"
                        + "<tr>"
                        +" <th>envName</th>"
                        + " <th>projName</th>"
                        + " <th>requestName</th>"
                        + " <th>message</th>"
                        + " <th>responseXML</th>"
                        + "</tr>";

                for (ResponseDetails responseDetails : responseDetailsListJson) {
                    htmlMsg += responseDetails.toStringHTML();
                }

                htmlMsg += "</table>";
            }

            if(!responseDetailsListDB.isEmpty()) {
                htmlMsg += "<h4>DB Sanity</h4>";

                htmlMsg +=  "<table>"
                        + "<tr>"
                        + " <th>dbName</th>"
                        + " <th>message</th>"
                        + "</tr>";

                for (ResponseDetails responseDetails : responseDetailsListDB) {
                    htmlMsg += responseDetails.toStringHTML();
                }

                htmlMsg += "</table>";
            }

            return htmlMsg;
        }


        private String createPlainMessage(List<ResponseDetails> responseDetailsListAPI,List<ResponseDetails> responseDetailsListDB,List<ResponseDetails> responseDetailsListTimeBased,List<ResponseDetails> responseDetailsListJson){

         String message = messageSubject +"\n";

        if(!responseDetailsListAPI.isEmpty()) {
            message += "API Requests\n";

            for (ResponseDetails responseDetails : responseDetailsListAPI) {
                message += responseDetails.toString();
            }
        }

        if(!responseDetailsListTimeBased.isEmpty()) {
            message += "Time-Based Monitoring\n";

            for (ResponseDetails responseDetails : responseDetailsListTimeBased) {
                message += responseDetails.toString();
            }
        }

        if(!responseDetailsListJson.isEmpty()) {
            message += "JSON Monitoring\n";

            for (ResponseDetails responseDetails : responseDetailsListJson) {
                message += responseDetails.toString();
            }
        }

        if(!responseDetailsListDB.isEmpty()) {
            message += "DB Sanity\n";

            for (ResponseDetails responseDetails : responseDetailsListDB) {
                message += responseDetails.toString();
            }
        }

         return message;

    }


    public  void sendbySlack( String slackMsg)  {

            try {
            slackExecuter.execute(slackMsg);
        } catch (IOException e) {
            log.warning("Slack message sending failed: " + e.getMessage());
            e.printStackTrace();
        }


    }




}
