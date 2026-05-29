// RAG Chat Component for React

import React, { useState, useRef, useEffect } from 'react';
import { useRAG } from '../hooks/useRAG';
import { useWebSocket } from '../hooks/useWebSocket';

interface RAGChatProps {
  placeholder?: string;
  className?: string;
  onResponse?: (response: any) => void;
  contextOptions?: {
    maxDocuments?: number;
    maxChunks?: number;
    includeCitations?: boolean;
  };
}

export function RAGChat({
  placeholder = 'Ask a question about your documents...',
  className = '',
  onResponse,
  contextOptions
}: RAGChatProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{
    id: string;
    type: 'user' | 'assistant';
    content: string;
    sources?: any[];
    timestamp: Date;
  }>>([]);

  const { query: ragQuery, streamQuery, isLoading, cancelQuery } = useRAG();
  const { isConnected } = useWebSocket(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);

    // Create streaming response message
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      type: 'assistant',
      content: '',
      sources: [],
      timestamp: new Date()
    }]);

    const originalQuery = query;
    setQuery('');

    // Abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      let fullResponse = '';
      const updates = streamQuery({
        query: originalQuery,
        context: contextOptions,
        streaming: true
      });

      for await (const update of updates) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        if (update.status === 'processing' && update.progress) {
          // Show progress
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: `Processing... ${Math.round(update.progress! * 100)}%` }
              : msg
          ));
        } else if (update.result) {
          // Update with partial response
          fullResponse = update.result.answer;
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: fullResponse,
                  sources: update.result.sources
                }
              : msg
          ));
        } else if (update.status === 'completed') {
          // Final response
          onResponse?.(update.result);
        } else if (update.status === 'failed') {
          // Error occurred
          setMessages(prev => prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: `Error: ${update.error}` }
              : msg
          ));
        }
      }
    } catch (error) {
      if (error.message !== 'Query cancelled') {
        setMessages(prev => prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, content: `Error: ${error.message}` }
            : msg
        ));
      }
    }
  };

  const handleStop = () => {
    cancelQuery();
    abortControllerRef.current?.abort();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Connection Status */}
      <div className="flex items-center justify-between p-2 border-b">
        <span className="text-sm text-gray-600">
          {isConnected ? (
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Connected
            </span>
          ) : (
            <span className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
              Disconnected
            </span>
          )}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Ask a question about your documents to get started.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 text-xs opacity-75">
                    <p className="font-semibold mb-1">Sources:</p>
                    <ul className="list-disc list-inside">
                      {message.sources.slice(0, 3).map((source, idx) => (
                        <li key={idx}>{source.documentName}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex space-x-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            rows={1}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!query.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
