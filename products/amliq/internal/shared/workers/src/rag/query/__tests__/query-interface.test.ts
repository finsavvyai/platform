/**
 * Tests for Query Interface and Retrieval System
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SimpleQueryEngine } from "../interface/simple-query-engine";

describe("SimpleQueryEngine", () => {
  let queryEngine: SimpleQueryEngine;
  let mockVectorService: any;
  let mockGraphService: any;
  let mockAIService: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockVectorService = {
      query: vi.fn(),
    };

    mockGraphService = {
      findEntities: vi.fn(),
      findPaths: vi.fn(),
    };

    mockAIService = {
      run: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    queryEngine = new SimpleQueryEngine(
      mockVectorService,
      mockGraphService,
      mockAIService,
      mockLogger,
    );
  });

  describe("search", () => {
    const mockQueryVector = Array(1536)
      .fill(0)
      .map((_, i) => Math.sin(i * 0.1));

    const mockVectorResults = [
      {
        id: "result-1",
        score: 0.95,
        metadata: {
          title: "Customer Due Diligence Requirements",
          text: "Financial institutions must implement customer due diligence programs that include identification procedures, ongoing monitoring, and risk assessment.",
          documentId: "bsa-sec-1",
          documentTitle: "Bank Secrecy Act",
          jurisdiction: "US",
          documentType: "regulation",
          confidence: 0.9,
          entities: [
            "financial institution",
            "customer due diligence",
            "risk assessment",
          ],
        },
      },
      {
        id: "result-2",
        score: 0.87,
        metadata: {
          title: "Transaction Monitoring",
          text: "Banks must monitor transactions for suspicious activity and file reports when necessary.",
          documentId: "aml-sec-2",
          documentTitle: "AML Guidelines",
          jurisdiction: "US",
          documentType: "guideline",
          confidence: 0.85,
          entities: ["transaction monitoring", "suspicious activity"],
        },
      },
    ];

    it("should perform semantic search successfully", async () => {
      mockAIService.run.mockResolvedValue({
        data: [{ embedding: mockQueryVector }],
      });

      mockVectorService.query.mockResolvedValue(mockVectorResults);

      const request = {
        query: "customer due diligence requirements",
        type: "semantic" as const,
        maxResults: 10,
      };

      const result = await queryEngine.search(request);

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(2);
      expect(result.totalResults).toBe(2);
      expect(result.queryTime).toBeGreaterThanOrEqual(0);
      expect(mockAIService.run).toHaveBeenCalledWith(
        "@cf/baai/bge-base-en-v1.5",
        {
          text: ["customer due diligence requirements"],
        },
      );
      expect(mockVectorService.query).toHaveBeenCalledWith(mockQueryVector, {
        topK: 10,
        includeMetadata: true,
      });
    });

    it("should filter compliance results correctly", async () => {
      mockAIService.run.mockResolvedValue({
        data: [{ embedding: mockQueryVector }],
      });

      mockVectorService.query.mockResolvedValue(mockVectorResults);

      const request = {
        query: "compliance requirements",
        type: "compliance" as const,
      };

      const result = await queryEngine.search(request);

      expect(result.results.length).toBeGreaterThanOrEqual(1); // At least the regulation matches
      if (result.results.length > 0) {
        expect(result.results[0].source.documentType).toBe("regulation");
      }
    });

    it("should generate relevant suggestions", async () => {
      mockAIService.run.mockResolvedValue({
        data: [{ embedding: mockQueryVector }],
      });

      mockVectorService.query.mockResolvedValue(mockVectorResults);

      const request = {
        query: "customer identification",
        type: "compliance" as const,
      };

      const result = await queryEngine.search(request);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(
        result.suggestions.some(
          (s) =>
            s.toLowerCase().includes("customer") &&
            s.toLowerCase().includes("identification"),
        ),
      ).toBe(true);
    });

    it("should handle search errors gracefully", async () => {
      mockAIService.run.mockRejectedValue(new Error("AI service unavailable"));

      const request = {
        query: "test query",
        type: "semantic" as const,
      };

      const result = await queryEngine.search(request);

      expect(result.results).toHaveLength(0);
      expect(result.totalResults).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Search failed",
        expect.any(Object),
      );
    });
  });

  describe("getDetails", () => {
    it("should return details for valid result ID", async () => {
      const resultId = "test-result-1";
      const details = await queryEngine.getDetails(resultId);

      expect(details).toBeDefined();
      expect(details.id).toBe(resultId);
      expect(details.fullContent).toBeDefined();
    });
  });

  describe("exportResults", () => {
    const mockResults = [
      {
        id: "result-1",
        title: "Customer Due Diligence Requirements",
        content: "Test content",
        source: {
          documentId: "doc-1",
          documentTitle: "Bank Secrecy Act",
          jurisdiction: "US",
          documentType: "regulation",
        },
        relevanceScore: 0.95,
        confidence: 0.9,
        excerpt: "Customer due diligence excerpt...",
      },
    ];

    it("should export results as JSON", async () => {
      const exportData = await queryEngine.exportResults(mockResults, "json");

      expect(exportData.exportDate).toBeDefined();
      expect(exportData.totalResults).toBe(1);
      expect(exportData.results).toHaveLength(1);
      expect(exportData.results[0].title).toBe(
        "Customer Due Diligence Requirements",
      );
    });

    it("should export results as CSV", async () => {
      const exportData = await queryEngine.exportResults(mockResults, "csv");

      expect(exportData.headers).toBeDefined();
      expect(exportData.rows).toBeDefined();
      expect(exportData.headers).toContain("Title");
      expect(exportData.headers).toContain("Document");
      expect(exportData.rows).toHaveLength(1);
    });
  });
});
