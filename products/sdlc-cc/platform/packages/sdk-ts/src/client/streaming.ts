// Streaming and file upload capabilities for the base client

import type { RequestConfig, ApiResponse } from "../types";
import { NetworkError } from "../exceptions";

/**
 * Streaming request (for SSE or chunked responses)
 */
export async function* streamRequest<T = unknown>(
  baseURL: string,
  apiKey: string | undefined,
  config: RequestConfig,
): AsyncGenerator<T, void, unknown> {
  try {
    const response = await fetch(`${baseURL}${config.url}`, {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey ? `Bearer ${apiKey}` : "",
        Accept: "text/event-stream",
        ...config.headers,
      },
      body: config.data ? JSON.stringify(config.data) : undefined,
      signal: config.signal,
    });

    if (!response.ok) {
      throw new NetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new NetworkError("Response body is not readable");
    }

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (_parseError) {
            // Ignore invalid JSON
          }
        }
      }
    }
  } catch (error) {
    throw new NetworkError(
      `Streaming failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Upload file with progress tracking via XHR
 */
export function uploadFileRequest<T = unknown>(
  baseURL: string,
  apiKey: string | undefined,
  url: string,
  file: File | Blob,
  options: {
    field?: string;
    metadata?: Record<string, unknown>;
    onProgress?: (progress: {
      loaded: number;
      total: number;
      percentage: number;
    }) => void;
    signal?: AbortSignal;
  } = {},
): Promise<ApiResponse<T>> {
  const formData = new FormData();
  formData.append(options.field || "file", file);

  if (options.metadata) {
    formData.append("metadata", JSON.stringify(options.metadata));
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          options.onProgress!({
            loaded: event.loaded,
            total: event.total,
            percentage,
          });
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            data,
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parseXHRHeaders(xhr.getAllResponseHeaders()),
            timestamp: new Date().toISOString(),
          });
        } catch (_error) {
          reject(new Error("Invalid response"));
        }
      } else {
        reject(new NetworkError(`HTTP ${xhr.status}: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new NetworkError("Upload failed"));
    });

    xhr.addEventListener("abort", () => {
      reject(new NetworkError("Upload aborted"));
    });

    xhr.open("POST", `${baseURL}${url}`);

    if (apiKey) {
      xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
    }

    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        xhr.abort();
      });
    }

    xhr.send(formData);
  });
}

/**
 * Parse XHR response headers into a record
 */
function parseXHRHeaders(headerStr: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerPairs = headerStr.split("\u000d\u000a");

  for (const headerPair of headerPairs) {
    const index = headerPair.indexOf("\u003a\u0020");
    if (index > 0) {
      const key = headerPair.substring(0, index);
      const value = headerPair.substring(index + 2);
      headers[key] = value;
    }
  }

  return headers;
}
