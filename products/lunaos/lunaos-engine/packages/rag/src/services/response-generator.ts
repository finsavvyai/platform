import {
  ResponseGenerator,
  RetrievalAugmentedResponse,
  Citation,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ConversationMessage,
  DocumentChunk,
} from '../interfaces';
import { EventEmitter } from 'events';

export class ResponseGeneratorService
  extends EventEmitter
  implements ResponseGenerator {
  private llmProvider: LLMProvider;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;
  private citationCache: Map<string, Citation[]>;

  constructor(
    llmProvider: LLMProvider,
    options: {
      defaultModel?: string;
      defaultTemperature?: number;
      defaultMaxTokens?: number;
    } = {}
  ) {
    super();

    this.llmProvider = llmProvider;
    this.defaultModel = options.defaultModel || 'gpt-3.5-turbo';
    this.defaultTemperature = options.defaultTemperature || 0.7;
    this.defaultMaxTokens = options.defaultMaxTokens || 1000;
    this.citationCache = new Map();
  }

  /**
   * Generate response based on query and context
   */
  async generateResponse(request: {
    query: string;
    context: (string | DocumentChunk)[];
    conversationHistory?: ConversationMessage[];
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      includeCitations?: boolean;
      includeFollowUpQuestions?: boolean;
      systemPrompt?: string;
      responseFormat?: 'json' | 'text' | 'markdown';
    };
  }): Promise<RetrievalAugmentedResponse> {
    const startTime = Date.now();
    this.emit('generation:start', { query: request.query });

    try {
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(request.options);

      // Build user prompt with context
      const userPrompt = this.buildUserPrompt(request.query, request.context);

      // Build conversation messages
      const messages: ConversationMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Add conversation history
      if (
        request.conversationHistory &&
        request.conversationHistory.length > 0
      ) {
        messages.splice(1, 0, ...request.conversationHistory.slice(-5)); // Last 5 messages
      }

      // Generate LLM request
      const llmRequest: LLMRequest = {
        model: request.options?.model || this.defaultModel,
        messages,
        temperature: request.options?.temperature ?? this.defaultTemperature,
        maxTokens: request.options?.maxTokens ?? this.defaultMaxTokens,
        stream: false,
        metadata: {
          useCase: 'rag-generation',
          contextLength: request.context.length,
          hasConversationHistory:
            (request.conversationHistory?.length || 0) > 0,
          includeCitations: request.options?.includeCitations || false,
          includeFollowUpQuestions:
            request.options?.includeFollowUpQuestions || false,
        },
      };

      // Call LLM
      const llmResponse = await this.llmProvider.generate(llmRequest);

      // Process response
      const processedResponse = await this.processLLMResponse(
        llmResponse,
        request,
        request.context
      );

      // Generate citations if requested
      let citations: Citation[] = [];
      if (request.options?.includeCitations) {
        citations = await this.generateCitations(
          processedResponse.answer,
          request.context
        );
      }

      // Generate follow-up questions if requested
      let followUpQuestions: string[] = [];
      if (request.options?.includeFollowUpQuestions) {
        followUpQuestions = await this.generateFollowUpQuestions(
          request.query,
          processedResponse.answer
        );
      }

      // Find related documents
      const relatedDocuments = await this.findRelatedDocuments(
        processedResponse.answer,
        request.context
      );

      const response: RetrievalAugmentedResponse = {
        answer: processedResponse.answer,
        confidence: processedResponse.confidence,
        citations,
        followUpQuestions,
        relatedDocuments,
        metadata: {
          model: llmRequest.model,
          temperature: llmRequest.temperature,
          maxTokens: llmRequest.maxTokens,
          totalTokens: llmResponse.usage?.totalTokens || 0,
          processingTime: Date.now() - startTime,
          reasoning: processedResponse.reasoning,
          sourcesUsed: request.context.length,
          timestamp: new Date().toISOString(),
        },
      };

      this.emit('generation:complete', {
        query: request.query,
        response,
        processingTime: response.metadata.processingTime,
      });

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown generation error';

      this.emit('generation:error', {
        query: request.query,
        error: errorMessage,
      });

      return {
        answer: `I apologize, but I encountered an error while generating a response: ${errorMessage}`,
        confidence: 0,
        citations: [],
        followUpQuestions: [],
        relatedDocuments: [],
        metadata: {
          model: request.options?.model || this.defaultModel,
          temperature: request.options?.temperature ?? this.defaultTemperature,
          maxTokens: request.options?.maxTokens ?? this.defaultMaxTokens,
          totalTokens: 0,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: errorMessage,
        },
      };
    }
  }

  /**
   * Generate response with streaming
   */
  async *generateStreamingResponse(request: {
    query: string;
    context: (string | DocumentChunk)[];
    conversationHistory?: ConversationMessage[];
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      includeCitations?: boolean;
      systemPrompt?: string;
    };
  }): AsyncGenerator<{
    content: string;
    done: boolean;
    citations?: Citation[];
    confidence?: number;
  }> {
    const startTime = Date.now();
    this.emit('generation:start', { query: request.query, streaming: true });

    try {
      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(request.options);

      // Build user prompt with context
      const userPrompt = this.buildUserPrompt(request.query, request.context);

      // Build conversation messages
      const messages: ConversationMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Add conversation history
      if (
        request.conversationHistory &&
        request.conversationHistory.length > 0
      ) {
        messages.splice(1, 0, ...request.conversationHistory.slice(-5));
      }

      // Generate streaming LLM request
      const llmRequest: LLMRequest = {
        model: request.options?.model || this.defaultModel,
        messages,
        temperature: request.options?.temperature ?? this.defaultTemperature,
        maxTokens: request.options?.maxTokens ?? this.defaultMaxTokens,
        stream: true,
        metadata: {
          useCase: 'rag-generation-streaming',
          contextLength: request.context.length,
          hasConversationHistory:
            (request.conversationHistory?.length || 0) > 0,
        },
      };

      // Stream LLM response
      const stream = this.llmProvider.generateStream(llmRequest);
      let accumulatedContent = '';

      for await (const chunk of stream) {
        accumulatedContent += chunk.content;

        yield {
          content: accumulatedContent,
          done: chunk.done,
          confidence: this.calculateStreamingConfidence(
            accumulatedContent,
            request.context
          ),
        };
      }

      // Generate citations after completion if requested
      let citations: Citation[] = [];
      if (request.options?.includeCitations) {
        citations = await this.generateCitations(
          accumulatedContent,
          request.context
        );
        yield { content: accumulatedContent, done: true, citations };
      }

      this.emit('generation:complete', {
        query: request.query,
        streaming: true,
        processingTime: Date.now() - startTime,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown streaming error';

      this.emit('generation:error', {
        query: request.query,
        error: errorMessage,
        streaming: true,
      });

      yield {
        content: `Error: ${errorMessage}`,
        done: true,
        confidence: 0,
      };
    }
  }

  /**
   * Build system prompt for RAG generation
   */
  private buildSystemPrompt(options?: {
    includeCitations?: boolean;
    includeFollowUpQuestions?: boolean;
    systemPrompt?: string;
    responseFormat?: 'json' | 'text' | 'markdown';
  }): string {
    const basePrompt = `You are a helpful AI assistant that answers questions based on the provided context.

Your task is to:
1. Carefully read and understand the provided context
2. Answer the user's question using only information from the context
3. If the context doesn't contain enough information, say so clearly
4. Provide accurate, relevant, and well-structured responses
5. Be honest about limitations and uncertainties`;

    let prompt = basePrompt;

    if (options?.includeCitations) {
      prompt += `\n\nIMPORTANT: Always cite your sources using the format [Source X] where X is the context index number.`;
    }

    if (options?.includeFollowUpQuestions) {
      prompt += `\n\nAfter your answer, suggest 2-3 relevant follow-up questions that the user might find helpful.`;
    }

    if (options?.responseFormat === 'markdown') {
      prompt += `\n\nFormat your response using Markdown for better readability (headers, lists, bold text, etc.).`;
    } else if (options?.responseFormat === 'json') {
      prompt += `\n\nFormat your response as a JSON object with the following structure:
{
  "answer": "your detailed answer",
  "confidence": 0.85,
  "sourcesUsed": [0, 1, 2],
  "reasoning": "brief explanation of your reasoning process"
}`;
    }

    if (options?.systemPrompt) {
      prompt += `\n\n${options.systemPrompt}`;
    }

    return prompt;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(
    query: string,
    context: (string | DocumentChunk)[]
  ): string {
    if (context.length === 0) {
      return `Question: ${query}`;
    }

    let prompt = `Context:\n`;

    context.forEach((ctx, index) => {
      const content = typeof ctx === 'string' ? ctx : ctx.content;
      prompt += `\n[Source ${index}]:\n${content}\n`;
    });

    prompt += `\nQuestion: ${query}\n\nPlease provide a comprehensive answer based on the context above.`;

    return prompt;
  }

  /**
   * Process LLM response
   */
  private async processLLMResponse(
    llmResponse: LLMResponse,
    request: any,
    context: (string | DocumentChunk)[]
  ): Promise<{
    answer: string;
    confidence: number;
    reasoning?: string;
  }> {
    let content = llmResponse.content;
    let confidence = 0.7; // Default confidence
    let reasoning: string | undefined;

    // Handle JSON response format
    if (request.options?.responseFormat === 'json') {
      try {
        const jsonResponse = JSON.parse(content);
        return {
          answer: jsonResponse.answer || content,
          confidence: jsonResponse.confidence || 0.7,
          reasoning: jsonResponse.reasoning,
        };
      } catch (error) {
        // If JSON parsing fails, use raw content
        console.warn('Failed to parse JSON response, using raw content');
      }
    }

    // Extract confidence from response if present
    const confidenceMatch = content.match(/confidence[:\s]*(\d+\.?\d*)/i);
    if (confidenceMatch) {
      confidence = Math.min(
        1,
        Math.max(0, parseFloat(confidenceMatch[1]) / 100)
      );
    }

    // Extract reasoning if present
    const reasoningMatch = content.match(/reasoning[:\s]*([^\n]+)/i);
    if (reasoningMatch && reasoningMatch[1]) {
      reasoning = reasoningMatch[1].trim();
    }

    // Clean up response
    content = this.cleanupResponse(content, request.options);

    // Calculate confidence based on context usage
    const contextConfidence = this.calculateContextConfidence(content, context);
    confidence = (confidence + contextConfidence) / 2;

    return {
      answer: content,
      confidence,
      reasoning,
    };
  }

  /**
   * Clean up response content
   */
  private cleanupResponse(content: string, options?: any): string {
    // Remove any system-like instructions that might have been included
    let cleaned = content.replace(
      /I am (?:an? )?AI assistant.*?question:\s*/i,
      ''
    );

    // Remove redundant headers
    cleaned = cleaned.replace(/^Answer:\s*/i, '');

    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    // Remove confidence and reasoning statements from main content (they're extracted separately)
    cleaned = cleaned.replace(/Confidence[:\s]*\d+\.?\d*%?/gi, '');
    cleaned = cleaned.replace(/Reasoning[:\s]*[^\n]+/gi, '');

    return cleaned.trim();
  }

  /**
   * Generate citations for response
   */
  private async generateCitations(
    response: string,
    context: (string | DocumentChunk)[]
  ): Promise<Citation[]> {
    const citations: Citation[] = [];

    // Look for citation patterns in response
    const citationPattern = /\[Source (\d+)\]/g;
    const matches = [...response.matchAll(citationPattern)];

    const seenIndices = new Set<number>();

    for (const match of matches) {
      const sourceIndex = parseInt(match[1]);

      if (sourceIndex < context.length && !seenIndices.has(sourceIndex)) {
        const ctxItem = context[sourceIndex];
        if (!ctxItem) continue;
        
        const snippet = this.extractRelevantSnippet(response, ctxItem);
        const confidence = this.calculateCitationConfidence(response, ctxItem);

        const source =
          typeof ctxItem === 'string'
            ? 'Unknown Source'
            : (ctxItem as any).source || 'Unknown Source';

        const title =
          typeof ctxItem === 'string'
            ? 'Untitled'
            : ctxItem.metadata?.documentTitle ||
            ctxItem.metadata?.title ||
            'Untitled';

        citations.push({
          documentIndex: sourceIndex,
          snippet,
          confidence,
          relevance: confidence,
          source,
          title,
          startPosition: match.index!,
          endPosition: match.index! + match[0].length,
        });

        seenIndices.add(sourceIndex);
      }
    }

    // If no explicit citations found, try to infer them
    if (citations.length === 0) {
      const inferredCitations = await this.inferCitations(response, context);
      citations.push(...inferredCitations);
    }

    return citations;
  }

  /**
   * Extract relevant snippet from context
   */
  private extractRelevantSnippet(
    response: string,
    context: string | DocumentChunk
  ): string {
    const contextContent =
      typeof context === 'string' ? context : context.content;
    const responseWords = response.toLowerCase().split(/\s+/);
    const contextSentences = contextContent.split(/[.!?]+/);

    let bestSentence = '';
    let highestScore = 0;

    for (const sentence of contextSentences) {
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      const commonWords = responseWords.filter(
        word => word.length > 3 && sentenceWords.includes(word)
      );

      const score = commonWords.length / Math.max(responseWords.length, 1);

      if (score > highestScore && sentence.trim().length > 20) {
        highestScore = score;
        bestSentence = sentence.trim();
      }
    }

    return (
      bestSentence ||
      contextContent.substring(0, 200) +
      (contextContent.length > 200 ? '...' : '')
    );
  }

  /**
   * Calculate citation confidence
   */
  private calculateCitationConfidence(
    response: string,
    context: string | DocumentChunk
  ): number {
    const contextContent =
      typeof context === 'string' ? context : context.content;
    const responseWords = new Set(response.toLowerCase().split(/\s+/));
    const contextWords = contextContent.toLowerCase().split(/\s+/);

    const commonWords = contextWords.filter(
      word => responseWords.has(word) && word.length > 3
    );

    return Math.min(
      1,
      commonWords.length / Math.max(contextWords.length / 10, 1)
    );
  }

  /**
   * Infer citations from response
   */
  private async inferCitations(
    response: string,
    context: (string | DocumentChunk)[]
  ): Promise<Citation[]> {
    const citations: Citation[] = [];

    for (let i = 0; i < context.length; i++) {
      const ctxItem = context[i];
      if (!ctxItem) continue;
      
      const confidence = this.calculateCitationConfidence(response, ctxItem);

      if (confidence > 0.3) {
        const source =
          typeof ctxItem === 'string'
            ? 'Unknown Source'
            : (ctxItem as any).source || 'Unknown Source';

        const title =
          typeof ctxItem === 'string'
            ? 'Untitled'
            : ctxItem.metadata?.documentTitle ||
            ctxItem.metadata?.title ||
            'Untitled';

        citations.push({
          documentIndex: i,
          snippet: this.extractRelevantSnippet(response, ctxItem),
          confidence,
          relevance: confidence,
          source,
          title,
          startPosition: -1,
          endPosition: -1,
        });
      }
    }

    return citations.slice(0, 3); // Limit to top 3 inferred citations
  }

  /**
   * Generate follow-up questions
   */
  private async generateFollowUpQuestions(
    query: string,
    response: string
  ): Promise<string[]> {
    const followUpPrompt = `Based on the following question and answer, suggest 2-3 relevant follow-up questions:

Original Question: ${query}

Answer: ${response}

Please suggest follow-up questions that:
1. Explore the topic in more depth
2. Address related aspects not covered in the original answer
3. Help the user understand the subject better

Format your response as a numbered list of questions only.`;

    try {
      const llmRequest: LLMRequest = {
        model: this.defaultModel,
        messages: [{ role: 'user', content: followUpPrompt }],
        temperature: 0.8,
        maxTokens: 300,
        stream: false,
      };

      const llmResponse = await this.llmProvider.generate(llmRequest);
      const content = llmResponse.content;

      // Extract questions from response
      const questions = content
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()) || line.trim().endsWith('?'))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(q => q.length > 10 && q.endsWith('?'));

      return questions.slice(0, 3);
    } catch (error) {
      console.warn('Failed to generate follow-up questions:', error);
      return [];
    }
  }

  /**
   * Find related documents
   */
  private async findRelatedDocuments(
    response: string,
    context: (string | DocumentChunk)[]
  ): Promise<any[]> {
    // This would typically use semantic search to find related documents
    // For now, return empty array
    return [];
  }

  /**
   * Calculate confidence based on context usage
   */
  private calculateContextConfidence(
    response: string,
    context: (string | DocumentChunk)[]
  ): number {
    if (context.length === 0) return 0.1;

    const responseWords = new Set(response.toLowerCase().split(/\s+/));
    let totalMatches = 0;
    let totalWords = 0;

    for (const ctx of context) {
      const content = typeof ctx === 'string' ? ctx : ctx.content || '';
      const contextWords = content.toLowerCase().split(/\s+/);
      const matches = contextWords.filter(
        (word: string) => responseWords.has(word) && word.length > 3
      );

      totalMatches += matches.length;
      totalWords += contextWords.length;
    }

    return Math.min(1, totalMatches / Math.max(totalWords / 5, 1));
  }

  /**
   * Calculate confidence for streaming response
   */
  private calculateStreamingConfidence(
    content: string,
    context: (string | DocumentChunk)[]
  ): number {
    return this.calculateContextConfidence(content, context);
  }

  /**
   * Update default settings
   */
  updateSettings(settings: {
    defaultModel?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
  }): void {
    if (settings.defaultModel) this.defaultModel = settings.defaultModel;
    if (settings.defaultTemperature !== undefined) {
      this.defaultTemperature = settings.defaultTemperature;
    }
    if (settings.defaultMaxTokens)
      this.defaultMaxTokens = settings.defaultMaxTokens;

    this.emit('settings:updated', settings);
  }

  /**
   * Get current settings
   */
  getSettings(): {
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
  } {
    return {
      defaultModel: this.defaultModel,
      defaultTemperature: this.defaultTemperature,
      defaultMaxTokens: this.defaultMaxTokens,
    };
  }
}
