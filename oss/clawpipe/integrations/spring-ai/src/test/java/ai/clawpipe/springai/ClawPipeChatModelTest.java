package ai.clawpipe.springai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link ClawPipeChatModel} with a mocked {@link HttpClient}.
 *
 * <p>Note: {@code doReturn(...).when(...)} is used instead of
 * {@code when(...).thenReturn(...)} to work around Mockito's raw-type
 * inference on {@code HttpClient.send(request, handler)}, which is typed as
 * {@code <T> HttpResponse<T>} and causes a compile-time generic mismatch.
 */
@ExtendWith(MockitoExtension.class)
@SuppressWarnings({"unchecked", "rawtypes"})
class ClawPipeChatModelTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse httpResponse;

    private ClawPipeProperties properties;
    private ClawPipeChatModel chatModel;

    @BeforeEach
    void setUp() {
        properties = new ClawPipeProperties();
        properties.setApiKey("cp_test_key");
        properties.setGatewayUrl("https://api.clawpipe.ai");
        properties.setDefaultModel("auto");
        properties.setDefaultProvider("openai");
        properties.setTimeoutSeconds(30);
        chatModel = new ClawPipeChatModel(properties, httpClient, new ObjectMapper());
    }

    // ------------------------------------------------------------------
    // Test 1: successful response returns correct text
    // ------------------------------------------------------------------
    @Test
    void call_returnsAssistantMessageText() throws Exception {
        String responseJson =
                "{\"text\":\"Recursion is when a function calls itself.\","
                + "\"tokensIn\":10,\"tokensOut\":20,\"latencyMs\":150}";
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(responseJson);
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        ChatResponse response = chatModel.call(new Prompt("Explain recursion"));

        assertThat(response.getResult().getOutput().getText())
                .isEqualTo("Recursion is when a function calls itself.");
    }

    // ------------------------------------------------------------------
    // Test 2: Authorization header is set with api key
    // ------------------------------------------------------------------
    @Test
    void call_sendsAuthorizationHeader() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"text\":\"ok\"}");
        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        doReturn(httpResponse).when(httpClient).send(requestCaptor.capture(), any());

        chatModel.call(new Prompt("Hello"));

        HttpRequest captured = requestCaptor.getValue();
        assertThat(captured.headers().firstValue("Authorization"))
                .hasValue("Bearer cp_test_key");
    }

    // ------------------------------------------------------------------
    // Test 3: URL targets /v1/prompt on the configured gateway
    // ------------------------------------------------------------------
    @Test
    void call_postsToCorrectUrl() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"text\":\"ok\"}");
        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        doReturn(httpResponse).when(httpClient).send(requestCaptor.capture(), any());

        chatModel.call(new Prompt("Hello"));

        assertThat(requestCaptor.getValue().uri().toString())
                .isEqualTo("https://api.clawpipe.ai/v1/prompt");
    }

    // ------------------------------------------------------------------
    // Test 4: HTTP 4xx throws ClawPipeException with status code in message
    // ------------------------------------------------------------------
    @Test
    void call_throwsOnHttpError() throws Exception {
        when(httpResponse.statusCode()).thenReturn(401);
        when(httpResponse.body()).thenReturn("{\"error\":\"Unauthorized\"}");
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        assertThatThrownBy(() -> chatModel.call(new Prompt("Hello")))
                .isInstanceOf(ClawPipeChatModel.ClawPipeException.class)
                .hasMessageContaining("401");
    }

    // ------------------------------------------------------------------
    // Test 5: enableBooster and enableCache flags are serialised in body
    // ------------------------------------------------------------------
    @Test
    void call_sendsBoosterAndCacheFlags() throws Exception {
        properties.setEnableBooster(false);
        properties.setEnableCache(false);

        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn("{\"text\":\"ok\"}");
        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        doReturn(httpResponse).when(httpClient).send(requestCaptor.capture(), any());

        chatModel.call(new Prompt("Hello"));

        // Extract the raw JSON body from the captured request's body publisher
        String body = readBodyPublisher(requestCaptor.getValue());
        assertThat(body).contains("\"enableBooster\":false");
        assertThat(body).contains("\"enableCache\":false");
    }

    // ------------------------------------------------------------------
    // Test 6: IOException from HttpClient is wrapped in ClawPipeException
    // ------------------------------------------------------------------
    @Test
    void call_wrapsIoExceptionAsClawPipeException() throws Exception {
        doThrow(new IOException("Connection refused"))
                .when(httpClient).send(any(HttpRequest.class), any());

        assertThatThrownBy(() -> chatModel.call(new Prompt("Hello")))
                .isInstanceOf(ClawPipeChatModel.ClawPipeException.class)
                .hasMessageContaining("ClawPipe gateway");
    }

    // ------------------------------------------------------------------
    // Helper: synchronously drain an HttpRequest.BodyPublisher to a String
    // ------------------------------------------------------------------
    private static String readBodyPublisher(HttpRequest request) {
        return request.bodyPublisher().map(publisher -> {
            var ref = new Object() { String value = ""; };
            publisher.subscribe(new java.util.concurrent.Flow.Subscriber<>() {
                final java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();

                @Override
                public void onSubscribe(java.util.concurrent.Flow.Subscription sub) {
                    sub.request(Long.MAX_VALUE);
                }

                @Override
                public void onNext(java.nio.ByteBuffer item) {
                    byte[] bytes = new byte[item.remaining()];
                    item.get(bytes);
                    baos.writeBytes(bytes);
                }

                @Override
                public void onError(Throwable t) {}

                @Override
                public void onComplete() {
                    ref.value = baos.toString(java.nio.charset.StandardCharsets.UTF_8);
                }
            });
            return ref.value;
        }).orElse("");
    }
}
