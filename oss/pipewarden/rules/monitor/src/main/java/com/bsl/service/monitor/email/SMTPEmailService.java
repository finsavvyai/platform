package com.bsl.service.monitor.email;



import com.bsl.service.monitor.config.EmailProperties;
import lombok.Data;
import lombok.extern.java.Log;
import org.apache.commons.mail.HtmlEmail;
import org.apache.commons.mail.SimpleEmail;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.mail.*;
import java.util.Properties;

@Log
@Data
@Component
public class SMTPEmailService{

    @Autowired
    EmailProperties emailProperties;


    //connect to smtp host in port 25 by default and send email with attachment
    public boolean sendMail(String mailSubject, String mailMessage) {

        if (emailProperties.getRecipients() == null){
            log.warning("no email properties found" );
            return false;
        }

        try{
            // Create the email message
            SimpleEmail email = new SimpleEmail();

            if(emailProperties.isTestmode()){
                email.setMailSession(getSession());
            }
            else {
                email.setHostName(emailProperties.getHost());
            }

            String [] recipientsArray = emailProperties.getZapierRecipients().split(";");

            for(String recipientMail:recipientsArray){
                email.addTo(recipientMail);
            }
            email.setFrom(emailProperties.getSenderEmail(),emailProperties.getFrom());
            email.setSubject(mailSubject);

            // set the html message
            email.setMsg(mailMessage);

            // send the email
            email.send();


        }catch (Exception e){
            e.printStackTrace();
            log.warning("error sending email: "+e.getMessage());
            return false;
        }
        return true;
    }

    public boolean sendHtmlEMail(String mailSubject, String mailMessage,String htmlMessage) {

        if (emailProperties.getRecipients() == null){
            log.warning("no email properties found" );
            return false;
        }

        try{
            // Create the email message
            HtmlEmail email = new HtmlEmail();

            if(emailProperties.isTestmode()){
                email.setMailSession(getSession());
            }
            else {
                email.setHostName(emailProperties.getHost());
            }

            String [] recipientsArray = emailProperties.getRecipients().split(";");

            for(String recipientMail:recipientsArray){
                email.addTo(recipientMail);
            }
            email.setFrom(emailProperties.getSenderEmail(),emailProperties.getFrom());
            email.setSubject(mailSubject);

            // set the html message
            email.setHtmlMsg(htmlMessage);

            // set the alternative message
            email.setTextMsg(mailMessage);

            // send the email
            email.send();


        }catch (Exception e){
            e.printStackTrace();
            log.warning("error sending email: "+e.getMessage());
            return false;
        }
        return true;
    }

    public static SMTPEmailService createEmailService(){
        return new SMTPEmailService();
    }

    private Session getSession() {

        Properties properties = populateProperties();
        return Session.getInstance(properties,
                new Authenticator() {
                    protected PasswordAuthentication getPasswordAuthentication() {
                        return new PasswordAuthentication(emailProperties.getSenderEmail(), emailProperties.getSenderPassword());
                    }
                });

    }


    private Properties populateProperties() {

        Properties properties = new Properties();
        properties.put("mail.smtp.auth", ""+emailProperties.isAuth());
        properties.put("mail.smtp.starttls.enable", ""+emailProperties.isStarttlsenable());
        properties.put("mail.smtp.ssl", ""+emailProperties.isSsl());
        properties.put("mail.smtp.host", emailProperties.getTestHost());
        properties.put("mail.smtp.port", ""+emailProperties.getPort());
        return properties;

    }


}
