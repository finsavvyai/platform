import { describe, it, expect, beforeEach, vi } from "vitest";
import { ContentExtractor } from "../content-extractor";

// Mock AI service
const mockAI = {
  run: vi.fn()
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe("ContentExtractor", () => {
  let extractor: ContentExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new ContentExtractor(mockAI, mockLogger);
  });

  describe("extractContent", () => {
    it("should extract content with all components enabled", async () => {
      const documentId = "test-doc-1";
      const content = "This is a test document with a table: | Name | Age | \n| John | 25 | \nAnd a figure: Figure 1 shows the data trends. Date: 01/15/2024. Amount: $1,000.00.";
      const metadata = {
        title: "Test Document",
        documentType: "regulation",
        jurisdiction: "US"
      };

      // Mock AI responses
      mockAI.run
        .mockResolvedValueOnce({ text: "Cleaned text content" })
        .mockResolvedValueOnce({ tables: [{ id: "table1", headers: ["Name", "Age"], rows: [["John", "25"]], confidence: 0.9 }] })
        .mockResolvedValueOnce({ figures: [{ id: "fig1", title: "Figure 1", type: "chart", confidence: 0.85 }] })
        .mockResolvedValueOnce({ entities: [{ text: "01/15/2024", type: "Date", confidence: 0.95 }] })
        .mockResolvedValueOnce({ crossReferences: [] });

      const result = await extractor.extractContent(documentId, content, metadata);

      expect(result.text).toBe("Cleaned text content");
      expect(result.tables).toHaveLength(1);
      expect(result.figures).toHaveLength(1);
      expect(result.entities).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(mockAI.run).toHaveBeenCalledTimes(5);
    });

    it("should handle AI failures gracefully with fallback methods", async () => {
      const documentId = "test-doc-2";
      const content = "Simple document with | Simple | Table | and Figure 2 reference. Date: 12/01/2023.";
      const metadata = { title: "Simple Doc" };

      // Mock AI failure
      mockAI.run.mockRejectedValue(new Error("AI service unavailable"));

      const result = await extractor.extractContent(documentId, content, metadata);

      expect(result.text).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("should skip disabled components", async () => {
      const config = {
        enableTableExtraction: false,
        enableFigureExtraction: false,
        enableEntityRecognition: true,
        enableCrossReferenceDetection: false,
        confidenceThreshold: 0.7,
        maxProcessingTime: 30
      };

      extractor = new ContentExtractor(mockAI, mockLogger, config);

      const documentId = "test-doc-3";
      const content = "Document with entities: Apple Inc. and $500.00";
      const metadata = {};

      // Mock only entity recognition
      mockAI.run.mockResolvedValueOnce({ text: "Cleaned text" })
                  .mockResolvedValueOnce({ entities: [{ text: "Apple Inc.", type: "LegalEntity", confidence: 0.9 }] });

      const result = await extractor.extractContent(documentId, content, metadata);

      expect(result.tables).toHaveLength(0);
      expect(result.figures).toHaveLength(0);
      expect(result.entities).toHaveLength(1);
      expect(result.crossReferences).toHaveLength(0);
    });
  });

  describe("text cleaning", () => {
    it("should clean text content properly", async () => {
      const content = "  This\n\nis  a\t\ttest\n\ncontent  ";
      const metadata = {};

      mockAI.run.mockRejectedValue(new Error("AI unavailable")); // Force fallback

      const result = await extractor.extractContent("test", content, metadata);

      expect(result.text).toBe("This is a test content");
    });
  });

  describe("confidence calculation", () => {
    it("should calculate appropriate confidence scores", async () => {
      const content = "Document content";
      const metadata = {};

      mockAI.run
        .mockResolvedValueOnce({ text: "Cleaned text" })
        .mockResolvedValueOnce({ tables: [{ confidence: 0.8 }] })
        .mockResolvedValueOnce({ figures: [{ confidence: 0.7 }] })
        .mockResolvedValueOnce({ entities: [{ confidence: 0.9 }] })
        .mockResolvedValueOnce({ crossReferences: [{ confidence: 0.6 }] });

      const result = await extractor.extractContent("test", content, metadata);

      // Should be weighted average of all components
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThan(1.0);
    });
  });

  describe("error handling", () => {
    it("should handle extraction errors gracefully", async () => {
      const documentId = "test-doc-error";
      const content = "Test content";
      const metadata = {};

      mockAI.run.mockRejectedValue(new Error("Extraction failed"));

      await expect(extractor.extractContent(documentId, content, metadata))
        .rejects.toThrow("Content extraction failed: Extraction failed");
      
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
