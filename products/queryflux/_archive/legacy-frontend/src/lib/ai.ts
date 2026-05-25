export interface AIProvider {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "ollama" | "custom";
  apiKey?: string;
  baseUrl?: string;
  model: string;
  enabled: boolean;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface AIConfig {
  providers: AIProvider[];
  defaultProvider: string;
  temperature: number;
  maxTokens: number;
}

export class AIService {
  private config: AIConfig;
  private static instance: AIService;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private loadConfig(): AIConfig {
    const saved = localStorage.getItem("queryflux-ai-config");
    if (saved) {
      return JSON.parse(saved);
    }

    const defaultConfig: AIConfig = {
      providers: [
        {
          id: "ollama-cloudflare",
          name: "Ollama (Cloudflare)",
          type: "ollama",
          baseUrl: "https://api.queryflux.ai/ollama",
          model: "llama3",
          enabled: true,
        },
        {
          id: "ollama-local",
          name: "Ollama (Local)",
          type: "ollama",
          baseUrl: "http://localhost:11434",
          model: "llama3",
          enabled: false,
        },
        {
          id: "openai-gpt4",
          name: "OpenAI GPT-4",
          type: "openai",
          model: "gpt-4-turbo-preview",
          enabled: false,
        },
        {
          id: "claude-opus",
          name: "Anthropic Claude",
          type: "anthropic",
          model: "claude-3-opus-20240229",
          enabled: false,
        },
      ],
      defaultProvider: "ollama-cloudflare",
      temperature: 0.7,
      maxTokens: 2000,
    };

    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  private saveConfig(config: AIConfig): void {
    localStorage.setItem("queryflux-ai-config", JSON.stringify(config));
  }

  getConfig(): AIConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig(this.config);
  }

  updateProvider(providerId: string, updates: Partial<AIProvider>): void {
    const providerIndex = this.config.providers.findIndex(
      (p) => p.id === providerId,
    );
    if (providerIndex !== -1) {
      this.config.providers[providerIndex] = {
        ...this.config.providers[providerIndex],
        ...updates,
      };
      this.saveConfig(this.config);
    }
  }

  getEnabledProviders(): AIProvider[] {
    return this.config.providers.filter((p) => p.enabled);
  }

  getDefaultProvider(): AIProvider | undefined {
    return this.config.providers.find(
      (p) => p.id === this.config.defaultProvider && p.enabled,
    );
  }

  async generateResponse(
    prompt: string,
    context?: {
      databaseType?: string;
      schema?: string;
      queryHistory?: string[];
    },
  ): Promise<AIResponse> {
    const provider = this.getDefaultProvider();
    if (!provider) {
      throw new Error(
        "No AI provider enabled. Please configure an AI provider in settings.",
      );
    }

    const enhancedPrompt = this.buildEnhancedPrompt(prompt, context);

    switch (provider.type) {
      case "ollama":
        return this.generateOllamaResponse(provider, enhancedPrompt);
      case "openai":
        return this.generateOpenAIResponse(provider, enhancedPrompt);
      case "anthropic":
        return this.generateAnthropicResponse(provider, enhancedPrompt);
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  private buildEnhancedPrompt(
    prompt: string,
    context?: {
      databaseType?: string;
      schema?: string;
      queryHistory?: string[];
    },
  ): string {
    let enhancedPrompt = `You are a helpful database assistant. You help users with SQL queries, database optimization, security analysis, and general database management.\n\n`;

    if (context?.databaseType) {
      enhancedPrompt += `Database Type: ${context.databaseType}\n`;
    }

    if (context?.schema) {
      enhancedPrompt += `Database Schema:\n${context.schema}\n\n`;
    }

    if (context?.queryHistory && context.queryHistory.length > 0) {
      enhancedPrompt += `Recent Queries:\n${context.queryHistory.slice(-3).join("\n")}\n\n`;
    }

    enhancedPrompt += `User Query: ${prompt}\n\nPlease provide a helpful, concise response.`;

    return enhancedPrompt;
  }

  private async generateOllamaResponse(
    provider: AIProvider,
    prompt: string,
  ): Promise<AIResponse> {
    try {
      const response = await fetch(`${provider.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        content: data.response || "No response generated",
        provider: provider.name,
        model: provider.model,
      };
    } catch (error) {
      console.error("Ollama API Error:", error);
      throw new Error(
        `Failed to generate response with Ollama: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async generateOpenAIResponse(
    provider: AIProvider,
    prompt: string,
  ): Promise<AIResponse> {
    if (!provider.apiKey) {
      throw new Error("OpenAI API key is required");
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        content: data.choices[0]?.message?.content || "No response generated",
        provider: provider.name,
        model: provider.model,
        usage: data.usage,
      };
    } catch (error) {
      console.error("OpenAI API Error:", error);
      throw new Error(
        `Failed to generate response with OpenAI: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async generateAnthropicResponse(
    provider: AIProvider,
    prompt: string,
  ): Promise<AIResponse> {
    if (!provider.apiKey) {
      throw new Error("Anthropic API key is required");
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Anthropic API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        content: data.content[0]?.text || "No response generated",
        provider: provider.name,
        model: provider.model,
        usage: data.usage,
      };
    } catch (error) {
      console.error("Anthropic API Error:", error);
      throw new Error(
        `Failed to generate response with Anthropic: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async testConnection(provider: AIProvider): Promise<boolean> {
    try {
      switch (provider.type) {
        case "ollama":
          const response = await fetch(`${provider.baseUrl}/api/tags`);
          return response.ok;

        case "openai":
          if (!provider.apiKey) return false;
          const modelsResponse = await fetch(
            "https://api.openai.com/v1/models",
            {
              headers: { Authorization: `Bearer ${provider.apiKey}` },
            },
          );
          return modelsResponse.ok;

        case "anthropic":
          if (!provider.apiKey) return false;
          // Test with a minimal message
          const testResponse = await fetch(
            "https://api.anthropic.com/v1/messages",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": provider.apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: provider.model,
                max_tokens: 10,
                messages: [{ role: "user", content: "Hi" }],
              }),
            },
          );
          return testResponse.ok;

        default:
          return false;
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }

  async getOllamaModels(
    baseUrl: string = "http://localhost:11434",
  ): Promise<string[]> {
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error("Failed to fetch Ollama models:", error);
      return [];
    }
  }
}
