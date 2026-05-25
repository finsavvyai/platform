import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentIngester, DocumentSource, DocumentType, Jurisdiction } from "../document-ingester";

// Mock queue service
const mockQueue = {
  sendMessage: vi.fn().mockResolvedValue(undefined)
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe("DocumentIngester", () => {
  let ingester: DocumentIngester;

  beforeEach(() => {
    vi.clearAllMocks();
    ingester = new DocumentIngester(mockQueue, mockLogger);
  });

  describe("ingestDocument", () => {
    it("should successfully ingest a user upload document", async () => {
      const request = {
        source: DocumentSource.USER_UPLOAD,
        type: DocumentType.REGULATION,
        jurisdiction: Jurisdiction.US,
        content: "This is a test regulation document content...",
        metadata: {
          filename: "test-regulation.pdf",
          mimeType: "text/plain"
        }
      };

      const result = await ingester.ingestDocument(request);

      expect(result.status).toBe("completed");
      expect(result.ingestionId).toBeDefined();
      expect(result.documentId).toBeDefined();
      expect(result.metadata.jurisdiction).toBe(Jurisdiction.US);
      expect(result.metadata.source).toBe(DocumentSource.USER_UPLOAD);
      expect(mockQueue.sendMessage).toHaveBeenCalledWith(
        "ai-processing",
        expect.objectContaining({
          documentId: result.documentId,
          processingSteps: [
            "content-extraction",
            "embedding-generation",
            "knowledge-graph-integration"
          ]
        })
      );
    });

    it("should queue ingestion when at high load", async () => {
      // Create many active ingestions to trigger queuing
      for (let i = 0; i < 8; i++) {
        ingester["activeIngestions"].set(`test-${i}`, true);
      }

      const request = {
        source: DocumentSource.USER_UPLOAD,
        type: DocumentType.POLICY,
        jurisdiction: Jurisdiction.EU,
        content: "Test policy content..."
      };

      const result = await ingester.ingestDocument(request);

      expect(result.status).toBe("queued");
      expect(result.estimatedProcessingTime).toBeDefined();
      
      // Check that mockQueue.sendMessage was called with correct parameters
      expect(mockQueue.sendMessage).toHaveBeenCalledTimes(1);
      const [queueName, message, options] = mockQueue.sendMessage.mock.calls[0];
      
      expect(queueName).toBe("document-ingestion");
      expect(message).toMatchObject({
        ingestionId: expect.any(String),
        priority: expect.any(Number),
        queuedAt: expect.any(String),
        request: expect.objectContaining({
          source: DocumentSource.USER_UPLOAD,
          type: DocumentType.POLICY,
          jurisdiction: Jurisdiction.EU
        })
      });
      expect(options).toMatchObject({
        priority: expect.any(Number)
      });
    });

    it("should handle ingestion failures gracefully", async () => {
      const request = {
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.US,
        content: "" // Empty content to trigger error
      };

      const result = await ingester.ingestDocument(request);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
      expect(result.retryable).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("calculatePriority", () => {
    it("should give higher priority to regulatory documents", () => {
      const request = {
        source: DocumentSource.REGULATORY_FEED,
        type: DocumentType.REGULATION,
        jurisdiction: Jurisdiction.US
      };

      const priority = ingester["calculatePriority"](request);
      expect(priority).toBeGreaterThan(1000); // High priority for regulations
    });

    it("should boost priority for US jurisdiction", () => {
      const usRequest = {
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.US
      };
      
      const euRequest = {
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.EU
      };

      const usPriority = ingester["calculatePriority"](usRequest);
      const euPriority = ingester["calculatePriority"](euRequest);
      
      expect(usPriority).toBeGreaterThan(euPriority);
    });
  });

  describe("classifyDocument", () => {
    it("should classify regulation documents correctly", () => {
      const content = "This document contains important regulation information and federal register updates.";
      const result = ingester["classifyDocument"](content, {});
      expect(result).toBe(DocumentType.REGULATION);
    });

    it("should classify policy documents correctly", () => {
      const content = "This policy document outlines guidelines for compliance.";
      const result = ingester["classifyDocument"](content, {});
      expect(result).toBe(DocumentType.POLICY);
    });

    it("should classify case law documents correctly", () => {
      const content = "In this court case, the plaintiff v. defendant decision sets precedent.";
      const result = ingester["classifyDocument"](content, {});
      expect(result).toBe(DocumentType.CASE_LAW);
    });
  });

  describe("getIngestionStats", () => {
    it("should return current ingestion statistics", () => {
      const stats = ingester.getIngestionStats();
      expect(stats).toHaveProperty("active");
      expect(stats).toHaveProperty("maxConcurrent");
      expect(stats.maxConcurrent).toBe(10); // Default config
    });
  });

  describe("defaultConfig", () => {
    it("should return sensible default configuration", () => {
      const config = DocumentIngester.defaultConfig();
      expect(config.maxConcurrentIngestions).toBe(10);
      expect(config.priorityWeights[DocumentSource.REGULATORY_FEED]).toBe(10);
      expect(config.priorityWeights[DocumentSource.USER_UPLOAD]).toBe(5);
      expect(config.retryConfig.maxRetries).toBe(3);
    });
  });
});
