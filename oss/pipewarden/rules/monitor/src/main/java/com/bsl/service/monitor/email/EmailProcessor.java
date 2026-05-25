package com.bsl.service.monitor.email;


import com.bsl.service.monitor.MonitorUtils;
import lombok.Data;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.logging.Level;


@Component
@Log
@Data
public  class EmailProcessor {

    @Autowired
    protected SMTPEmailService smtpEmailService;

    protected String emailSubject;

    String recipientsArray[]=null;

    public EmailProcessor() {

        smtpEmailService = SMTPEmailService.createEmailService();
        log.log(Level.INFO, "EmailProcessor opened");

    }

    public void withEmailSubject(String subject) {
        emailSubject = subject;
    }



    public boolean sendHtmlEmail( String emailSubject,String message) {

        withEmailSubject(emailSubject);

        String emailContent = populateEmailContent( MonitorUtils.REPORT_MASSAGE,message);
        String htmlEmailContent = populateEmailContent( MonitorUtils.REPORT_MSG_HTML,message);

        return smtpEmailService.sendHtmlEMail(  emailSubject, emailContent, htmlEmailContent);


    }


    public boolean sendEmail( String emailSubject,String message) {

        withEmailSubject(emailSubject);
        String emailContent = populateEmailContent( MonitorUtils.REPORT_MASSAGE,message);

        return smtpEmailService.sendMail(  emailSubject, emailContent);
    }




    public String populateEmailContent(  String emailTemplate, String emailText){

        String emailContent = emailTemplate;

        emailContent = emailContent.replace("#MsgText", emailText);

        return emailContent;
    }

}
