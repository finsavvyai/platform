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

describe("Document Ingestion Performance Tests", () => {
  let ingester: DocumentIngester;

  beforeEach(() => {
    vi.clearAllMocks();
    ingester = new DocumentIngester(mockQueue, mockLogger);
  });

  describe("Throughput Tests", () => {
    it("should handle bulk document ingestion within performance targets", async () => {
      const documentCount = 50;
      const targetThroughput = 10; // documents per second
      const targetTime = (documentCount / targetThroughput) * 1000; // in milliseconds

      const requests = Array.from({ length: documentCount }, (_, i) => ({
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.US,
        content: `Performance test document ${i} with sufficient content to simulate real-world usage. This document contains financial regulatory information that needs to be processed by the ingestion pipeline.`,
        type: i % 4 === 0 ? DocumentType.REGULATION :
              i % 4 === 1 ? DocumentType.POLICY :
              i % 4 === 2 ? DocumentType.CASE_LAW : DocumentType.OTHER
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        requests.map(req => ingester.ingestDocument(req))
      );
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify all documents processed
      expect(results).toHaveLength(documentCount);
      const successCount = results.filter(r => r.status === "completed").length;
      expect(successCount).toBe(documentCount);

      // Performance assertion - should complete within target time
      expect(totalTime).toBeLessThan(targetTime * 1.5); // Allow 50% buffer

      // Calculate actual throughput
      const actualThroughput = documentCount / (totalTime / 1000);
      expect(actualThroughput).toBeGreaterThan(targetThroughput * 0.7); // At least 70% of target

      console.log(`Processed ${documentCount} documents in ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${actualThroughput.toFixed(2)} documents/second`);
    });

    it("should maintain performance under high concurrent load", async () => {
      const concurrentBatches = 5;
      const documentsPerBatch = 10;

      const batches = Array.from({ length: concurrentBatches }, (_, batchIndex) =>
        Array.from({ length: documentsPerBatch }, (_, docIndex) => ({
          source: DocumentSource.REGULATORY_FEED,
          jurisdiction: batchIndex % 2 === 0 ? Jurisdiction.US : Jurisdiction.EU,
          type: DocumentType.REGULATION,
          metadata: {
            batchIndex,
            documentIndex: docIndex
          }
        }))
      );

      const startTime = performance.now();
      const batchResults = await Promise.all(
        batches.map(batch =>
          Promise.all(batch.map(req => ingester.ingestDocument(req)))
        )
      );
      const endTime = performance.now();

      const totalDocuments = concurrentBatches * documentsPerBatch;
      const totalTime = endTime - startTime;
      const throughput = totalDocuments / (totalTime / 1000);

      expect(totalDocuments).toBe(50);

      // Flatten results and verify all succeeded
      const allResults = batchResults.flat();
      const successCount = allResults.filter(r => r.status === "completed" || r.status === "queued").length;
      expect(successCount).toBe(totalDocuments);

      // Performance target for concurrent processing
      expect(throughput).toBeGreaterThan(5); // At least 5 docs/second under concurrent load

      console.log(`Concurrent processing: ${totalDocuments} documents in ${totalTime.toFixed(2)}ms`);
      console.log(`Concurrent throughput: ${throughput.toFixed(2)} documents/second`);
    });
  });

  describe("Latency Tests", () => {
    it("should meet latency targets for individual document types", async () => {
      const latencyTests = [
        {
          name: "User Upload",
          request: {
            source: DocumentSource.USER_UPLOAD,
            jurisdiction: Jurisdiction.US,
            content: "Test document content for latency measurement"
          },
          targetLatency: 100 // ms
        },
        {
          name: "API Import",
          request: {
            source: DocumentSource.API_IMPORT,
            jurisdiction: Jurisdiction.EU,
            apiUrl: "https://api.example.com/data"
          },
          targetLatency: 1500 // ms (includes API call simulation)
        },
        {
          name: "Web Crawl",
          request: {
            source: DocumentSource.WEB_CRAWL,
            jurisdiction: Jurisdiction.GLOBAL,
            url: "https://example.com/article"
          },
          targetLatency: 2500 // ms (includes crawl simulation)
        },
        {
          name: "Regulatory Feed",
          request: {
            source: DocumentSource.REGULATORY_FEED,
            jurisdiction: Jurisdiction.US
          },
          targetLatency: 1200 // ms (includes feed access simulation)
        }
      ];

      for (const test of latencyTests) {
        const iterations = 10;
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          const result = await ingester.ingestDocument(test.request);
          const endTime = performance.now();

          expect(result.status).toMatch(/^(completed|queued)$/);

          const latency = endTime - startTime;
          latencies.push(latency);
        }

        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
        const maxLatency = Math.max(...latencies);

        console.log(`${test.name} Latency:`);
        console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
        console.log(`  P95: ${p95Latency.toFixed(2)}ms`);
        console.log(`  Max: ${maxLatency.toFixed(2)}ms`);

        // P95 latency should be within target
        expect(p95Latency).toBeLessThan(test.targetLatency);
      }
    });

    it("should maintain low latency for queuing operations", async () => {
      // Fill active ingestions to force queuing
      for (let i = 0; i < 8; i++) {
        ingester["activeIngestions"].set(`test-${i}`, true);
      }

      const queueLatencies: number[] = [];
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const request = {
          source: DocumentSource.USER_UPLOAD,
          jurisdiction: Jurisdiction.US,
          content: `Queue test document ${i}`
        };

        const startTime = performance.now();
        const result = await ingester.ingestDocument(request);
        const endTime = performance.now();

        expect(result.status).toBe("queued");
        expect(result.estimatedProcessingTime).toBeDefined();

        const latency = endTime - startTime;
        queueLatencies.push(latency);
      }

      const avgQueueLatency = queueLatencies.reduce((sum, lat) => sum + lat, 0) / queueLatencies.length;
      const maxQueueLatency = Math.max(...queueLatencies);

      console.log(`Queue Latency - Average: ${avgQueueLatency.toFixed(2)}ms, Max: ${maxQueueLatency.toFixed(2)}ms`);

      // Queue operations should be very fast (< 50ms average, < 100ms max)
      expect(avgQueueLatency).toBeLessThan(50);
      expect(maxQueueLatency).toBeLessThan(100);
    });
  });

  describe("Memory and Resource Usage", () => {
    it("should handle large documents without memory issues", async () => {
      const largeContent = "A".repeat(100000); // 100KB document

      const request = {
        source: DocumentSource.USER_UPLOAD,
        jurisdiction: Jurisdiction.US,
        content: largeContent,
        metadata: {
          filename: "large-document.txt",
          fileSize: largeContent.length
        }
      };

      const startTime = performance.now();
      const result = await ingester.ingestDocument(request);
      const endTime = performance.now();

      expect(result.status).toBe("completed");
      expect(result.metadata.fileSize).toBe(largeContent.length);

      const processingTime = endTime - startTime;
      console.log(`Large document (100KB) processed in ${processingTime.toFixed(2)}ms`);

      // Large documents should still be processed efficiently
      expect(processingTime).toBeLessThan(500);
    });

    it("should maintain consistent performance across document sizes", async () => {
      const documentSizes = [
        { size: "1KB", content: "B".repeat(1000) },
        { size: "10KB", content: "C".repeat(10000) },
        { size: "50KB", content: "D".repeat(50000) },
        { size: "100KB", content: "E".repeat(100000) }
      ];

      const processingTimes: { size: string; time: number; contentLength: number }[] = [];

      for (const docSize of documentSizes) {
        const request = {
          source: DocumentSource.USER_UPLOAD,
          jurisdiction: Jurisdiction.US,
          content: docSize.content
        };

        const startTime = performance.now();
        const result = await ingester.ingestDocument(request);
        const endTime = performance.now();

        expect(result.status).toBe("completed");

        const processingTime = endTime - startTime;
        processingTimes.push({
          size: docSize.size,
          time: processingTime,
          contentLength: docSize.content.length
        });

        console.log(`${docSize.size}: ${processingTime.toFixed(2)}ms`);
      }

      // Performance should scale reasonably with document size
      // (100KB document shouldn't take more than 5x the time of 1KB document)
      const smallestTime = processingTimes[0].time;
      const largestTime = processingTimes[processingTimes.length - 1].time;
      const scalingFactor = largestTime / smallestTime;

      expect(scalingFactor).toBeLessThan(5);
      console.log(`Performance scaling factor: ${scalingFactor.toFixed(2)}x`);
    });
  });

  describe("Stress Tests", () => {
    it("should handle sustained load without performance degradation", async () => {
      const sustainedLoadDuration = 5000; // 5 seconds
      const documentsPerSecond = 8;
      const totalDocuments = Math.floor((sustainedLoadDuration / 1000) * documentsPerSecond);

      const startTime = performance.now();
      const endTimeTarget = startTime + sustainedLoadDuration;
      const results: any[] = [];

      let documentCount = 0;

      while (performance.now() < endTimeTarget && documentCount < totalDocuments) {
        const request = {
          source: DocumentSource.USER_UPLOAD,
          jurisdiction: Math.random() > 0.5 ? Jurisdiction.US : Jurisdiction.EU,
          content: `Sustained load test document ${documentCount}`,
          type: Object.values(DocumentType)[Math.floor(Math.random() * Object.values(DocumentType).length)]
        };

        const result = ingester.ingestDocument(request);
        results.push(result);
        documentCount++;

        // Brief pause to maintain target rate
        await new Promise(resolve => setTimeout(resolve, 1000 / documentsPerSecond));
      }

      // Wait for all pending ingestions to complete
      const finalResults = await Promise.all(results);
      const actualEndTime = performance.now();
      const totalTime = actualEndTime - startTime;

      const successCount = finalResults.filter(r => r.status === "completed" || r.status === "queued").length;
      const actualThroughput = successCount / (totalTime / 1000);

      console.log(`Sustained load test:`);
      console.log(`  Documents processed: ${successCount}/${documentCount}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Sustained throughput: ${actualThroughput.toFixed(2)} documents/second`);

      expect(successCount).toBe(documentCount);
      expect(actualThroughput).toBeGreaterThan(documentsPerSecond * 0.8); // At least 80% of target
    });

    it("should recover gracefully from resource exhaustion", async () => {
      // Fill up to maximum concurrent ingestions
      const maxConcurrent = ingester["config"].maxConcurrentIngestions;

      // Create initial batch to fill capacity
      const initialBatch = Array.from({ length: maxConcurrent }, (_, i) =>
        ingester.ingestDocument({
          source: DocumentSource.USER_UPLOAD,
          jurisdiction: Jurisdiction.US,
          content: `Initial batch document ${i}`
        })
      );

      // These should be processed or queued
      const initialResults = await Promise.all(initialBatch);
      expect(initialResults.length).toBe(maxConcurrent);

      // Create additional documents - these should be queued
      const additionalBatch = Array.from({ length: 5 }, (_, i) =>
        ingester.ingestDocument({
          source: DocumentSource.USER_UPLOAD,
          jurisdiction: Jurisdiction.EU,
          content: `Additional batch document ${i}`
        })
      );

      const additionalResults = await Promise.all(additionalBatch);

      // Additional documents should be queued due to capacity limits
      const queuedCount = additionalResults.filter(r => r.status === "queued").length;
      expect(queuedCount).toBeGreaterThan(0);

      console.log(`Resource exhaustion test: ${queuedCount}/5 documents queued as expected`);
    });
  });
});
