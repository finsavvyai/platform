const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create uploads directory if it doesn't exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept common document formats
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, Word, and text files are allowed.'));
    }
  }
});

// In-memory storage for demo purposes
let documents = new Map();
let sessions = new Map();

// Mock PII detection patterns
const PII_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  phone: /\b\d{3}-\d{3}-\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  accountNumber: /\bAccount\s*#?:?\s*\d+/gi,
  address: /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/gi
};

// Document upload API
app.post('/api/upload', upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileId = uuidv4();

    // Read file content for PII detection
    let fileContent = '';
    try {
      if (file.mimetype === 'text/plain') {
        fileContent = fs.readFileSync(file.path, 'utf8');
      } else {
        // For binary files (PDF, Word), we'll simulate content extraction
        fileContent = `Sample content from ${file.originalname}. This document contains financial information, customer data, and business records. Some sensitive information might be present like SSN: 123-45-6789 or Phone: 555-123-4567.`;
      }
    } catch (error) {
      console.error('Error reading file:', error);
      fileContent = `Content from ${file.originalname}`;
    }

    // Detect PII
    const detectedPII = detectPII(fileContent);

    // Process document (mock RAG processing)
    const processedDocument = processDocument(fileContent, fileId);

    // Store document info
    const documentInfo = {
      id: fileId,
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString(),
      piiDetected: detectedPII,
      processed: processedDocument,
      content: fileContent.substring(0, 1000) // Store first 1000 chars for search
    };

    documents.set(fileId, documentInfo);

    res.json({
      success: true,
      fileId: fileId,
      originalName: file.originalname,
      size: file.size,
      piiDetected: detectedPII,
      processedDocument: processedDocument,
      status: 'ready_for_query',
      message: detectedPII.hasPII ?
        'Document processed successfully. PII detected and protected.' :
        'Document processed successfully. No PII detected.'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Chat API
app.post('/api/chat', (req, res) => {
  try {
    const { query, fileId, sessionId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get session or create new one
    let session = sessionId ? sessions.get(sessionId) : null;
    if (!session) {
      const newSessionId = uuidv4();
      session = {
        id: newSessionId,
        queries: [],
        documentsAccessed: new Set(),
        createdAt: new Date().toISOString()
      };
      sessions.set(newSessionId, session);
    }

    // Mock RAG pipeline - search documents
    const searchResults = searchDocuments(query, fileId);

    // Mock PII filtering
    const filteredResults = filterPII(searchResults);

    // Mock LLM processing
    const response = generateResponse(query, filteredResults);

    // Update session
    session.queries.push({
      query: query,
      response: response,
      timestamp: new Date().toISOString(),
      documentsUsed: searchResults.length
    });

    if (fileId) {
      session.documentsAccessed.add(fileId);
    }

    res.json({
      sessionId: session.id,
      query: query,
      response: response,
      sources: filteredResults.map(r => ({
        documentId: r.documentId,
        documentName: r.documentName,
        confidence: r.confidence,
        piiFiltered: r.piiFiltered,
        snippet: r.content.substring(0, 100) + '...'
      })),
      auditId: `audit_${Date.now()}`,
      timestamp: new Date().toISOString(),
      securityLevel: 'enterprise',
      complianceChecked: true
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Chat processing failed',
      message: error.message
    });
  }
});

// Get document list API
app.get('/api/documents', (req, res) => {
  try {
    const docList = Array.from(documents.values()).map(doc => ({
      id: doc.id,
      originalName: doc.originalName,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      hasPII: doc.piiDetected.hasPII,
      piiTypes: doc.piiDetected.types,
      status: 'processed'
    }));

    res.json({
      documents: docList,
      total: docList.length,
      totalWithPII: docList.filter(d => d.hasPII).length
    });
  } catch (error) {
    console.error('Documents list error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// Get session info API
app.get('/api/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId: session.id,
      queryCount: session.queries.length,
      documentsAccessed: Array.from(session.documentsAccessed),
      createdAt: session.createdAt,
      recentQueries: session.queries.slice(-5)
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// Health check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      upload: 'active',
      chat: 'active',
      piiDetection: 'active',
      ragPipeline: 'active'
    },
    metrics: {
      documentsProcessed: documents.size,
      activeSessions: sessions.size,
      totalQueries: Array.from(sessions.values()).reduce((sum, s) => sum + s.queries.length, 0)
    }
  });
});

// Helper functions

function detectPII(content) {
  const detectedTypes = {};
  let hasPII = false;

  Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      detectedTypes[type] = {
        count: matches.length,
        samples: matches.slice(0, 3).map(m => m.replace(/(\d{3})[\d-]*(\d{4})/, '$1-XX-$2')) // Show only first/last digits
      };
      hasPII = true;
    }
  });

  return {
    hasPII,
    types: detectedTypes,
    riskLevel: hasPII ? 'medium' : 'low',
    autoRedacted: hasPII
  };
}

function processDocument(content, fileId) {
  // Mock RAG processing
  const chunks = [];
  const chunkSize = 500;
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.substring(i, i + chunkSize));
  }

  return {
    fileId: fileId,
    chunks: chunks.length,
    embeddings: Array(chunks.length).fill('[vector_embedding_placeholder]'),
    metadata: {
      type: 'financial_document',
      riskLevel: 'medium',
      processedAt: new Date().toISOString(),
      chunkSize: chunkSize,
      language: 'en'
    },
    processingTime: Math.random() * 1000 + 500 // Mock processing time
  };
}

function searchDocuments(query, fileId) {
  const results = [];

  if (fileId && documents.has(fileId)) {
    const doc = documents.get(fileId);
    const score = calculateRelevanceScore(query.toLowerCase(), doc.content.toLowerCase());

    results.push({
      documentId: fileId,
      documentName: doc.originalName,
      content: doc.content,
      confidence: score,
      piiFiltered: doc.piiDetected.hasPII,
      relevanceScore: score
    });
  } else {
    // Search all documents
    documents.forEach((doc, id) => {
      const score = calculateRelevanceScore(query.toLowerCase(), doc.content.toLowerCase());
      if (score > 0.3) {
        results.push({
          documentId: id,
          documentName: doc.originalName,
          content: doc.content,
          confidence: score,
          piiFiltered: doc.piiDetected.hasPII,
          relevanceScore: score
        });
      }
    });
  }

  return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function calculateRelevanceScore(query, content) {
  const queryWords = query.split(' ');
  let score = 0;

  queryWords.forEach(word => {
    if (content.includes(word)) {
      score += 0.3;
    }
  });

  // Add some randomness for demo purposes
  score += Math.random() * 0.2;

  return Math.min(score, 1.0);
}

function filterPII(results) {
  return results.map(result => {
    let filteredContent = result.content;

    // Apply PII patterns to redact sensitive information
    Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
      filteredContent = filteredContent.replace(pattern, '[REDACTED]');
    });

    return {
      ...result,
      originalContent: result.content,
      content: filteredContent,
      piiRedactions: result.content !== filteredContent
    };
  });
}

function generateResponse(query, filteredResults) {
  const documentCount = filteredResults.length;
  const hasPII = filteredResults.some(r => r.piiRedactions);

  if (documentCount === 0) {
    return "I couldn't find relevant information in your uploaded documents. Please try rephrasing your query or upload additional documents.";
  }

  let response = `Based on your uploaded documents, I found relevant information for your query "${query}". `;

  response += `I analyzed ${documentCount} document${documentCount > 1 ? 's' : ''} from your repository. `;

  if (hasPII) {
    response += `For security purposes, any sensitive personal information has been automatically redacted from the results. `;
  }

  response += `The documents contain information related to your query. I recommend reviewing the specific document snippets provided for detailed information. `;

  response += `All interactions are logged for compliance and audit purposes.`;

  return response;
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SDLC Functional Demo Server running on port ${PORT}`);
  console.log(`📁 Upload directory: ${UPLOADS_DIR}`);
  console.log(`🌐 Access the demo at: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Shutting down gracefully...');
  process.exit(0);
});