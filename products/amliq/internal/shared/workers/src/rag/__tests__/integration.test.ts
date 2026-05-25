import { describe, it, expect, beforeEach, vi } from "vitest";
import { DocumentIngester, DocumentSource, DocumentType, Jurisdiction } from "../ingestion/document-ingester";
import { ContentExtractor } from "../extraction/content-extraction";

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

// Mock global AI
const mockAI = {
  run: vi.fn()
};

describe("RAG System Integration", () => {
  let ingester: DocumentIngester;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("globalThis", { ...globalThis, AI: mockAI });
    ingester = new DocumentIngester(mockQueue, mockLogger);
  });

  it("should ingest document and queue for AI processing with content extraction", async () => {
    const request = {
      source: DocumentSource.USER_UPLOAD,
      type: DocumentType.REGULATION,
      jurisdiction: Jurisdiction.US,
      content: "Financial regulation with tables and entities like Federal Reserve.",
      metadata: {
        title: "Financial Regulation Act",
        author: "Regulatory Authority"
      }
    };

    // Mock AI responses
    mockAI.run
      .mockResolvedValueOnce({ text: "Cleaned content" })
      .mockResolvedValueOnce({ tables: [{ id: "table1", headers: ["Section", "Requirement"], confidence: 0.95 }] })
      .mockResolvedValueOnce({ figures: [{ id: "fig1", type: "diagram", confidence: 0.88 }] })
      .mockResolvedValueOnce({ entities: [{ text: "Federal Reserve", type: "Organization", confidence: 0.92 }] })
      .mockResolvedValueOnce({ crossReferences: [] });

    const result = await ingester.ingestDocument(request);

    expect(result.status).toBe("completed");
    expect(mockQueue.sendMessage).toHaveBeenCalledWith(
      "ai-processing",
      expect.objectContaining({
        extractedContent: expect.objectContaining({
          text: "Cleaned content",
          tables: expect.any(Array),
          confidence: expect.any(Number)
        }),
        processingSteps: ["embedding-generation", "knowledge-graph-integration"]
      })
    );
  });
});
