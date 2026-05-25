package com.bsl.service.monitor.service;

import com.bsl.service.monitor.config.TwilioProperties;
import lombok.Data;
import lombok.extern.java.Log;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
@Component
@Data
@Log
@EnableConfigurationProperties(value = TwilioProperties.class)
public class SMSSender {
    @Autowired
    TwilioProperties twilioConfig;
    public SMSSender(){

    }

    public String sendMessage(String text){
        Twilio.init(twilioConfig.getSid(),twilioConfig.getToken());
        String sid = "";
        PhoneNumber sender = new PhoneNumber(twilioConfig.getSender());
        for(String toNumber :twilioConfig.getRecipients()){
            Message message = Message.creator(new PhoneNumber(toNumber),
                    sender,
                    text).create();
            log.info("Message sent "+message.getSid());
            sid+=message.getSid()+" ";
        }
        return  sid;
    }

}
