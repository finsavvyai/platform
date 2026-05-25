# NotebookLM-Inspired Features for LM Studio Extension

**Transform LM Studio into a NotebookLM-like experience**

---

## 📋 NotebookLM Feature Analysis

### Core NotebookLM Features

1. **🎤 Voice Interaction**
   - Voice-to-text input
   - Text-to-speech output
   - Conversational AI interface
   - Natural language queries

2. **📚 Source Management**
   - Upload multiple documents (PDFs, text, websites)
   - Source citation in responses
   - Cross-document querying
   - Document summarization

3. **🧠 Enhanced Context**
   - Long context windows (1M+ tokens)
   - Document understanding
   - Cross-reference analysis
   - Quote extraction with sources

4. **🗣️ Interactive Chat**
   - Multi-turn conversations
   - Context-aware responses
   - Follow-up questions
   - Clarification requests

5. **📝 Notebook Organization**
   - Multiple notebooks per project
   - Section organization
   - Tagging and search
   - Export capabilities

6. **🔄 Source Sync**
   - Google Docs integration
   - Google Drive sync
   - Real-time collaboration
   - Version history

7. **🎯 Custom Instructions**
   - System prompts
   - Response style configuration
   - Domain expertise settings
   - Persona customization

---

## 🎯 LM Studio Extension + NotebookLM Features

### Phase 1: Voice Interaction (Priority: HIGH)

**Features:**
- Voice input for chat messages
- Text-to-speech for responses
- Voice command shortcuts
- Audio recording and playback

**Implementation:**

```typescript
// src/extensions/voice/VoiceInterface.tsx

export const VoiceInterface: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');

  const startListening = async () => {
    setIsListening(true);

    // Use Web Speech API
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript + interimTranscript);
    };

    recognition.start();
  };

  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="voice-interface">
      <button
        onClick={startListening}
        className={`mic-button ${isListening ? 'listening' : ''}`}
      >
        🎤
      </button>

      {isListening && (
        <div className="listening-indicator">
          Listening...
        </div>
      )}

      {transcript && (
        <div className="transcript">
          {transcript}
        </div>
      )}

      <button onClick={() => speakResponse(response)}>
        🔊 Speak Response
      </button>
    </div>
  );
};
```

**UI Integration:**
```typescript
// Add to LM Studio chat interface
<div className="chat-input-container">
  <VoiceInterface />
  <textarea
    placeholder="Ask anything about your documents..."
    value={input}
    onChange={(e) => setInput(e.target.value)}
  />
  <button onClick={sendMessage}>Send</button>
</div>
```

---

### Phase 2: Source Management (Priority: HIGH)

**Features:**
- Upload documents (PDF, TXT, MD, code)
- Source tracking with citations
- Cross-document querying
- Document summaries

**Implementation:**

```typescript
// src/extensions/sources/SourceManager.tsx

interface Source {
  id: string;
  name: string;
  type: 'pdf' | 'text' | 'markdown' | 'code';
  content: string;
  chunks: string[];
  metadata: {
    size: number;
    created: string;
    tags: string[];
  };
}

export const SourceManager: React.FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadSource = async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sources/upload', {
        method: 'POST',
        body: formData,
      });

      const source = await response.json();
      setSources([...sources, source]);

      // Extract chunks for RAG
      await chunkSource(source);

    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const chunkSource = async (source: Source) => {
    // Split document into chunks
    const chunks = await fetch('/api/sources/chunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: source.id,
        chunk_size: 1000,
        overlap: 200,
      }),
    }).then(r => r.json());

    setSources(sources.map(s =>
      s.id === source.id ? { ...s, chunks } : s
    ));
  };

  return (
    <div className="source-manager">
      <div className="source-header">
        <h2>Sources</h2>
        <button onClick={() => document.getElementById('file-upload')?.click()}>
          + Upload
        </button>
        <input
          id="file-upload"
          type="file"
          hidden
          onChange={(e) => e.target.files?.[0] && uploadSource(e.target.files[0])}
          accept=".pdf,.txt,.md,.py,.js,.ts"
        />
      </div>

      <div className="source-list">
        {sources.map(source => (
          <div
            key={source.id}
            className={`source-item ${selectedSource?.id === source.id ? 'selected' : ''}`}
            onClick={() => setSelectedSource(source)}
          >
            <div className="source-icon">
              {source.type === 'pdf' && '📄'}
              {source.type === 'text' && '📝'}
              {source.type === 'code' && '💻'}
            </div>
            <div className="source-info">
              <div className="source-name">{source.name}</div>
              <div className="source-meta">
                {source.metadata.size} bytes • {source.chunks.length} chunks
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedSource && (
        <div className="source-details">
          <h3>{selectedSource.name}</h3>
          <p>{selectedSource.metadata.tags.join(', ')}</p>
          <button onClick={() => summarizeSource(selectedSource)}>
            Summarize
          </button>
        </div>
      )}
    </div>
  );
};
```

**RAG API Implementation:**

```python
# src/api/routes/sources.py

from aiohttp import web
import fitz  # PyMuPDF
from sklearn.feature_extraction.text import Chunker

async def handle_upload_source(request: web.Request):
    """Upload and process a document source."""
    reader = await request.multipart()
    field = await reader.next()

    if field.name == 'file':
        content = await field.read()
        filename = field.filename

        # Extract text from PDF
        if filename.endswith('.pdf'):
            doc = fitz.open(stream=content, filetype='pdf')
            text = ''
            for page in doc:
                text += page.get_text()

        # Chunk the document
        chunks = []
        chunker = Chunker(chunk_size=1000, overlap=200)
        for chunk in chunker.split_text(text):
            chunks.append(chunk)

        # Store source
        source_id = f"source_{hash(filename)}"
        sources[source_id] = {
            'id': source_id,
            'name': filename,
            'content': text,
            'chunks': chunks,
            'metadata': {
                'size': len(content),
                'created': datetime.now().isoformat(),
                'tags': [],
            }
        }

        return web.json_response({'source_id': source_id})

async def handle_query_sources(request: web.Request):
    """Query across all uploaded sources with RAG."""
    data = await request.json()
    query = data.get('query')
    source_ids = data.get('source_ids', [])

    # Retrieve relevant chunks
    relevant_chunks = []
    for source_id in source_ids:
        if source_id in sources:
            for chunk in sources[source_id]['chunks']:
                if any(word in chunk.lower() for word in query.lower().split()):
                    relevant_chunks.append({
                        'source_id': source_id,
                        'chunk': chunk,
                    })

    # Build context from chunks
    context = '\n\n'.join([c['chunk'] for c in relevant_chunks[:10]])

    # Query LLM with context
    response = await provider.chat(
        messages=[
            {'role': 'system', 'content': f'Context:\n{context}'},
            {'role': 'user', 'content': query}
        ]
    )

    # Add citations
    citations = [
        {'source_id': c['source_id']}
        for c in relevant_chunks[:5]
    ]

    return web.json_response({
        'response': response.content,
        'citations': citations,
        'sources_used': len(set(c['source_id'] for c in citations))
    })
```

---

### Phase 3: Enhanced Chat Interface (Priority: MEDIUM)

**Features:**
- Notebook-style chat organization
- Section-based conversations
- Quick actions (summarize, cite sources)
- Follow-up suggestions

**Implementation:**

```typescript
// src/extensions/notebook/NotebookChat.tsx

interface Notebook {
  id: string;
  name: string;
  sections: Section[];
  created: string;
}

interface Section {
  id: string;
  title: string;
  messages: Message[];
  sources: string[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  timestamp: string;
}

export const NotebookChat: React.FC = () => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentNotebook, setCurrentNotebook] = useState<Notebook | null>(null);
  const [currentSection, setCurrentSection] = useState<Section | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const createNotebook = () => {
    const notebook: Notebook = {
      id: `nb_${Date.now()}`,
      name: 'New Notebook',
      sections: [{
        id: `section_${Date.now()}`,
        title: 'Section 1',
        messages: [],
        sources: [],
      }],
      created: new Date().toISOString(),
    };

    setNotebooks([...notebooks, notebook]);
    setCurrentNotebook(notebook);
    setCurrentSection(notebook.sections[0]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage]);

    // Query with RAG if sources are attached
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          ...messages,
          userMessage
        ],
        sources: currentSection?.sources || [],
        notebook_id: currentNotebook?.id,
        section_id: currentSection?.id,
      }),
    }).then(r => r.json());

    const assistantMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: response.content,
      citations: response.citations,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage, assistantMessage]);
    setInput('');

    // Generate follow-up suggestions
    generateSuggestions(assistantMessage.content);
  };

  const generateSuggestions = async (content: string) => {
    const response = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(r => r.json());

    setSuggestions(response.suggestions);
  };

  const quickActions = [
    {
      label: 'Summarize',
      action: () => sendMessage('Summarize this conversation'),
      icon: '📝',
    },
    {
      label: 'Cite Sources',
      action: () => sendMessage('What sources support this answer?'),
      icon: '📚',
    },
    {
      label: 'Clarify',
      action: () => sendMessage('Can you explain that in simpler terms?'),
      icon: '❓',
    },
  ];

  return (
    <div className="notebook-chat">
      {/* Notebook Selector */}
      <div className="notebook-selector">
        <select
          value={currentNotebook?.id || ''}
          onChange={(e) => setCurrentNotebook(notebooks.find(n => n.id === e.target.value))}
        >
          <option value="">Select Notebook</option>
          {notebooks.map(nb => (
            <option key={nb.id} value={nb.id}>{nb.name}</option>
          ))}
        </select>
        <button onClick={createNotebook}>+ New Notebook</button>
      </div>

      {/* Section Tabs */}
      {currentNotebook && (
        <div className="section-tabs">
          {currentNotebook.sections.map(section => (
            <button
              key={section.id}
              className={currentSection?.id === section.id ? 'active' : ''}
              onClick={() => setCurrentSection(section)}
            >
              {section.title}
            </button>
          ))}
          <button onClick={() => {
            const newSection = {
              id: `section_${Date.now()}`,
              title: 'New Section',
              messages: [],
              sources: [],
            };
            setCurrentNotebook({
              ...currentNotebook,
              sections: [...currentNotebook.sections, newSection]
            });
            setCurrentSection(newSection);
          }}>
            + Section
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div className="messages-container">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">{message.content}</div>
            {message.citations && (
              <div className="citations">
                <strong>Sources:</strong>
                {message.citations.map((citation, i) => (
                  <span key={i} className="citation">
                    [{citation.source_id}]
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Suggestions */}
        {suggestions && (
          <div className="suggestions">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setInput(suggestion)}
                className="suggestion-chip"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="input-area">
        {currentSection?.sources.length > 0 && (
          <div className="attached-sources">
            <span>📚 {currentSection.sources.length} sources attached</span>
          </div>
        )}

        {quickActions.map(action => (
          <button
            key={action.label}
            onClick={action.action}
            className="quick-action"
            title={action.label}
          >
            {action.icon} {action.label}
          </button>
        ))}

        <VoiceInterface />

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />

        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};
```

---

### Phase 4: Custom Instructions (Priority: LOW)

**Features:**
- System prompts
- Response style configuration
- Domain expertise settings
- Persona customization

**Implementation:**

```typescript
// src/extensions/instructions/InstructionManager.tsx

interface Instructions {
  system_prompt: string;
  response_style: 'professional' | 'casual' | 'academic' | 'creative';
  domain_expertise: string[];
  temperature: number;
  max_tokens: number;
}

export const InstructionManager: React.FC = () => {
  const [instructions, setInstructions] = useState<Instructions>({
    system_prompt: 'You are a helpful AI assistant.',
    response_style: 'professional',
    domain_expertise: [],
    temperature: 0.7,
    max_tokens: 2048,
  });

  const saveInstructions = async () => {
    await fetch('/api/instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(instructions),
    });
  };

  return (
    <div className="instruction-manager">
      <h3>Custom Instructions</h3>

      <div className="instruction-group">
        <label>System Prompt</label>
        <textarea
          value={instructions.system_prompt}
          onChange={(e) => setInstructions({
            ...instructions,
            system_prompt: e.target.value
          })}
          placeholder="You are a helpful AI assistant specialized in..."
        />
      </div>

      <div className="instruction-group">
        <label>Response Style</label>
        <select
          value={instructions.response_style}
          onChange={(e) => setInstructions({
            ...instructions,
            response_style: e.target.value
          })}
        >
          <option value="professional">Professional</option>
          <option value="casual">Casual</option>
          <option value="academic">Academic</option>
          <option value="creative">Creative</option>
        </select>
      </div>

      <div className="instruction-group">
        <label>Domain Expertise</label>
        <input
          type="text"
          placeholder="e.g., machine learning, biology, law"
          onChange={(e) => setInstructions({
            ...instructions,
            domain_expertise: e.target.value.split(',')
          })}
        />
      </div>

      <div className="instruction-group">
        <label>Temperature: {instructions.temperature}</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={instructions.temperature}
          onChange={(e) => setInstructions({
            ...instructions,
            temperature: parseFloat(e.target.value)
          })}
        />
      </div>

      <button onClick={saveInstructions}>
        Save Instructions
      </button>
    </div>
  );
};
```

---

## 🎨 LM Studio UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  LM Studio + FinSavvyAI                                   │
├────────────┬──────────────────────┬─────────────────────────┤
│            │                      │                         │
│  Sources   │   Notebook Chat      │   Instructions          │
│            │                      │                         │
│  📚 6 docs │   📝 Notebook 1      │   🎯 Custom Prompts      │
│  📄 3 PDFs │   Section 1         │   Style: Professional     │
│  💻 2 code │   [Messages]        │   Expert: ML, AI         │
│            │                      │   Temp: 0.7             │
│  + Upload  │   [Suggestions]     │                         │
│            │                      │                         │
└────────────┴──────────────────────┴─────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Chat Input                                                 │
│  [🎤] [💬] [📚] [📝] [❓] [🎯]                               │
│  ─────────────────────────────────────────────────────────  │
│  [Voice] [Attach Sources] [Quick Actions]                   │
│  ─────────────────────────────────────────────────────────  │
│  Ask anything about your documents...                       │
│  ─────────────────────────────────────────────────────────  │
│  [Send (Shift+Enter for newline)]                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Implementation Priority

### Phase 1: Foundation (Week 1-2)
1. Voice interface (speech-to-text)
2. Source management (upload, chunk)
3. Enhanced chat UI

### Phase 2: Core Features (Week 3-4)
4. RAG querying with citations
5. Notebook organization
6. Quick actions

### Phase 3: Advanced (Week 5-6)
7. Custom instructions
8. Domain expertise
9. Export capabilities

---

## 🚀 Quick Start

```bash
# Install with NotebookLM features
pip install finsavvyai[notebooklm]

# Start with RAG support
FINSAVVYAI_NOTEBOOKLM_ENABLED=true \
python -m src.api.gateway

# Access in LM Studio
# Open Extensions → FinSavvyAI Notebook
```

---

## 📈 Impact

**Voice Interface:**
- Hands-free document queries
- Accessibility improvements
- Mobile-friendly

**Source Management:**
- Document Q&A with citations
- Cross-reference analysis
- Research assistance

**Enhanced Chat:**
- Organized conversations
- Context tracking
- Follow-up suggestions

**Custom Instructions:**
- Domain-specific responses
- Consistent persona
- Tailored outputs

---

**Next:** Build these features into the desktop extension?
