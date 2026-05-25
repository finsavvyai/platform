import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AISlice, AIConversation, AISuggestion } from './types';

export const useAIStore = create<AISlice>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      suggestions: [],

      // Actions
      addConversation: (conversation: AIConversation) =>
        set((state) => ({
          conversations: [...state.conversations, conversation]
        })),

      updateConversation: (id: string, updates: Partial<AIConversation>) =>
        set((state) => ({
          conversations: state.conversations.map(conv =>
            conv.id === id ? { ...conv, ...updates, updatedAt: Date.now() } : conv
          )
        })),

      removeConversation: (id: string) =>
        set((state) => ({
          conversations: state.conversations.filter(conv => conv.id !== id)
        })),

      addSuggestion: (suggestion: AISuggestion) =>
        set((state) => ({
          suggestions: [...state.suggestions, suggestion]
        })),

      acceptSuggestion: (id: string) =>
        set((state) => ({
          suggestions: state.suggestions.map(s =>
            s.id === id ? { ...s, accepted: true } : s
          )
        })),

      dismissSuggestion: (id: string) =>
        set((state) => ({
          suggestions: state.suggestions.filter(s => s.id !== id)
        })),
    }),
    {
      name: 'queryflux-ai-store',
      partialize: (state) => ({
        conversations: state.conversations.slice(0, 50), // Keep last 50 conversations
        suggestions: state.suggestions.filter(s => !s.accepted && Date.now() - s.createdAt < 86400000), // Keep unaccepted suggestions for 24 hours
      }),
    }
  )
);