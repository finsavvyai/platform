/** SSE stream converters for Anthropic and Ollama providers. */

export function convertAnthropicStream(resp, model) {
  const id = `chatcmpl-${crypto.randomUUID().slice(0, 12)}`;
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload);
            if (event.type === "content_block_delta" && event.delta?.text) {
              const chunk = {
                id,
                object: "chat.completion.chunk",
                model,
                choices: [
                  {
                    index: 0,
                    delta: { content: event.delta.text },
                    finish_reason: null,
                  },
                ],
              };
              await writer.write(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
              );
            }
            if (event.type === "message_stop") {
              const chunk = {
                id,
                object: "chat.completion.chunk",
                model,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              };
              await writer.write(
                encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
              );
              await writer.write(encoder.encode("data: [DONE]\n\n"));
            }
          } catch {}
        }
      }
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export function convertOllamaStream(resp, body) {
  const id = `chatcmpl-${crypto.randomUUID().slice(0, 12)}`;
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  (async () => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            const content = chunk.message?.content || "";
            if (content || chunk.done) {
              const sseData = {
                id,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [
                  {
                    index: 0,
                    delta: content ? { content } : {},
                    finish_reason: chunk.done ? "stop" : null,
                  },
                ],
              };
              await writer.write(
                enc.encode(`data: ${JSON.stringify(sseData)}\n\n`),
              );
            }
          } catch (e) {
            /* skip malformed */
          }
        }
      }
      await writer.write(enc.encode("data: [DONE]\n\n"));
    } catch (e) {
      /* stream error */
    }
    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
