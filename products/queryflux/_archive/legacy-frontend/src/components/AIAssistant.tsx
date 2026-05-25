import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Settings,
  X,
  Shield,
  Zap,
  AlertCircle,
  Check,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Connection } from "../lib/supabase";
import { AIService, type AIProvider } from "../lib/ai";

interface AIAssistantProps {
  connection: Connection;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function AIAssistant({ connection, isOpen, onClose }: AIAssistantProps) {
  const { theme } = useTheme();
  const aiService = AIService.getInstance();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `Hello! I'm your AI database assistant. I can help you with:\n\n• Writing and optimizing SQL queries\n• Security analysis\n• Performance recommendations\n• Index suggestions\n• Query explanations\n\nWhat would you like to know about your ${connection.database_type} database?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState(aiService.getConfig());
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "connected" | "error"
  >("idle");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await aiService.generateResponse(input, {
        databaseType: connection.database_type,
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("AI Service Error:", error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please check your AI provider settings.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 w-96 glass-morphism-strong border-l shimmer z-50 flex flex-col"
      style={{ borderColor: theme.colors.border }}
    >
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center glow-effect">
            <Bot className="w-5 h-5" style={{ color: theme.colors.accent }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: theme.colors.text }}>
              AI Assistant
            </h3>
            <p
              className="text-xs"
              style={{ color: theme.colors.textSecondary }}
            >
              Powered by AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg glass-morphism hover-3d transition-all"
          >
            <Settings
              className="w-4 h-4"
              style={{ color: theme.colors.textSecondary }}
            />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg glass-morphism hover-3d transition-all"
          >
            <X
              className="w-4 h-4"
              style={{ color: theme.colors.textSecondary }}
            />
          </button>
        </div>
      </div>

      {showSettings && (
        <div
          className="p-4 glass-card border-b"
          style={{ borderColor: theme.colors.border }}
        >
          <h4
            className="text-sm font-semibold mb-3"
            style={{ color: theme.colors.text }}
          >
            AI Provider Settings
          </h4>

          <div className="space-y-3">
            <div>
              <label
                className="text-xs font-medium mb-1 block"
                style={{ color: theme.colors.text }}
              >
                Provider
              </label>
              <select
                value={aiConfig.defaultProvider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  aiService.updateConfig({ defaultProvider: newProvider });
                  setAiConfig(aiService.getConfig());
                  setConnectionStatus("idle");
                }}
                className="w-full px-3 py-2 text-xs rounded-lg glass-card border outline-none"
                style={{
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                }}
              >
                {aiConfig.providers.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                    disabled={!provider.enabled}
                  >
                    {provider.name} {provider.enabled ? "" : "(disabled)"}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const currentProvider = aiConfig.providers.find(
                (p) => p.id === aiConfig.defaultProvider,
              );
              if (!currentProvider) return null;

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-medium"
                      style={{ color: theme.colors.text }}
                    >
                      Status
                    </span>
                    <div className="flex items-center gap-2">
                      {connectionStatus === "testing" && (
                        <div className="flex items-center gap-1">
                          <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{ backgroundColor: theme.colors.accent }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: theme.colors.textSecondary }}
                          >
                            Testing...
                          </span>
                        </div>
                      )}
                      {connectionStatus === "connected" && (
                        <div className="flex items-center gap-1">
                          <Check
                            className="w-3 h-3"
                            style={{ color: "#10b981" }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: "#10b981" }}
                          >
                            Connected
                          </span>
                        </div>
                      )}
                      {connectionStatus === "error" && (
                        <div className="flex items-center gap-1">
                          <AlertCircle
                            className="w-3 h-3"
                            style={{ color: "#ef4444" }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: "#ef4444" }}
                          >
                            Error
                          </span>
                        </div>
                      )}
                      {connectionStatus === "idle" && (
                        <span
                          className="text-xs"
                          style={{ color: theme.colors.textSecondary }}
                        >
                          Not tested
                        </span>
                      )}
                    </div>
                  </div>

                  {currentProvider.type === "ollama" && (
                    <div>
                      <label
                        className="text-xs font-medium mb-1 block"
                        style={{ color: theme.colors.text }}
                      >
                        Ollama URL
                      </label>
                      <input
                        type="text"
                        value={currentProvider.baseUrl || ""}
                        onChange={(e) => {
                          aiService.updateProvider(currentProvider.id, {
                            baseUrl: e.target.value,
                          });
                          setAiConfig(aiService.getConfig());
                          setConnectionStatus("idle");
                        }}
                        placeholder="http://localhost:11434"
                        className="w-full px-3 py-2 text-xs rounded-lg glass-card border outline-none"
                        style={{
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                        }}
                      />
                    </div>
                  )}

                  {currentProvider.type === "ollama" && (
                    <div>
                      <label
                        className="text-xs font-medium mb-1 block"
                        style={{ color: theme.colors.text }}
                      >
                        Model
                      </label>
                      <select
                        value={currentProvider.model}
                        onChange={(e) => {
                          aiService.updateProvider(currentProvider.id, {
                            model: e.target.value,
                          });
                          setAiConfig(aiService.getConfig());
                        }}
                        className="w-full px-3 py-2 text-xs rounded-lg glass-card border outline-none"
                        style={{
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                        }}
                      >
                        <option value="llama2">Llama 2</option>
                        <option value="llama3">Llama 3</option>
                        <option value="codellama">Code Llama</option>
                        <option value="mistral">Mistral</option>
                        <option value="qwen">Qwen</option>
                        {availableModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(currentProvider.type === "openai" ||
                    currentProvider.type === "anthropic") && (
                    <div>
                      <label
                        className="text-xs font-medium mb-1 block"
                        style={{ color: theme.colors.text }}
                      >
                        API Key
                      </label>
                      <input
                        type="password"
                        value={currentProvider.apiKey || ""}
                        onChange={(e) => {
                          aiService.updateProvider(currentProvider.id, {
                            apiKey: e.target.value,
                          });
                          setAiConfig(aiService.getConfig());
                          setConnectionStatus("idle");
                        }}
                        placeholder={`Enter ${currentProvider.type === "openai" ? "OpenAI" : "Anthropic"} API key`}
                        className="w-full px-3 py-2 text-xs rounded-lg glass-card border outline-none"
                        style={{
                          color: theme.colors.text,
                          borderColor: theme.colors.border,
                        }}
                      />
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      setConnectionStatus("testing");
                      const isWorking =
                        await aiService.testConnection(currentProvider);
                      setConnectionStatus(isWorking ? "connected" : "error");

                      if (isWorking && currentProvider.type === "ollama") {
                        const models = await aiService.getOllamaModels(
                          currentProvider.baseUrl,
                        );
                        setAvailableModels(models);
                      }
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg hover-3d flex items-center justify-center gap-2"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color: "white",
                    }}
                  >
                    Test Connection
                  </button>

                  <button
                    onClick={() => {
                      aiService.updateProvider(currentProvider.id, {
                        enabled: !currentProvider.enabled,
                      });
                      setAiConfig(aiService.getConfig());
                    }}
                    className="w-full text-xs px-3 py-1.5 rounded-lg glass-morphism hover-3d"
                    style={{
                      color: currentProvider.enabled
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                      borderColor: theme.colors.border,
                    }}
                  >
                    {currentProvider.enabled
                      ? "Disable Provider"
                      : "Enable Provider"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 glow-effect ${
                message.role === "assistant" ? "glass-morphism" : ""
              }`}
              style={{
                backgroundColor:
                  message.role === "user"
                    ? theme.colors.accent + "40"
                    : undefined,
              }}
            >
              {message.role === "assistant" ? (
                <Sparkles
                  className="w-4 h-4"
                  style={{ color: theme.colors.accent }}
                />
              ) : (
                <span
                  className="text-sm font-semibold"
                  style={{ color: "white" }}
                >
                  U
                </span>
              )}
            </div>
            <div
              className={`flex-1 ${message.role === "user" ? "text-right" : ""}`}
            >
              <div
                className={`inline-block p-3 rounded-xl text-sm glass-card ${
                  message.role === "user"
                    ? "rounded-tr-none"
                    : "rounded-tl-none"
                }`}
                style={{
                  color: theme.colors.text,
                  borderColor:
                    message.role === "user"
                      ? theme.colors.accent
                      : theme.colors.border,
                  borderWidth: "1px",
                }}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: theme.colors.textSecondary }}
              >
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg glass-morphism flex items-center justify-center glow-effect">
              <Sparkles
                className="w-4 h-4 animate-pulse"
                style={{ color: theme.colors.accent }}
              />
            </div>
            <div className="flex-1">
              <div className="inline-block p-3 rounded-xl rounded-tl-none text-sm glass-card">
                <div className="flex gap-2">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: theme.colors.accent }}
                  />
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      backgroundColor: theme.colors.accent,
                      animationDelay: "0.2s",
                    }}
                  />
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      backgroundColor: theme.colors.accent,
                      animationDelay: "0.4s",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="p-4 border-t glass-morphism-strong"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="flex items-center gap-2 mb-2">
          <button
            className="px-3 py-1.5 text-xs rounded-lg glass-morphism hover-3d flex items-center gap-1"
            style={{ color: theme.colors.textSecondary }}
          >
            <Shield className="w-3 h-3" />
            Security
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-lg glass-morphism hover-3d flex items-center gap-1"
            style={{ color: theme.colors.textSecondary }}
          >
            <Zap className="w-3 h-3" />
            Performance
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask anything about your database..."
            className="flex-1 px-4 py-2.5 rounded-xl glass-card border outline-none text-sm"
            style={{
              color: theme.colors.text,
              borderColor: theme.colors.border,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 rounded-xl font-semibold hover-3d glow-effect disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`,
              color: "white",
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
