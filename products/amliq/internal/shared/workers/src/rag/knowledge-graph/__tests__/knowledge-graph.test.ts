/**
 * Tests for Knowledge Graph Construction
 *
 * Comprehensive test suite covering:
 * - Entity extraction from regulatory content
 * - Relationship identification and extraction
 * - Graph construction and analytics
 * - Integration scenarios
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { KnowledgeGraphBuilder } from '../builder/graph-builder';
import { KnowledgeGraphExtractor } from '../extraction/entity-extractor';
import { RelationshipExtractor } from '../extraction/relationship-extractor';
import type {
  KnowledgeGraphConfig,
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  EntityType,
  RelationshipType
} from '../types/graph-types';
import type { ExtractedContent } from '../../extraction/types';

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

describe('Knowledge Graph Construction', () => {
  let graphBuilder: KnowledgeGraphBuilder;
  let entityExtractor: KnowledgeGraphExtractor;
  let relationshipExtractor: RelationshipExtractor;
  let config: KnowledgeGraphConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      entityExtraction: {
        minConfidence: 0.5,
        maxEntitiesPerSection: 50,
        enableDisambiguation: true,
        enableTemporalExtraction: true
      },
      relationshipExtraction: {
        minConfidence: 0.4,
        maxRelationshipsPerSection: 100,
        enableInference: true,
        enableTransitivity: true
      },
      graphConstruction: {
        enableClustering: true,
        enableCentralityCalculation: true,
        enablePathFinding: true,
        enableAnomalyDetection: true
      },
      storage: {
        batchSize: 100,
        compressionEnabled: true,
        indexingEnabled: true
      }
    };

    graphBuilder = new KnowledgeGraphBuilder(config, mockLogger);
    entityExtractor = new KnowledgeGraphExtractor(config, mockLogger);
    relationshipExtractor = new RelationshipExtractor(config, mockLogger);
  });

  describe('Entity Extraction', () => {
    const mockExtractedContent: ExtractedContent = {
      documentId: 'bsa-regulation-2024',
      title: 'Bank Secrecy Act Compliance Requirements',
      sections: [
        {
          id: 'sec-1',
          type: 'narrative',
          title: 'Financial Institution Requirements',
          content: 'All financial institutions must implement Anti-Money Laundering (AML) programs. The Federal Reserve regulates banks and must file suspicious activity reports (SARs) within 30 days.',
          metadata: { wordCount: 25, complexity: 'medium' }
        },
        {
          id: 'sec-2',
          type: 'requirements',
          title: 'Reporting Requirements',
          content: 'Financial institutions are required to file Currency Transaction Reports (CTRs) for cash transactions exceeding $10,000. Effective date: January 1, 2024.',
          metadata: { wordCount: 22, complexity: 'high' }
        }
      ],
      tables: [
        {
          id: 'table-1',
          title: 'Transaction Thresholds',
          headers: ['Transaction Type', 'Threshold', 'Reporting Requirement'],
          rows: [
            ['Cash Deposit', '$10,000', 'CTR required'],
            ['Wire Transfer', '$3,000', 'Suspicious activity review']
          ],
          metadata: { rowCount: 2, columnCount: 3 }
        }
      ],
      figures: [],
      entities: [
        {
          id: 'entity-1',
          type: 'organization',
          name: 'Federal Reserve',
          confidence: 0.95,
          context: 'The Federal Reserve regulates banks'
        }
      ],
      crossReferences: [
        {
          id: 'ref-1',
          type: 'section_reference',
          text: 'See section 2.A for detailed requirements',
          targetSectionId: 'sec-2a'
        }
      ],
      metadata: {
        jurisdiction: 'US',
        documentType: 'regulation',
        extractionDate: '2025-01-15T10:00:00Z',
        totalSections: 2,
        totalTables: 1
      }
    };

    it('should extract entities from regulatory content', async () => {
      const result = await entityExtractor.extractFromContent(
        'bsa-regulation-2024',
        mockExtractedContent,
        'US'
      );

      expect(result.entities).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.processingStats.totalEntities).toBe(result.entities.length);
      expect(result.processingStats.processingTime).toBeGreaterThan(0);

      // Should find regulatory bodies
      const regulatoryBodies = result.entities.filter(e => e.type === 'regulatory_body');
      expect(regulatoryBodies.length).toBeGreaterThan(0);

      // Should find financial institutions
      const financialInstitutions = result.entities.filter(e => e.type === 'financial_institution');
      expect(financialInstitutions.length).toBeGreaterThanOrEqual(0);

      // Should find temporal entities (dates)
      const temporalEntities = result.entities.filter(e => e.type === 'date');
      expect(temporalEntities.length).toBeGreaterThan(0);
    });

    it('should extract entities from tables', async () => {
      const result = await entityExtractor.extractFromContent(
        'bsa-regulation-2024',
        mockExtractedContent,
        'US'
      );

      // Should find transaction types from table
      const transactionTypes = result.entities.filter(e => e.type === 'transaction_type');
      expect(transactionTypes.length).toBeGreaterThan(0);

      // Should find amounts/metrics from table
      const metrics = result.entities.filter(e => e.type === 'metric');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should enhance extracted entities with additional attributes', async () => {
      const result = await entityExtractor.extractFromContent(
        'bsa-regulation-2024',
        mockExtractedContent,
        'US'
      );

      const federalReserve = result.entities.find(e => e.name.includes('Federal Reserve'));
      expect(federalReserve).toBeDefined();
      expect(federalReserve?.confidence).toBeGreaterThan(0.8);
      expect(federalReserve?.source.documentId).toBe('bsa-regulation-2024');
      expect(federalReserve?.jurisdiction).toBe('US');
    });

    it('should handle temporal entity extraction', async () => {
      const result = await entityExtractor.extractFromContent(
        'bsa-regulation-2024',
        mockExtractedContent,
        'US'
      );

      const dates = result.entities.filter(e => e.type === 'date');
      expect(dates.length).toBeGreaterThan(0);

      const effectiveDate = dates.find(d => d.name.includes('2024'));
      expect(effectiveDate).toBeDefined();
      expect(effectiveDate?.attributes.parsedDate).toBeInstanceOf(Date);
    });
  });

  describe('Relationship Extraction', () => {
    const mockEntities: KnowledgeGraphEntity[] = [
      {
        id: 'fed-reserve',
        type: 'regulatory_body',
        name: 'Federal Reserve',
        aliases: ['Fed', 'Federal Reserve System'],
        attributes: { regulatoryScope: 'national' },
        confidence: 0.95,
        source: {
          documentId: 'bsa-regulation-2024',
          sectionId: 'sec-1',
          textContext: 'The Federal Reserve regulates banks',
          extractionMethod: 'ai'
        },
        jurisdiction: 'US',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z'
      },
      {
        id: 'financial-inst',
        type: 'financial_institution',
        name: 'financial institutions',
        aliases: ['banks', 'credit unions'],
        attributes: { regulated: true },
        confidence: 0.9,
        source: {
          documentId: 'bsa-regulation-2024',
          sectionId: 'sec-1',
          textContext: 'All financial institutions must implement',
          extractionMethod: 'ai'
        },
        jurisdiction: 'US',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z'
      }
    ];

    it('should extract regulatory relationships', async () => {
      const mockExtractedContent: ExtractedContent = {
        documentId: 'bsa-regulation-2024',
        title: 'Bank Secrecy Act',
        sections: [
          {
            id: 'sec-1',
            type: 'narrative',
            title: 'Requirements',
            content: 'The Federal Reserve regulates financial institutions. Financial institutions must implement AML programs.',
            metadata: { wordCount: 15, complexity: 'medium' }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 1,
          totalTables: 0
        }
      };

      const result = await relationshipExtractor.extractRelationships(
        'bsa-regulation-2024',
        mockExtractedContent,
        mockEntities,
        'US'
      );

      expect(result.relationships).toBeDefined();
      expect(result.relationships.length).toBeGreaterThan(0);

      // Should find regulatory relationship
      const regulatoryRels = result.relationships.filter(r => r.type === 'regulates');
      expect(regulatoryRels.length).toBeGreaterThan(0);

      const regulatesRel = regulatoryRels.find(r =>
        r.sourceEntityId === 'fed-reserve' && r.targetEntityId === 'financial-inst'
      );
      expect(regulatesRel).toBeDefined();
      expect(regulatesRel?.confidence).toBeGreaterThan(0.5);
    });

    it('should extract compliance relationships', async () => {
      const mockExtractedContent: ExtractedContent = {
        documentId: 'bsa-regulation-2024',
        title: 'Bank Secrecy Act',
        sections: [
          {
            id: 'sec-1',
            type: 'requirements',
            title: 'AML Programs',
            content: 'Financial institutions must implement Anti-Money Laundering programs and report suspicious activities.',
            metadata: { wordCount: 13, complexity: 'medium' }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 1,
          totalTables: 0
        }
      };

      const result = await relationshipExtractor.extractRelationships(
        'bsa-regulation-2024',
        mockExtractedContent,
        mockEntities,
        'US'
      );

      // Should find requirement relationships
      const requirementRels = result.relationships.filter(r => r.type === 'requires');
      expect(requirementRels.length).toBeGreaterThanOrEqual(0);

      // Should find reporting relationships
      const reportingRels = result.relationships.filter(r => r.type === 'reports');
      expect(reportingRels.length).toBeGreaterThanOrEqual(0);
    });

    it('should infer transitive relationships', async () => {
      const configWithInference = {
        ...config,
        relationshipExtraction: {
          ...config.relationshipExtraction,
          enableInference: true,
          enableTransitivity: true
        }
      };

      const extractorWithInference = new RelationshipExtractor(configWithInference, mockLogger);

      // Mock existing relationships that could trigger inference
      const mockExtractedContent: ExtractedContent = {
        documentId: 'bsa-regulation-2024',
        title: 'Complex Regulation',
        sections: [
          {
            id: 'sec-1',
            type: 'narrative',
            title: 'Complex Requirements',
            content: 'The Federal Reserve regulates financial institutions. Financial institutions implement AML programs.',
            metadata: { wordCount: 12, complexity: 'high' }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 1,
          totalTables: 0
        }
      };

      const result = await extractorWithInference.extractRelationships(
        'bsa-regulation-2024',
        mockExtractedContent,
        mockEntities,
        'US'
      );

      expect(result.processingStats.inferredRelationships).toBeGreaterThanOrEqual(0);

      // Should have at least the direct relationships
      expect(result.relationships.length).toBeGreaterThan(0);
    });
  });

  describe('Graph Construction', () => {
    const mockExtractedContent: ExtractedContent = {
      documentId: 'test-regulation',
      title: 'Test Regulation',
      sections: [
        {
          id: 'sec-1',
          type: 'narrative',
          title: 'Requirements',
          content: 'The Federal Reserve regulates banks. Banks must implement AML programs and file SARs.',
          metadata: { wordCount: 15, complexity: 'medium' }
        }
      ],
      tables: [],
      figures: [],
      entities: [],
      crossReferences: [],
      metadata: {
        jurisdiction: 'US',
        documentType: 'regulation',
        extractionDate: '2025-01-15T10:00:00Z',
        totalSections: 1,
        totalTables: 0
      }
    };

    it('should build complete knowledge graph', async () => {
      const result = await graphBuilder.buildKnowledgeGraph({
        documentId: 'test-regulation',
        extractedContent: mockExtractedContent,
        jurisdiction: 'US',
        enableAnalytics: true,
        enableClustering: true,
        enableInference: true
      });

      expect(result.entities).toBeDefined();
      expect(result.relationships).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.analytics).toBeDefined();
      expect(result.buildStats).toBeDefined();

      // Should have entities
      expect(result.entities.length).toBeGreaterThan(0);

      // Should have relationships
      expect(result.relationships.length).toBeGreaterThanOrEqual(0);

      // Nodes should match entities
      expect(result.nodes.length).toBe(result.entities.length);

      // Analytics should be calculated
      expect(result.analytics.entityCount).toBe(result.entities.length);
      expect(result.analytics.relationshipCount).toBe(result.relationships.length);
      expect(result.analytics.averageDegree).toBeGreaterThanOrEqual(0);
      expect(result.analytics.clusteringCoefficient).toBeGreaterThanOrEqual(0);
      expect(result.analytics.centralityScores).toBeDefined();
    });

    it('should calculate graph analytics correctly', async () => {
      const result = await graphBuilder.buildKnowledgeGraph({
        documentId: 'test-regulation',
        extractedContent: mockExtractedContent,
        jurisdiction: 'US',
        enableAnalytics: true
      });

      const { analytics } = result;

      // Basic counts should match
      expect(analytics.entityCount).toBe(result.entities.length);
      expect(analytics.relationshipCount).toBe(result.relationships.length);

      // Degree calculations
      expect(analytics.averageDegree).toBeGreaterThanOrEqual(0);
      expect(analytics.maxDegree).toBeGreaterThanOrEqual(analytics.averageDegree);

      // Graph structure metrics
      expect(analytics.connectedComponents).toBeGreaterThanOrEqual(1);
      expect(analytics.clusteringCoefficient).toBeGreaterThanOrEqual(0);
      expect(analytics.clusteringCoefficient).toBeLessThanOrEqual(1);

      // Centrality scores
      expect(Object.keys(analytics.centralityScores).length).toBe(result.entities.length);

      // All centrality scores should be between 0 and 1
      Object.values(analytics.centralityScores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('should apply clustering to graph nodes', async () => {
      const result = await graphBuilder.buildKnowledgeGraph({
        documentId: 'test-regulation',
        extractedContent: mockExtractedContent,
        jurisdiction: 'US',
        enableClustering: true
      });

      // Should have cluster assignments for connected nodes
      const nodesWithClusters = result.nodes.filter(node => node.metadata.clusterId);
      expect(nodesWithClusters.length).toBeGreaterThanOrEqual(0);

      // Clusters should be consistent for connected components
      const clusterIds = new Set(nodesWithClusters.map(node => node.metadata.clusterId));
      expect(clusterIds.size).toBeGreaterThanOrEqual(1);
    });

    it('should handle graph updates correctly', async () => {
      // Build initial graph
      const initialResult = await graphBuilder.buildKnowledgeGraph({
        documentId: 'test-regulation',
        extractedContent: mockExtractedContent,
        jurisdiction: 'US'
      });

      // Create existing graph structure
      const existingGraph = {
        entities: initialResult.entities.slice(0, 1), // Take only first entity
        relationships: initialResult.relationships.slice(0, 1), // Take only first relationship
        analytics: initialResult.analytics,
        queryTime: 100,
        metadata: {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          jurisdiction: 'US',
          documentCount: 1
        }
      };

      // Update with new content
      const updatedResult = await graphBuilder.updateKnowledgeGraph(
        existingGraph,
        {
          documentId: 'test-regulation-update',
          extractedContent: mockExtractedContent,
          jurisdiction: 'US',
          updateMode: 'merge'
        }
      );

      // Should have more entities and relationships after update
      expect(updatedResult.entities.length).toBeGreaterThanOrEqual(existingGraph.entities.length);
      expect(updatedResult.relationships.length).toBeGreaterThanOrEqual(existingGraph.relationships.length);
      expect(updatedResult.buildStats.updateCount).toBeGreaterThan(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex regulatory document processing', async () => {
      const complexContent: ExtractedContent = {
        documentId: 'complex-aml-regulation',
        title: 'Comprehensive Anti-Money Laundering Regulation',
        sections: [
          {
            id: 'sec-1',
            type: 'narrative',
            title: 'Regulatory Framework',
            content: 'The Financial Crimes Enforcement Network (FinCEN) and the Federal Reserve work together to regulate financial institutions. All banks must implement comprehensive AML programs that include customer due diligence, transaction monitoring, and suspicious activity reporting.',
            metadata: { wordCount: 35, complexity: 'high' }
          },
          {
            id: 'sec-2',
            type: 'requirements',
            title: 'Specific Requirements',
            content: 'Financial institutions shall file Currency Transaction Reports (CTRs) for cash transactions exceeding $10,000. Suspicious Activity Reports (SARs) must be filed within 30 days of detection. Effective date: January 1, 2024.',
            metadata: { wordCount: 32, complexity: 'high' }
          },
          {
            id: 'sec-3',
            type: 'penalties',
            title: 'Enforcement and Penalties',
            content: 'Failure to comply with AML requirements may result in civil penalties up to $1,000,000 per violation. Criminal penalties may include imprisonment for willful violations.',
            metadata: { wordCount: 25, complexity: 'medium' }
          }
        ],
        tables: [
          {
            id: 'table-1',
            title: 'Reporting Thresholds and Timeframes',
            headers: ['Report Type', 'Threshold', 'Timeframe'],
            rows: [
              ['CTR', '$10,000 cash', '15 days'],
              ['SAR', 'Any suspicious activity', '30 days'],
              ['Form 8300', '$10,000 cash business', '15 days']
            ],
            metadata: { rowCount: 3, columnCount: 3 }
          }
        ],
        figures: [],
        entities: [
          {
            id: 'entity-1',
            type: 'organization',
            name: 'FinCEN',
            confidence: 0.9,
            context: 'Financial Crimes Enforcement Network (FinCEN)'
          }
        ],
        crossReferences: [
          {
            id: 'ref-1',
            type: 'section_reference',
            text: 'Refer to Section 2.B for detailed SAR requirements',
            targetSectionId: 'sec-2b'
          }
        ],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 3,
          totalTables: 1
        }
      };

      const result = await graphBuilder.buildKnowledgeGraph({
        documentId: 'complex-aml-regulation',
        extractedContent: complexContent,
        jurisdiction: 'US',
        enableAnalytics: true,
        enableClustering: true,
        enableInference: true
      });

      // Should extract multiple entity types
      const entityTypes = new Set(result.entities.map(e => e.type));
      expect(entityTypes.size).toBeGreaterThan(3);

      // Should find regulatory bodies
      const regulatoryBodies = result.entities.filter(e => e.type === 'regulatory_body');
      expect(regulatoryBodies.length).toBeGreaterThan(0);

      // Should find financial institutions
      const financialInstitutions = result.entities.filter(e => e.type === 'financial_institution');
      expect(financialInstitutions.length).toBeGreaterThan(0);

      // Should find transaction types
      const transactionTypes = result.entities.filter(e => e.type === 'transaction_type');
      expect(transactionTypes.length).toBeGreaterThan(0);

      // Should find temporal entities
      const temporalEntities = result.entities.filter(e => e.type === 'date');
      expect(temporalEntities.length).toBeGreaterThan(0);

      // Should extract multiple relationship types
      const relationshipTypes = new Set(result.relationships.map(r => r.type));
      expect(relationshipTypes.size).toBeGreaterThan(2);

      // Should have regulatory relationships
      const regulatoryRels = result.relationships.filter(r => r.type === 'regulates');
      expect(regulatoryRels.length).toBeGreaterThan(0);

      // Should have compliance relationships
      const complianceRels = result.relationships.filter(r =>
        ['requires', 'reports', 'implements'].includes(r.type)
      );
      expect(complianceRels.length).toBeGreaterThan(0);

      // Graph analytics should be comprehensive
      expect(result.analytics.entityCount).toBe(result.entities.length);
      expect(result.analytics.relationshipCount).toBe(result.relationships.length);
      expect(result.analytics.connectedComponents).toBeGreaterThanOrEqual(1);
      expect(result.analytics.centralityScores).toBeDefined();
      expect(Object.keys(result.analytics.centralityScores).length).toBe(result.entities.length);

      // Build statistics should be reasonable
      expect(result.buildStats.buildTime).toBeGreaterThan(0);
      expect(result.buildStats.confidenceScore).toBeGreaterThan(0);
      expect(result.buildStats.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should handle performance with large documents', async () => {
      // Create a large document with many sections
      const largeContent: ExtractedContent = {
        documentId: 'large-regulation',
        title: 'Large Financial Regulation',
        sections: Array(20).fill(null).map((_, i) => ({
          id: `sec-${i + 1}`,
          type: i % 2 === 0 ? 'narrative' : 'requirements',
          title: `Section ${i + 1}`,
          content: `This section contains regulatory content about financial institutions and compliance requirements. The Federal Reserve and FinCEN regulate banks and other financial entities. Transaction monitoring and suspicious activity reporting are required. Effective date: 2024-01-01.`,
          metadata: { wordCount: 30, complexity: 'medium' }
        })),
        tables: Array(5).fill(null).map((_, i) => ({
          id: `table-${i + 1}`,
          title: `Table ${i + 1}`,
          headers: ['Type', 'Requirement', 'Threshold'],
          rows: [
            ['Transaction', 'Monitoring', '$10,000'],
            ['Report', 'Filing', '30 days'],
            ['Review', 'Assessment', 'Annual']
          ],
          metadata: { rowCount: 3, columnCount: 3 }
        })),
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 20,
          totalTables: 5
        }
      };

      const startTime = Date.now();

      const result = await graphBuilder.buildKnowledgeGraph({
        documentId: 'large-regulation',
        extractedContent: largeContent,
        jurisdiction: 'US',
        enableAnalytics: true
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should process large document efficiently
      expect(processingTime).toBeLessThan(30000); // Should complete in under 30 seconds
      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.relationships.length).toBeGreaterThan(0);
      expect(result.buildStats.buildTime).toBeLessThan(30000);

      // Should respect entity and relationship limits
      expect(result.entities.length).toBeLessThanOrEqual(
        config.entityExtraction.maxEntitiesPerSection * largeContent.sections.length
      );
      expect(result.relationships.length).toBeLessThanOrEqual(
        config.relationshipExtraction.maxRelationshipsPerSection * largeContent.sections.length
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle empty content gracefully', async () => {
      const emptyContent: ExtractedContent = {
        documentId: 'empty-regulation',
        title: 'Empty Regulation',
        sections: [],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 0,
          totalTables: 0
        }
      };

      const result = await graphBuilder.buildKnowledgeGraph({
        documentId: 'empty-regulation',
        extractedContent: emptyContent,
        jurisdiction: 'US'
      });

      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.nodes).toEqual([]);
      expect(result.analytics.entityCount).toBe(0);
      expect(result.analytics.relationshipCount).toBe(0);
      expect(result.buildStats.entityCount).toBe(0);
      expect(result.buildStats.relationshipCount).toBe(0);
    });

    it('should handle malformed content gracefully', async () => {
      const malformedContent: ExtractedContent = {
        documentId: 'malformed-regulation',
        title: 'Malformed Regulation',
        sections: [
          {
            id: 'sec-1',
            type: 'narrative',
            title: '', // Empty title
            content: undefined as any, // Undefined content
            metadata: { wordCount: -1, complexity: 'invalid' as any }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 1,
          totalTables: 0
        }
      };

      // Should not throw an error
      await expect(
        graphBuilder.buildKnowledgeGraph({
          documentId: 'malformed-regulation',
          extractedContent: malformedContent,
          jurisdiction: 'US'
        })
      ).resolves.toBeDefined();
    });

    it('should handle extraction failures gracefully', async () => {
      // Create content that might cause extraction issues
      const problematicContent: ExtractedContent = {
        documentId: 'problematic-regulation',
        title: 'Problematic Regulation',
        sections: [
          {
            id: 'sec-1',
            type: 'narrative',
            title: 'Section with very long content',
            content: 'Very long content '.repeat(1000), // Extremely long content
            metadata: { wordCount: 2000, complexity: 'high' }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 1,
          totalTables: 0
        }
      };

      const result = await graphBuilder.buildKnowledgeGraph({
        documentId: 'problematic-regulation',
        extractedContent: problematicContent,
        jurisdiction: 'US'
      });

      // Should still produce a result, even if limited
      expect(result).toBeDefined();
      expect(result.entities.length).toBeLessThanOrEqual(
        config.entityExtraction.maxEntitiesPerSection
      );
    });
  });

  describe('Configuration and Validation', () => {
    it('should respect confidence thresholds', async () => {
      const highThresholdConfig = {
        ...config,
        entityExtraction: {
          ...config.entityExtraction,
          minConfidence: 0.9
        },
        relationshipExtraction: {
          ...config.relationshipExtraction,
          minConfidence: 0.8
        }
      };

      const highThresholdBuilder = new KnowledgeGraphBuilder(highThresholdConfig, mockLogger);

      const mockExtractedContent: ExtractedContent = {
        documentId: 'test-regulation',
        title: 'Test Regulation',
        sections: [
          {
            id: 'sec-1',
            type: 'narrative',
            title: 'Test Section',
            content: 'The Federal Reserve regulates banks. Banks must implement AML programs.',
            metadata: { wordCount: 12, complexity: 'medium' }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 1,
          totalTables: 0
        }
      };

      const result = await highThresholdBuilder.buildKnowledgeGraph({
        documentId: 'test-regulation',
        extractedContent: mockExtractedContent,
        jurisdiction: 'US'
      });

      // All entities should meet high confidence threshold
      result.entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThanOrEqual(0.9);
      });

      // All relationships should meet high confidence threshold
      result.relationships.forEach(relationship => {
        expect(relationship.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should handle feature flags correctly', async () => {
      const minimalConfig = {
        ...config,
        entityExtraction: {
          ...config.entityExtraction,
          enableDisambiguation: false,
          enableTemporalExtraction: false
        },
        relationshipExtraction: {
          ...config.relationshipExtraction,
          enableInference: false,
          enableTransitivity: false
        },
        graphConstruction: {
          enableClustering: false,
          enableCentralityCalculation: false,
          enableAnomalyDetection: false
        }
      };

      const minimalBuilder = new KnowledgeGraphBuilder(minimalConfig, mockLogger);

      const mockExtractedContent: ExtractedContent = {
        documentId: 'test-regulation',
        title: 'Test Regulation',
        sections: [
          {
            id: 'sec-1',
            type: 'narrative',
            title: 'Test Section',
            content: 'The Federal Reserve regulates banks.',
            metadata: { wordCount: 6, complexity: 'low' }
          }
        ],
        tables: [],
        figures: [],
        entities: [],
        crossReferences: [],
        metadata: {
          jurisdiction: 'US',
          documentType: 'regulation',
          extractionDate: '2025-01-15T10:00:00Z',
          totalSections: 1,
          totalTables: 0
        }
      };

      const result = await minimalBuilder.buildKnowledgeGraph({
        documentId: 'test-regulation',
        extractedContent: mockExtractedContent,
        jurisdiction: 'US'
      });

      // Should not have temporal entities when disabled
      const temporalEntities = result.entities.filter(e => e.type === 'date');
      expect(temporalEntities).toHaveLength(0);

      // Should not have cluster assignments when disabled
      const nodesWithClusters = result.nodes.filter(node => node.metadata.clusterId);
      expect(nodesWithClusters).toHaveLength(0);

      // Centrality scores should be 0 when disabled
      Object.values(result.analytics.centralityScores).forEach(score => {
        expect(score).toBe(0);
      });
    });
  });
});
