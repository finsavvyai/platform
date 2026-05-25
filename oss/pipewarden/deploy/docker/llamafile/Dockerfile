# Prebuilt llamafile sidecar for PipeWarden Enterprise+ air-gap deployments.
# Publishes an OpenAI-compatible HTTP server on :8080 backed by Meta-Llama-3.1-8B-Instruct (Q4_K_M).
# Pair with deploy/helm/pipewarden/values.yaml → airGap.offlineLLM.provider: llamafile.

FROM alpine:3.19

ARG LLAMAFILE_URL=https://huggingface.co/Mozilla/Meta-Llama-3.1-8B-Instruct-llamafile/resolve/main/Meta-Llama-3.1-8B-Instruct.Q4_K_M.llamafile
ARG LLAMAFILE_SHA256=""

RUN apk add --no-cache wget ca-certificates bash

WORKDIR /app

# Download + verify the prebuilt llamafile. Build supplies LLAMAFILE_SHA256 to lock the binary.
RUN wget -qO /app/llama.llamafile "${LLAMAFILE_URL}" && \
    if [ -n "${LLAMAFILE_SHA256}" ]; then \
        echo "${LLAMAFILE_SHA256}  /app/llama.llamafile" | sha256sum -c -; \
    fi && \
    chmod +x /app/llama.llamafile

# llamafile runs via the APE entrypoint; Alpine needs binfmt to cooperate on some hosts.
# Prefer running with --host 0.0.0.0 so a sibling container can reach it.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/v1/models || exit 1

ENTRYPOINT ["/app/llama.llamafile"]
CMD ["--server", "--host", "0.0.0.0", "--port", "8080", "--nobrowser"]
