// FinSavvyAI Desktop Application - API Client

class APIClient {
  constructor(baseURL = "http://localhost:8081") {
    this.baseURL = baseURL;
    this.timeout = 30000; // 30 seconds
  }

  async request(path, options = {}) {
    const url = `${this.baseURL}${path}`;
    const config = {
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }

      return response;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Cluster API
  async getClusterStatus() {
    return this.request("/api/cluster/status");
  }

  async getClusterNodes() {
    return this.request("/api/cluster/nodes");
  }

  async startCluster() {
    return this.request("/api/cluster/start", {
      method: "POST",
    });
  }

  async stopCluster() {
    return this.request("/api/cluster/stop", {
      method: "POST",
    });
  }

  async addNode(nodeConfig) {
    return this.request("/api/cluster/nodes", {
      method: "POST",
      body: JSON.stringify(nodeConfig),
    });
  }

  async removeNode(nodeId) {
    return this.request(`/api/cluster/nodes?id=${encodeURIComponent(nodeId)}`, {
      method: "DELETE",
    });
  }

  // Configuration API
  async getConfig() {
    return this.request("/api/config");
  }

  async updateConfig(config) {
    return this.request("/api/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }
}

// WebSocket Client
class WebSocketClient {
  constructor(url = "ws://localhost:8081/ws") {
    this.url = url;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.eventHandlers = new Map();
    this.isConnecting = false;
  }

  connect() {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit("message", data);

          // Emit specific event types
          if (data.type) {
            this.emit(data.type, data.payload);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.isConnecting = false;
        this.emit("disconnected");

        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(
              `WebSocket reconnect attempt ${this.reconnectAttempts}`,
            );
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.isConnecting = false;
        this.emit("error", error);
      };
    } catch (error) {
      this.isConnecting = false;
      console.error("Failed to create WebSocket connection:", error);
      this.emit("error", error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = typeof data === "string" ? data : JSON.stringify(data);
      this.ws.send(message);
    } else {
      console.warn("WebSocket not connected, cannot send message");
    }
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in WebSocket event handler for ${event}:`,
            error,
          );
        }
      });
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Utility functions
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Error handling
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

// Export classes
if (typeof module !== "undefined" && module.exports) {
  module.exports = { APIClient, WebSocketClient, APIError };
} else {
  window.APIClient = APIClient;
  window.WebSocketClient = WebSocketClient;
  window.APIError = APIError;
}
