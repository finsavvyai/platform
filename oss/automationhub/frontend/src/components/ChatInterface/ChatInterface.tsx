import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip,
  Badge,
  Divider,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Send,
  Mic,
  MicOff,
  SmartToy,
  Person,
  Settings,
  History,
  Lightbulb,
  Code,
  WorkOutline,
  Search,
  Add,
  Delete,
  Edit,
  MoreVert,
  Stop,
  PlayArrow,
} from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import { format } from 'date-fns';

// Types
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  metadata?: {
    intent?: string;
    entities?: any[];
    confidence?: number;
    suggestions?: string[];
    relatedWorkflows?: string[];
    relatedDocuments?: string[];
  };
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  messageCount: number;
}

interface Suggestion {
  id: string;
  text: string;
  type: 'workflow' | 'document' | 'action' | 'query';
  metadata?: any;
}

interface ChatInterfaceProps {
  apiUrl?: string;
  userId?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  apiUrl = 'http://localhost:8000',
  userId = 'default-user',
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const [maxTokens, setMaxTokens] = useState(2000);
  const [temperature, setTemperature] = useState(0.7);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(apiUrl, {
      path: '/ws',
      transports: ['websocket'],
      query: { userId },
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
      console.log('Connected to chat WebSocket');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from chat WebSocket');
    });

    newSocket.on('message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
      setIsTyping(false);
      scrollToBottom();
    });

    newSocket.on('typing_start', () => {
      setIsTyping(true);
    });

    newSocket.on('typing_stop', () => {
      setIsTyping(false);
    });

    newSocket.on('suggestions', (suggestions: Suggestion[]) => {
      setSuggestions(suggestions);
    });

    newSocket.on('error', (errorMsg: string) => {
      setError(errorMsg);
      setIsTyping(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [apiUrl, userId]);

  // Check speech support
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setSpeechSupported(true);
    }
  }, []);

  // Fetch conversations
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/chat/conversations`);
        if (response.ok) {
          const data = await response.json();
          setConversations(data.conversations || []);
        }
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
      }
    };

    fetchConversations();
  }, [apiUrl]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !socket) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      content: content.trim(),
      role: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      socket.emit('message', {
        content: content.trim(),
        conversationId: currentConversationId,
        model: selectedModel,
        maxTokens,
        temperature,
      });

      // Update or create conversation
      if (currentConversationId) {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === currentConversationId
              ? {
                  ...conv,
                  lastMessage: content.trim(),
                  updatedAt: new Date().toISOString(),
                  messageCount: conv.messageCount + 1,
                }
              : conv
          )
        );
      } else {
        const newConversation: Conversation = {
          id: `conv-${Date.now()}`,
          title: content.trim().substring(0, 50) + (content.length > 50 ? '...' : ''),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessage: content.trim(),
          messageCount: 1,
        };
        setConversations((prev) => [newConversation, ...prev]);
        setCurrentConversationId(newConversation.id);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
      setIsTyping(false);
    }
  }, [socket, currentConversationId, selectedModel, maxTokens, temperature]);

  // Handle voice recording
  const toggleRecording = useCallback(() => {
    if (!speechSupported) return;

    if (isRecording) {
      // Stop recording
      setIsRecording(false);
    } else {
      // Start recording
      setIsRecording(true);
      // Implement speech recognition here
      // This is a placeholder for actual speech recognition implementation
    }
  }, [isRecording, speechSupported]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    sendMessage(suggestion.text);
  }, [sendMessage]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
    setInputValue('');
    setSuggestions([]);
    inputRef.current?.focus();
  }, []);

  // Load conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/v1/chat/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setCurrentConversationId(conversationId);
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const response = await fetch(`${apiUrl}/api/v1/chat/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
        if (currentConversationId === conversationId) {
          startNewConversation();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation');
    }
  }, [currentConversationId, startNewConversation, apiUrl]);

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'assistant':
        return <SmartToy />;
      case 'user':
        return <Person />;
      default:
        return <Person />;
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'workflow':
        return <WorkOutline />;
      case 'document':
        return <Search />;
      case 'action':
        return <PlayArrow />;
      default:
        return <Lightbulb />;
    }
  };

  const quickSuggestions = [
    { id: '1', text: 'Create a new workflow', type: 'workflow' as const },
    { id: '2', text: 'Search for documents', type: 'document' as const },
    { id: '3', text: 'Show system status', type: 'query' as const },
    { id: '4', text: 'Help me automate a task', type: 'action' as const },
  ];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">AI Assistant</Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="New Conversation">
              <IconButton onClick={startNewConversation}>
                <Add />
              </IconButton>
            </Tooltip>
            <Tooltip title="History">
              <IconButton onClick={() => setHistoryDialog(true)}>
                <History />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={() => setSettingsDialog(true)}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {currentConversationId && (
          <Box mt={1}>
            <Typography variant="caption" color="textSecondary">
              Current: {conversations.find((c) => c.id === currentConversationId)?.title}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Connection Status */}
      {!connected && (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          Disconnected from chat server
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      )}

      {/* Messages Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {messages.length === 0 && !loading && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="100%"
            textAlign="center"
          >
            <SmartToy sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Welcome to UPM.Plus AI Assistant
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              I can help you with workflows, documents, and automation tasks
            </Typography>

            {/* Quick Suggestions */}
            <Box display="flex" flexWrap="wrap" gap={1} justifyContent="center">
              {quickSuggestions.map((suggestion) => (
                <Chip
                  key={suggestion.id}
                  icon={getSuggestionIcon(suggestion.type)}
                  label={suggestion.text}
                  variant="outlined"
                  clickable
                  onClick={() => handleSuggestionClick(suggestion)}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map((message) => (
          <ListItem key={message.id} sx={{ alignItems: 'flex-start', px: 0 }}>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: message.role === 'assistant' ? 'primary.main' : 'grey.500' }}>
                {getMessageIcon(message.role)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">
                    {message.role === 'assistant' ? 'AI Assistant' : 'You'}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {format(new Date(message.timestamp), 'HH:mm')}
                  </Typography>
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>

                  {/* Message metadata */}
                  {message.metadata && (
                    <Box mt={1}>
                      {message.metadata.suggestions && (
                        <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                          {message.metadata.suggestions.map((suggestion: string, index: number) => (
                            <Chip
                              key={index}
                              label={suggestion}
                              size="small"
                              variant="outlined"
                              clickable
                              onClick={() => sendMessage(suggestion)}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}

        {isTyping && (
          <ListItem sx={{ px: 0 }}>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <SmartToy />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="textSecondary">
                    AI is thinking...
                  </Typography>
                </Box>
              }
            />
          </ListItem>
        )}

        {/* AI Suggestions */}
        {suggestions.length > 0 && messages.length > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Suggested actions:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion.id}
                  icon={getSuggestionIcon(suggestion.type)}
                  label={suggestion.text}
                  variant="outlined"
                  clickable
                  onClick={() => handleSuggestionClick(suggestion)}
                />
              ))}
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box display="flex" gap={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder="Ask me anything about workflows, documents, or automation..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputValue);
              }
            }}
            inputRef={inputRef}
            disabled={!connected}
          />
          <IconButton
            color={isRecording ? 'error' : 'default'}
            onClick={toggleRecording}
            disabled={!speechSupported}
          >
            {isRecording ? <MicOff /> : <Mic />}
          </IconButton>
          <IconButton
            color="primary"
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || !connected}
          >
            <Send />
          </IconButton>
        </Box>
      </Paper>

      {/* History Dialog */}
      <Dialog open={historyDialog} onClose={() => setHistoryDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Conversation History</DialogTitle>
        <DialogContent>
          <List>
            {conversations.map((conversation) => (
              <ListItem
                key={conversation.id}
                button
                onClick={() => {
                  loadConversation(conversation.id);
                  setHistoryDialog(false);
                }}
              >
                <ListItemText
                  primary={conversation.title}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {format(new Date(conversation.updatedAt), 'MMM dd, yyyy HH:mm')}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {conversation.messageCount} messages
                      </Typography>
                    </Box>
                  }
                />
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                  color="error"
                >
                  <Delete />
                </IconButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialog} onClose={() => setSettingsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Chat Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <Typography variant="subtitle2" gutterBottom>
                AI Model
              </Typography>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="claude-3">Claude 3</option>
              </select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Max Tokens: {maxTokens}
              </Typography>
              <input
                type="range"
                min="100"
                max="4000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Temperature: {temperature}
              </Typography>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatInterface;