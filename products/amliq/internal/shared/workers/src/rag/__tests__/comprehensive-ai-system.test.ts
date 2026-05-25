/**
 * Comprehensive AI System Integration Tests
 *
 * Tests the complete RAG and multi-modal processing pipeline:
 * - Document ingestion and content extraction
 * - Vector embedding and similarity search
 * - Multi-modal AI processing (documents, images, audio)
 * - Real-time learning and adaptation
 * - Intelligent document processing
 * - Knowledge graph construction and querying
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RAGOrchestrator } from "../orchestration/rag-orchestrator";
import { MultiModalProcessor } from "../multi-modal/multi-modal-processor";
import { RealTimeLearningSystem } from "../learning/real-time-learning-system";
import { IntelligentDocumentProcessor } from "../document-processing/intelligent-document-processor";
import { VectorizeService } from "../vectorize/services/vector-service";

describe("Comprehensive AI System Integration", () => {
  let ragOrchestrator: RAGOrchestrator;
  let multiModalProcessor: MultiModalProcessor;
  let learningSystem: RealTimeLearningSystem;
  let documentProcessor: IntelligentDocumentProcessor;
  let vectorService: VectorizeService;

  // Mock dependencies
  const mockAI = {
    run: vi.fn().mockResolvedValue({
      text: "Sample extracted text",
      description: "Sample description",
      entities: [],
      confidence: 0.85,
      data: [0.1, 0.2, 0.3], // Sample embedding
    }),
  };

  const mockR2 = {
    put: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue(null),
  };

  const mockKV = {
    put: vi.fn().mockResolvedValue(),
    get: vi.fn().mockResolvedValue(null),
  };

  const mockD1 = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn(),
        first: vi.fn(),
        all: vi.fn(),
      }),
    }),
  };

  const mockVectorize = {
    upsert: vi.fn().mockResolvedValue(),
    query: vi.fn().mockResolvedValue({
      matches: [
        { id: "doc1", score: 0.9, distance: 0.1, metadata: {} },
        { id: "doc2", score: 0.8, distance: 0.2, metadata: {} },
      ],
    }),
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockAnalytics = {
    track: vi.fn(),
    getMetrics: vi.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Initialize services
    vectorService = new VectorizeService(mockVectorize, mockLogger);
    multiModalProcessor = new MultiModalProcessor(mockAI, mockR2, mockLogger);
    learningSystem = new RealTimeLearningSystem(
      mockKV,
      mockD1,
      mockAI,
      mockAnalytics,
      mockLogger,
    );
    documentProcessor = new IntelligentDocumentProcessor(
      mockAI,
      mockR2,
      mockVectorize,
      null,
      mockLogger,
    );
  });

  describe("RAG Pipeline Integration", () => {
    it("should successfully process document ingestion pipeline", async () => {
      const mockDocumentIngester = {
        ingest: vi.fn().mockResolvedValue({
          documentId: "doc1",
          metadata: { size: 1024, type: "pdf" },
          content: new ArrayBuffer(1024),
        }),
      };

      const mockContentExtractor = {
        extract: vi.fn().mockResolvedValue({
          text: "Document content",
          entities: [{ type: "ORGANIZATION", value: "Test Corp" }],
          structure: { sections: ["header", "body", "footer"] },
        }),
      };

      const mockEmbeddingGenerator = {
        generateAndStoreEmbeddings: vi.fn().mockResolvedValue({
          vectors: [
            { id: "doc1_chunk1", values: [0.1, 0.2, 0.3], metadata: {} },
            { id: "doc1_chunk2", values: [0.4, 0.5, 0.6], metadata: {} },
          ],
        }),
      };

      const mockKnowledgeGraphBuilder = {
        buildGraph: vi.fn().mockResolvedValue({
          entities: [{ id: "ent1", type: "organization", label: "Test Corp" }],
          relationships: [
            { source: "ent1", target: "ent2", type: "related_to" },
          ],
        }),
      };

      const mockQueueManager = {
        enqueue: vi.fn().mockResolvedValue("queue_id_1"),
        dequeue: vi.fn(),
      };

      const mockNotificationManager = {
        send: vi.fn().mockResolvedValue(),
      };

      const mockQueryEngine = {
        search: vi.fn().mockResolvedValue({
          results: [{ id: "doc1", content: "Relevant content", score: 0.9 }],
        }),
      };

      ragOrchestrator = new RAGOrchestrator(
        mockDocumentIngester,
        mockContentExtractor,
        mockEmbeddingGenerator,
        mockKnowledgeGraphBuilder,
        mockQueryEngine,
        mockQueueManager,
        mockNotificationManager,
        mockLogger,
      );

      const request = {
        id: "test_request_1",
        type: "ingest_document",
        data: {
          content: new ArrayBuffer(1024),
          metadata: { filename: "test.pdf", contentType: "application/pdf" },
        },
        userId: "user1",
        timestamp: new Date().toISOString(),
      };

      const result = await ragOrchestrator.process(request);

      expect(result.status).toBe("completed");
      expect(result.type).toBe("ingest_document");
      expect(result.result.ingestion).toBeDefined();
      expect(result.result.extraction).toBeDefined();
      expect(result.result.embedding).toBeDefined();
      expect(result.result.knowledgeGraph).toBeDefined();
      expect(result.metadata.dataProcessed.documentsProcessed).toBe(1);
      expect(result.metadata.dataProcessed.embeddingsCreated).toBeGreaterThan(
        0,
      );
    });

    it("should handle query processing with semantic search", async () => {
      const mockQueryEngine = {
        search: vi.fn().mockResolvedValue({
          results: [
            {
              id: "doc1",
              content: "Financial regulation compliance requirements",
              relevanceScore: 0.95,
              metadata: { type: "regulatory_document" },
              excerpt:
                "All financial institutions must comply with KYC regulations",
            },
          ],
        }),
      };

      ragOrchestrator = new RAGOrchestrator(
        null,
        null,
        null,
        null,
        mockQueryEngine,
        { enqueue: vi.fn() },
        { send: vi.fn() },
        mockLogger,
      );

      const request = {
        id: "query_test_1",
        type: "process_query",
        data: {
          query: "What are KYC requirements?",
          type: "semantic",
          maxResults: 5,
          includeExcerpts: true,
        },
        userId: "user1",
        timestamp: new Date().toISOString(),
      };

      const result = await ragOrchestrator.process(request);

      expect(result.status).toBe("completed");
      expect(result.result.results).toHaveLength(1);
      expect(result.result.results[0].relevanceScore).toBeGreaterThan(0.9);
      expect(result.metadata.dataProcessed.queriesProcessed).toBe(1);
      expect(result.metadata.quality.queryRelevance).toBeGreaterThan(0);
    });

    it("should perform compliance analysis", async () => {
      const mockQueryEngine = {
        search: vi.fn().mockResolvedValue({
          results: [
            {
              id: "bsa_manual",
              content: "Bank Secrecy Act compliance requirements",
              relevanceScore: 0.92,
              metadata: { jurisdiction: "US", regulation: "BSA" },
            },
          ],
        }),
      };

      ragOrchestrator = new RAGOrchestrator(
        null,
        null,
        null,
        null,
        mockQueryEngine,
        { enqueue: vi.fn() },
        { send: vi.fn() },
        mockLogger,
      );

      const request = {
        id: "compliance_test_1",
        type: "analyze_compliance",
        data: {
          scope: {
            jurisdictions: ["US"],
            timeRange: { from: "2024-01-01", to: "2024-12-31" },
            entityTypes: ["financial_institution"],
          },
          focus: {
            requirements: ["KYC", "AML"],
            risks: ["compliance_violation"],
          },
        },
        userId: "user1",
        timestamp: new Date().toISOString(),
      };

      const result = await ragOrchestrator.process(request);

      expect(result.status).toBe("completed");
      expect(result.result.summary).toBeDefined();
      expect(result.result.summary.overallCompliance).toBeGreaterThan(0);
      expect(result.result.findings).toBeDefined();
      expect(Array.isArray(result.result.findings)).toBe(true);
    });

    it("should handle bulk document processing", async () => {
      const mockDocumentIngester = {
        ingest: vi.fn().mockImplementation(async (doc) => ({
          documentId: doc.id,
          metadata: doc.metadata,
        })),
      };

      const mockContentExtractor = {
        extract: vi.fn().mockResolvedValue({ text: "Content" }),
      };

      const mockEmbeddingGenerator = {
        generateAndStoreEmbeddings: vi.fn().mockResolvedValue({ vectors: [] }),
      };

      const mockKnowledgeGraphBuilder = {
        buildGraph: vi
          .fn()
          .mockResolvedValue({ entities: [], relationships: [] }),
      };

      ragOrchestrator = new RAGOrchestrator(
        mockDocumentIngester,
        mockContentExtractor,
        mockEmbeddingGenerator,
        mockKnowledgeGraphBuilder,
        { search: vi.fn() },
        { enqueue: vi.fn() },
        { send: vi.fn() },
        mockLogger,
      );

      const request = {
        id: "bulk_test_1",
        type: "bulk_import",
        data: {
          documents: [
            {
              id: "doc1",
              content: new ArrayBuffer(1024),
              metadata: { type: "invoice" },
            },
            {
              id: "doc2",
              content: new ArrayBuffer(2048),
              metadata: { type: "contract" },
            },
            {
              id: "doc3",
              content: new ArrayBuffer(1536),
              metadata: { type: "report" },
            },
          ],
        },
        userId: "user1",
        timestamp: new Date().toISOString(),
      };

      const result = await ragOrchestrator.process(request);

      expect(result.status).toBe("completed");
      expect(result.result.total).toBe(3);
      expect(result.result.successful).toBeGreaterThan(0);
      expect(result.result.failed).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.result.results)).toBe(true);
    });
  });

  describe("Multi-Modal Processing Integration", () => {
    it("should process PDF documents with text and images", async () => {
      const pdfContent = new ArrayBuffer(50000); // 50KB PDF

      const request = {
        id: "pdf_test_1",
        documentType: "pdf",
        content: pdfContent,
        options: {
          extractImages: true,
          extractTables: true,
          extractForms: true,
        },
      };

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (input.prompt?.includes("Extract all text")) {
          return {
            text: "Invoice #INV-001\nAmount: $1,500.00\nDue Date: 2024-02-15",
            confidence: 0.9,
          };
        } else if (input.prompt?.includes("Analyze this image")) {
          return {
            description: "Invoice with company logo and payment information",
            elements: ["text", "table", "logo"],
            confidence: 0.85,
          };
        }
        return { confidence: 0.8 };
      });

      const result = await multiModalProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.content.text).toContain("Invoice");
      expect(result.content.media).toBeDefined();
      expect(result.content.structuredData).toBeDefined();
      expect(result.embeddings).toBeDefined();
      expect(Array.isArray(result.embeddings)).toBe(true);
      expect(result.metadata.confidence).toBeGreaterThan(0.7);
    });

    it("should process images with OCR and analysis", async () => {
      const imageContent = new ArrayBuffer(25000); // 25KB image

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (input.prompt?.includes("Extract all text")) {
          return {
            text: "Receipt\nTotal: $45.67\nDate: 02/15/2024",
            confidence: 0.88,
          };
        } else if (input.prompt?.includes("Analyze this image")) {
          return {
            description: "Store receipt with items and total amount",
            isScannedDocument: false,
            elements: ["text", "total_amount", "date"],
            confidence: 0.82,
          };
        }
        return { confidence: 0.8 };
      });

      const request = {
        id: "image_test_1",
        documentType: "image",
        content: imageContent,
      };

      const result = await multiModalProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.content.text).toContain("$45.67");
      expect(result.content.media).toHaveLength(1);
      expect(result.content.media[0].type).toBe("image");
      expect(result.entities).toBeDefined();
      expect(result.classification).toBeDefined();
    });

    it("should process charts and graphs with data extraction", async () => {
      const chartContent = new ArrayBuffer(30000); // Chart image

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (input.prompt?.includes("Analyze this chart")) {
          return {
            description: "Revenue growth chart showing upward trend",
            chartType: "line_chart",
            dataPoints: 12,
            trends: ["positive_growth", "increasing_revenue"],
            axes: { x: "Month", y: "Revenue ($)" },
            confidence: 0.87,
          };
        }
        return { confidence: 0.8 };
      });

      const request = {
        id: "chart_test_1",
        documentType: "chart",
        content: chartContent,
      };

      const result = await multiModalProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.content.media[0].type).toBe("chart");
      expect(result.content.media[0].metadata.chartType).toBe("line_chart");
      expect(result.content.structuredData[0].type).toBe("chart_data");
      expect(
        result.content.extractedFields.some((f) => f.name === "chart_type"),
      ).toBe(true);
    });

    it("should process audio with speech-to-text conversion", async () => {
      const audioContent = new ArrayBuffer(100000); // 100KB audio

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (model.includes("whisper")) {
          return {
            text: "This is a financial compliance training session covering KYC requirements and customer due diligence procedures.",
            confidence: 0.91,
          };
        }
        return { confidence: 0.8 };
      });

      const request = {
        id: "audio_test_1",
        documentType: "audio",
        content: audioContent,
      };

      const result = await multiModalProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.content.text).toContain("KYC");
      expect(result.content.media[0].type).toBe("audio");
      expect(result.content.media[0].metadata.language).toBe("en");
      expect(result.content.media[0].metadata.confidence).toBeGreaterThan(0.8);
    });

    it("should process structured data formats", async () => {
      const csvData = `Name,Amount,Date,Category
Coffee,4.50,2024-02-15,Food
Gasoline,65.00,2024-02-14,Transportation
Salary,5000.00,2024-02-01,Income`;

      const request = {
        id: "structured_test_1",
        documentType: "structured_data",
        content: csvData,
        options: { format: "csv" },
      };

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (model.includes("embedding")) {
          return {
            data: [0.1, 0.2, 0.3, 0.4, 0.5],
          };
        }
        return { confidence: 0.8 };
      });

      const result = await multiModalProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.structuredData).toBeDefined();
      expect(result.structuredData[0].type).toBe("table");
      expect(result.metadata.format).toBe("csv");
      expect(result.text).toContain("CSV data");
    });
  });

  describe("Real-Time Learning System Integration", () => {
    it("should track user behavior for learning", async () => {
      const request = {
        id: "behavior_test_1",
        type: "track_behavior",
        userId: "user123",
        data: {
          type: "query",
          content: "KYC requirements for banks",
          timestamp: new Date().toISOString(),
          metadata: {
            queryType: "semantic",
            resultsReturned: 5,
            clickThroughRate: 0.6,
          },
        },
      };

      const result = await learningSystem.process(request);

      expect(result.success).toBe(true);
      expect(result.data.behaviorStored).toBe(true);
      expect(result.data.profileUpdated).toBe(true);
      expect(result.data.insights).toBeDefined();
      expect(Array.isArray(result.data.insights)).toBe(true);
    });

    it("should process user feedback for model improvement", async () => {
      const request = {
        id: "feedback_test_1",
        type: "process_feedback",
        userId: "user123",
        data: {
          type: "relevance_feedback",
          targetId: "query_result_1",
          rating: 5, // 1-5 scale
          feedback: "Highly relevant and comprehensive answer",
          timestamp: new Date().toISOString(),
        },
      };

      mockD1.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn(),
          first: vi.fn().mockResolvedValue({ count: 10 }), // Sufficient feedback samples
        }),
      });

      const result = await learningSystem.process(request);

      expect(result.success).toBe(true);
      expect(result.data.feedbackStored).toBe(true);
      expect(result.data.impact).toBeDefined();
      expect(result.data.modelUpdateTriggered).toBe(true);
    });

    it("should detect user behavior patterns", async () => {
      const request = {
        id: "pattern_test_1",
        type: "detect_patterns",
        userId: "user123",
        data: {
          timeWindow: 24 * 60 * 60 * 1000, // 24 hours
        },
      };

      const result = await learningSystem.process(request);

      expect(result.success).toBe(true);
      expect(result.data.patternsDetected).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.data.patterns)).toBe(true);
      expect(Array.isArray(result.data.significantPatterns)).toBe(true);
    });

    it("should update user personalization profile", async () => {
      const request = {
        id: "personalization_test_1",
        type: "update_personalization",
        userId: "user123",
        data: {
          behavior: {
            type: "document_view",
            documentType: "financial_statement",
            duration: 120000, // 2 minutes
            interactions: ["zoom", "highlight", "bookmark"],
          },
        },
      };

      const result = await learningSystem.process(request);

      expect(result.success).toBe(true);
      expect(result.data.profileUpdated).toBe(true);
      expect(result.data.profileSize).toBeGreaterThan(0);
      expect(result.data.insights).toBeDefined();
      expect(Array.isArray(result.data.changes)).toBe(true);
    });

    it("should identify anomalies in user behavior", async () => {
      const request = {
        id: "anomaly_test_1",
        type: "identify_anomalies",
        userId: "user123",
        data: {
          timeWindow: 12 * 60 * 60 * 1000, // 12 hours
        },
      };

      const result = await learningSystem.process(request);

      expect(result.success).toBe(true);
      expect(result.data.anomaliesDetected).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.data.anomalies)).toBe(true);
      expect(Array.isArray(result.data.highSeverityAnomalies)).toBe(true);
      expect(typeof result.data.requiresAction).toBe("boolean");
    });

    it("should generate learning insights", async () => {
      const request = {
        id: "insights_test_1",
        type: "generate_insights",
        userId: "user123",
        data: {
          types: ["behavior", "feedback", "patterns", "personalization"],
        },
      };

      const result = await learningSystem.process(request);

      expect(result.success).toBe(true);
      expect(result.data.insightsGenerated).toBeGreaterThan(0);
      expect(Array.isArray(result.data.insights)).toBe(true);
      expect(Array.isArray(result.data.recommendations)).toBe(true);
      expect(Array.isArray(result.data.alerts)).toBe(true);
    });
  });

  describe("Intelligent Document Processing Integration", () => {
    it("should classify documents accurately", async () => {
      const documentContent = new ArrayBuffer(40000);

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (input.prompt?.includes("determine what type of document")) {
          return {
            category: "contract",
            secondary_categories: ["agreement", "legal_document"],
            industry_sector: "banking",
            document_purpose: "legal",
            confidence: 0.92,
            key_indicators: [
              "terms_and_conditions",
              "signatures",
              "legal_clauses",
            ],
          };
        }
        return { confidence: 0.8 };
      });

      const request = {
        id: "classification_test_1",
        documentType: "auto",
        content: documentContent,
      };

      const result = await documentProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.classification.category).toBe("contract");
      expect(result.classification.confidence).toBeGreaterThan(0.9);
      expect(result.classification.industry).toBe("banking");
      expect(result.classification.purpose).toBe("legal");
    });

    it("should process contracts with term extraction", async () => {
      const contractContent = new ArrayBuffer(60000);

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (input.prompt?.includes("Extract key terms")) {
          return {
            terms: [
              {
                type: "effective_date",
                value: "2024-03-01",
                importance: "high",
              },
              { type: "term_duration", value: "24 months", importance: "high" },
              {
                type: "payment_terms",
                value: "Net 30 days",
                importance: "high",
              },
              {
                type: "governing_law",
                value: "State of Delaware",
                importance: "medium",
              },
            ],
            parties: ["Acme Corp", "Global Solutions Ltd"],
            dates: ["2024-03-01", "2026-02-28"],
            obligations: ["payment", "delivery", "confidentiality"],
            confidence: 0.88,
          };
        } else if (input.prompt?.includes("Analyze this contract")) {
          return {
            category: "contract",
            confidence: 0.91,
            industry_sector: "technology",
          };
        }
        return { confidence: 0.8 };
      });

      const request = {
        id: "contract_test_1",
        documentType: "pdf",
        content: contractContent,
      };

      const result = await documentProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.specializedProcessing.type).toBe("contract_analysis");
      expect(result.specializedProcessing.keyTerms).toBeDefined();
      expect(Array.isArray(result.specializedProcessing.keyTerms)).toBe(true);
      expect(result.specializedProcessing.parties).toHaveLength(2);
      expect(result.specializedProcessing.metadata.contractType).toBeDefined();
    });

    it("should process financial statements with data extraction", async () => {
      const statementContent = new ArrayBuffer(50000);

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (input.prompt?.includes("Extract financial information")) {
          return {
            amounts: ["1500000", "450000", "275000", "775000"],
            currencies: ["USD"],
            dates: ["2024-01-31", "2023-12-31"],
            accounts: ["revenue", "expenses", "net_income"],
            balances: {
              total_assets: "2500000",
              total_liabilities: "750000",
              equity: "1750000",
            },
            confidence: 0.89,
          };
        } else if (input.prompt?.includes("determine what type of document")) {
          return {
            category: "financial_statement",
            confidence: 0.87,
            industry_sector: "banking",
          };
        }
        return { confidence: 0.8 };
      });

      const request = {
        id: "financial_test_1",
        documentType: "pdf",
        content: statementContent,
      };

      const result = await documentProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.specializedProcessing.type).toBe("financial_analysis");
      expect(result.specializedProcessing.financialData).toBeDefined();
      expect(result.specializedProcessing.summary).toBeDefined();
      expect(result.specializedProcessing.metadata.currencies).toContain("USD");
      expect(result.specializedProcessing.metrics).toBeDefined();
    });

    it("should process regulatory documents with compliance mapping", async () => {
      const regulatoryContent = new ArrayBuffer(70000);

      mockAI.run.mockImplementationOnce(async (model, input) => {
        if (input.prompt?.includes("identify applicable regulations")) {
          return {
            regulations: ["SOX", "AML", "KYC"],
            requirements: [
              "Customer identification procedures",
              "Suspicious activity reporting",
              "Record retention policies",
            ],
            control_objectives: [
              "Ensure customer identity verification",
              "Monitor for suspicious transactions",
              "Maintain required documentation",
            ],
            reporting_obligations: [
              "SAR filing",
              "Annual compliance report",
              "Regulatory updates",
            ],
            confidence: 0.9,
          };
        } else if (input.prompt?.includes("determine what type of document")) {
          return {
            category: "regulatory_filing",
            confidence: 0.88,
            industry_sector: "banking",
          };
        }
        return { confidence: 0.8 };
      });

      const request = {
        id: "regulatory_test_1",
        documentType: "pdf",
        content: regulatoryContent,
      };

      const result = await documentProcessor.process(request);

      expect(result.status).toBe("completed");
      expect(result.specializedProcessing.type).toBe("regulatory_analysis");
      expect(result.specializedProcessing.regulations).toBeDefined();
      expect(Array.isArray(result.specializedProcessing.regulations)).toBe(
        true,
      );
      expect(result.specializedProcessing.complianceMapping).toBeDefined();
      expect(result.specializedProcessing.recommendations).toBeDefined();
    });

    it("should handle document processing errors gracefully", async () => {
      mockAI.run.mockRejectedValueOnce(new Error("AI service unavailable"));

      const request = {
        id: "error_test_1",
        documentType: "pdf",
        content: new ArrayBuffer(1000),
      };

      const result = await documentProcessor.process(request);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("AI service unavailable");
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBe(0);
    });
  });

  describe("End-to-End Pipeline Integration", () => {
    it("should complete full pipeline from document ingestion to query", async () => {
      // Mock all services for end-to-end test
      const mockDocumentIngester = {
        ingest: vi.fn().mockResolvedValue({
          documentId: "e2e_doc_1",
          metadata: { size: 50000, type: "regulatory_document" },
          content: new ArrayBuffer(50000),
        }),
      };

      const mockContentExtractor = {
        extract: vi.fn().mockResolvedValue({
          text: "AML regulations require financial institutions to implement customer due diligence procedures and monitor transactions for suspicious activity.",
          entities: [
            { type: "REGULATION", value: "AML" },
            { type: "ORGANIZATION", value: "financial institutions" },
          ],
          structure: {
            sections: ["introduction", "requirements", "procedures"],
          },
        }),
      };

      const mockEmbeddingGenerator = {
        generateAndStoreEmbeddings: vi.fn().mockResolvedValue({
          vectors: [
            { id: "e2e_chunk1", values: [0.1, 0.2, 0.3, 0.4, 0.5] },
            { id: "e2e_chunk2", values: [0.6, 0.7, 0.8, 0.9, 1.0] },
          ],
        }),
      };

      const mockKnowledgeGraphBuilder = {
        buildGraph: vi.fn().mockResolvedValue({
          entities: [
            { id: "ent1", type: "regulation", label: "AML" },
            {
              id: "ent2",
              type: "organization_type",
              label: "financial institutions",
            },
          ],
          relationships: [
            { source: "ent1", target: "ent2", type: "applies_to" },
          ],
        }),
      };

      const mockQueryEngine = {
        search: vi.fn().mockResolvedValue({
          results: [
            {
              id: "e2e_doc_1",
              content:
                "AML regulations require customer due diligence procedures",
              relevanceScore: 0.94,
              excerpt:
                "AML regulations require financial institutions to implement customer due diligence procedures",
              metadata: { type: "regulatory_document", regulation: "AML" },
            },
          ],
        }),
      };

      ragOrchestrator = new RAGOrchestrator(
        mockDocumentIngester,
        mockContentExtractor,
        mockEmbeddingGenerator,
        mockKnowledgeGraphBuilder,
        mockQueryEngine,
        { enqueue: vi.fn() },
        { send: vi.fn() },
        mockLogger,
      );

      // Step 1: Ingest document
      const ingestRequest = {
        id: "e2e_ingest_1",
        type: "ingest_document",
        data: {
          content: new ArrayBuffer(50000),
          metadata: { filename: "aml_regulations.pdf" },
        },
        userId: "e2e_user",
        timestamp: new Date().toISOString(),
      };

      const ingestResult = await ragOrchestrator.process(ingestRequest);
      expect(ingestResult.status).toBe("completed");
      expect(ingestResult.result.ingestion.documentId).toBe("e2e_doc_1");

      // Step 2: Query the ingested document
      const queryRequest = {
        id: "e2e_query_1",
        type: "process_query",
        data: {
          query: "What are AML requirements for customer due diligence?",
          type: "semantic",
          maxResults: 5,
        },
        userId: "e2e_user",
        timestamp: new Date().toISOString(),
      };

      const queryResult = await ragOrchestrator.process(queryRequest);
      expect(queryResult.status).toBe("completed");
      expect(queryResult.result.results).toHaveLength(1);
      expect(queryResult.result.results[0].relevanceScore).toBeGreaterThan(0.9);
      expect(queryResult.result.results[0].content).toContain(
        "customer due diligence",
      );

      // Verify end-to-end flow
      expect(mockDocumentIngester.ingest).toHaveBeenCalledTimes(1);
      expect(
        mockEmbeddingGenerator.generateAndStoreEmbeddings,
      ).toHaveBeenCalledTimes(1);
      expect(mockQueryEngine.search).toHaveBeenCalledTimes(1);
    });

    it("should handle cross-component error propagation", async () => {
      const mockDocumentIngester = {
        ingest: vi.fn().mockRejectedValue(new Error("Storage unavailable")),
      };

      ragOrchestrator = new RAGOrchestrator(
        mockDocumentIngester,
        { extract: vi.fn() },
        { generateAndStoreEmbeddings: vi.fn() },
        { buildGraph: vi.fn() },
        { search: vi.fn() },
        { enqueue: vi.fn() },
        { send: vi.fn() },
        mockLogger,
      );

      const request = {
        id: "error_propagation_test_1",
        type: "ingest_document",
        data: { content: new ArrayBuffer(1000) },
        userId: "test_user",
        timestamp: new Date().toISOString(),
      };

      const result = await ragOrchestrator.process(request);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Storage unavailable");
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large document processing within time limits", async () => {
      const largeContent = new ArrayBuffer(10 * 1024 * 1024); // 10MB

      mockAI.run.mockImplementationOnce(async () => ({
        text: "Large document content...",
        confidence: 0.85,
      }));

      const startTime = Date.now();

      const request = {
        id: "performance_test_1",
        documentType: "pdf",
        content: largeContent,
        options: { timeout: 30000 },
      };

      const result = await multiModalProcessor.process(request);
      const processingTime = Date.now() - startTime;

      expect(result.status).toBe("completed");
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it("should process multiple documents concurrently", async () => {
      const documents = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent_test_${i}`,
        documentType: "pdf",
        content: new ArrayBuffer(10000),
      }));

      mockAI.run.mockImplementationOnce(async () => ({
        text: `Document content ${Math.random()}`,
        confidence: 0.85,
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        documents.map((doc) => multiModalProcessor.process(doc)),
      );

      const processingTime = Date.now() - startTime;

      expect(results.length).toBe(5);
      results.forEach((result) => {
        expect(result.status).toBe("completed");
      });

      // Concurrent processing should be faster than sequential
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe("Data Quality and Validation", () => {
    it("should validate input requests", async () => {
      const invalidRequest = {
        id: "", // Missing ID
        documentType: "pdf",
        content: new ArrayBuffer(1000),
      };

      const result = await multiModalProcessor.process(invalidRequest);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("Request ID is required");
    });

    it("should validate content size limits", async () => {
      const oversizedContent = new ArrayBuffer(200 * 1024 * 1024); // 200MB

      const request = {
        id: "size_test_1",
        documentType: "pdf",
        content: oversizedContent,
      };

      const result = await multiModalProcessor.process(request);

      expect(result.status).toBe("failed");
      expect(result.error).toContain("exceeds maximum allowed size");
    });

    it("should handle malformed content gracefully", async () => {
      const malformedContent = new ArrayBuffer(0); // Empty content

      mockAI.run.mockRejectedValueOnce(
        new Error("Cannot process empty content"),
      );

      const request = {
        id: "malformed_test_1",
        documentType: "pdf",
        content: malformedContent,
      };

      const result = await multiModalProcessor.process(request);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
    });
  });
});
