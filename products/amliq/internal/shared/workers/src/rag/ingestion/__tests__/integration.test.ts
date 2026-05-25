import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentIngester, DocumentSource, DocumentType, Jurisdiction } from "../document-ingester";
import { RegulatoryFeedAdapter } from "../source-adapters/regulatory-feed-adapter";
import { UserUploadAdapter } from "../source-adapters/user-upload-adapter";
import { ApiImportAdapter } from "../source-adapters/api-import-adapter";
import { WebCrawlAdapter } from "../source-adapters/web-crawl-adapter";

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

describe("Document Ingestion Integration Tests", () => {
  let ingester: DocumentIngester;

  beforeEach(() => {
    vi.clearAllMocks();
    ingester = new DocumentIngester(mockQueue, mockLogger);
  });

  describe("End-to-End Ingestion Workflows", () => {
    it("should complete full workflow for regulatory document", async () => {
      const request = {
        source: DocumentSource.REGULATORY_FEED,
        type: DocumentType.REGULATION,
        jurisdiction: Jurisdiction.US,
        metadata: {
          regulatoryBody: "SEC",
          documentNumber: "2024-001"
        }
      };

      const result = await ingester.ingestDocument(request);

      expect(result.status).toBe("completed");
      expect(result.documentId).toBeDefined();
      expect(result.metadata.jurisdiction).toBe(Jurisdiction.US);
      expect(result.metadata.source).toBe(DocumentSource.REGULATORY_FEED);
      expect(result.metadata.documentType).toBe(DocumentType.REGULATION);

      // Verify AI processing queue was called
      expect(mockQueue.sendMessage).toHaveBeenCalledWith(
        "ai-processing",
        expect.objectContaining({
          processingSteps: [
            "content-extraction",
            "embedding-generation",
            "knowledge-graph-integration"
          ]
        })
      );
    });

    it("should handle complete user upload workflow", async () => {
      const request = {
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.EU,
        content: "This policy document outlines compliance guidelines for financial institutions operating in the European Union under GDPR requirements.",
        metadata: {
          filename: "eu-compliance-policy.pdf",
          mimeType: "application/pdf",
          uploadedBy: "user-123"
        }
      };

      const result = await ingester.ingestDocument(request);

      expect(result.status).toBe("completed");
      expect(result.metadata.uploadType).toBe("policy_document");
      expect(result.metadata.filename).toBe("eu-compliance-policy.pdf");
      expect(result.metadata.mimeType).toBe("application/pdf");
    });

    it("should process API import with metadata extraction", async () => {
      const request = {
        source: DocumentSource.API_IMPORT,
        jurisdiction: Jurisdiction.GLOBAL,
        apiUrl: "https://api.federalreserve.gov/data",
        metadata: {
          apiKey: "test-key",
          format: "json"
        }
      };

      const result = await ingester.ingestDocument(request);

      expect(result.status).toBe("completed");
      expect(result.metadata.sourceUrl).toBe("https://api.federalreserve.gov/data");
      expect(result.metadata.importFormat).toBe("json");
    });

    it("should crawl web content and extract metadata", async () => {
      const request = {
        source: DocumentSource.WEB_CRAWL,
        jurisdiction: Jurisdiction.GLOBAL,
        url: "https://www.federalreserve.gov/supervisionreg/letters.htm",
        metadata: {
          crawlDepth: 1,
          includeLinks: false
        }
      };

      const result = await ingester.ingestDocument(request);

      expect(result.status).toBe("completed");
      expect(result.metadata.sourceUrl).toBe("https://www.federalreserve.gov/supervisionreg/letters.htm");
      expect(result.metadata.contentType).toBe("text/html");
      expect(result.metadata.crawlMethod).toBe("automated");
    });
  });

  describe("Error Handling and Retry Logic", () => {
    it("should handle concurrent ingestion limit and queue appropriately", async () => {
      // Fill up active ingestions to trigger queuing
      const activeRequests = [];
      for (let i = 0; i < 8; i++) {
        ingester["activeIngestions"].set(`test-${i}`, true);
      }

      const requests = [
        {
          source: DocumentSource.USER_UPLOAD,
          jurisdiction: Jurisdiction.US,
          content: "High priority document",
          type: DocumentType.REGULATION
        },
        {
          source: DocumentSource.API_IMPORT,
          jurisdiction: Jurisdiction.EU,
          apiUrl: "https://api.example.com/data"
        }
      ];

      const results = await Promise.all(
        requests.map(req => ingester.ingestDocument(req))
      );

      // Both should be queued due to high load
      results.forEach(result => {
        expect(result.status).toBe("queued");
        expect(result.estimatedProcessingTime).toBeDefined();
      });

      // Verify queue was called
      expect(mockQueue.sendMessage).toHaveBeenCalledWith(
        "document-ingestion",
        expect.objectContaining({
          priority: expect.any(Number)
        })
      );
    });

    it("should handle adapter errors gracefully", async () => {
      const invalidRequest = {
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.US
        // Missing required content
      };

      const result = await ingester.ingestDocument(invalidRequest);

      expect(result.status).toBe("failed");
      expect(result.error).toBeDefined();
      expect(result.retryable).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should validate source adapter requests", async () => {
      const invalidRequests = [
        {
          source: DocumentSource.REGULATORY_FEED,
          // Missing jurisdiction
        },
        {
          source: DocumentSource.API_IMPORT,
          jurisdiction: Jurisdiction.US
          // Missing apiUrl
        },
        {
          source: DocumentSource.WEB_CRAWL,
          jurisdiction: Jurisdiction.EU
          // Missing url
        }
      ];

      for (const request of invalidRequests) {
        const result = await ingester.ingestDocument(request);
        expect(result.status).toBe("failed");
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("Priority and Queue Management", () => {
    it("should calculate correct priorities for different document types", async () => {
      const testCases = [
        {
          request: {
            source: DocumentSource.REGULATORY_FEED,
            type: DocumentType.REGULATION,
            jurisdiction: Jurisdiction.US
          },
          expectedMinPriority: 1800 // 10 * 1.2 * 1.5 * 100
        },
        {
          request: {
            source: DocumentSource.USER_UPLOAD,
            type: DocumentType.POLICY,
            jurisdiction: Jurisdiction.EU
          },
          expectedMinPriority: 715 // 5 * 1.1 * 1.3 * 100
        },
        {
          request: {
            source: DocumentSource.WEB_CRAWL,
            type: DocumentType.OTHER,
            jurisdiction: Jurisdiction.GLOBAL
          },
          expectedMinPriority: 300 // 3 * 1.0 * 1.0 * 100
        }
      ];

      for (const testCase of testCases) {
        const priority = ingester["calculatePriority"](testCase.request);
        expect(priority).toBeGreaterThanOrEqual(testCase.expectedMinPriority);
      }
    });

    it("should estimate processing times based on source type", async () => {
      const testCases = [
        {
          source: DocumentSource.REGULATORY_FEED,
          expectedTime: 45
        },
        {
          source: DocumentSource.WEB_CRAWL,
          expectedTime: 60
        },
        {
          source: DocumentSource.API_IMPORT,
          expectedTime: 35
        },
        {
          source: DocumentSource.USER_UPLOAD,
          expectedTime: 25
        }
      ];

      for (const testCase of testCases) {
        const request = {
          source: testCase.source,
          jurisdiction: Jurisdiction.US
        };

        const time = ingester["estimateProcessingTime"](request);
        expect(time).toBe(testCase.expectedTime);
      }
    });
  });

  describe("Document Classification", () => {
    it("should classify documents correctly based on content", () => {
      const testCases = [
        {
          content: "This regulation establishes new requirements for financial institutions under the Federal Register",
          expectedType: DocumentType.REGULATION
        },
        {
          content: "Our policy outlines guidelines for compliance and risk management procedures",
          expectedType: DocumentType.POLICY
        },
        {
          content: "In this court case, plaintiff v. defendant, the judge ruled on precedent-setting matters",
          expectedType: DocumentType.CASE_LAW
        },
        {
          content: "Market prices and trading volumes showed significant movement today",
          expectedType: DocumentType.MARKET_DATA
        },
        {
          content: "This is a general document without specific classification indicators",
          expectedType: DocumentType.OTHER
        }
      ];

      for (const testCase of testCases) {
        const result = ingester["classifyDocument"](testCase.content, {});
        expect(result).toBe(testCase.expectedType);
      }
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle concurrent ingestion within limits", async () => {
      const concurrentRequests = 5;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.US,
        content: `Test document content ${i}`,
        type: DocumentType.OTHER
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => ingester.ingestDocument(req))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result.status).toBe("completed");
        expect(result.documentId).toBeDefined();
      });

      // Should complete within reasonable time (less than 10 seconds for 5 documents)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it("should track ingestion statistics correctly", () => {
      const stats = ingester.getIngestionStats();

      expect(stats).toHaveProperty("active");
      expect(stats).toHaveProperty("maxConcurrent");
      expect(typeof stats.active).toBe("number");
      expect(typeof stats.maxConcurrent).toBe("number");
      expect(stats.maxConcurrent).toBe(10); // Default config
    });
  });

  describe("Configuration and Customization", () => {
    it("should use custom configuration when provided", () => {
      const customConfig = {
        maxConcurrentIngestions: 5,
        priorityWeights: {
          [DocumentSource.REGULATORY_FEED]: 20,
          [DocumentSource.USER_UPLOAD]: 10,
          [DocumentSource.API_IMPORT]: 15,
          [DocumentSource.WEB_CRAWL]: 5
        },
        retryConfig: {
          maxRetries: 5,
          backoffMs: 2000,
          maxBackoffMs: 60000
        }
      };

      const customIngester = new DocumentIngester(mockQueue, mockLogger, customConfig);
      const stats = customIngester.getIngestionStats();

      expect(stats.maxConcurrent).toBe(5);
    });
  });
});
