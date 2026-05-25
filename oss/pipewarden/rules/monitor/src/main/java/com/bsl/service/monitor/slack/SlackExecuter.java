package com.bsl.service.monitor.slack;

import com.bsl.service.monitor.MonitorUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.slack.api.Slack;
import com.slack.api.methods.MethodsClient;
import com.slack.api.webhook.Payload;
import com.slack.api.webhook.WebhookResponse;
import lombok.extern.java.Log;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.springframework.stereotype.Component;

import java.io.IOException;

import static com.bsl.service.monitor.MonitorUtils.SLACK_WEBHOOK_URL;

@Log
@Component
public class SlackExecuter {

    private MethodsClient methodsClient = Slack.getInstance().methods("");


    public static void main(String[] args) throws Exception {

        SlackExecuter slackExecuter = new SlackExecuter();
        slackExecuter.execute("Hello");
    }

    public void execute(String msg) throws IOException {
        Slack slack = Slack.getInstance();
        String webhookUrl = SLACK_WEBHOOK_URL;
        Payload payload = Payload.builder().text(msg).build();

        WebhookResponse response = slack.send(webhookUrl, payload);
        log.info(response.getMessage());

        CloseableHttpClient client = HttpClients.createDefault();
        HttpPost httpPost = new HttpPost(SLACK_WEBHOOK_URL);

        httpPost.setHeader("Content-type", "application/json");

        ObjectMapper objectMapper = new ObjectMapper();
        ObjectNode jsonNode = objectMapper.createObjectNode();
        jsonNode.put("text",msg);
        String json = objectMapper.writeValueAsString(jsonNode);

        StringEntity stringEntity = new StringEntity(json);
        httpPost.getRequestLine();
        httpPost.setEntity(stringEntity);

    }





}
