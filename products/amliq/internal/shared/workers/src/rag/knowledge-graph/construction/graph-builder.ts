/**
 * Knowledge Graph Builder
 *
 * Orchestrates the construction of knowledge graphs from regulatory documents
 * by combining entity extraction, relationship extraction, and graph analytics.
 */

import {
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  GraphNode,
  GraphAnalytics,
  KnowledgeGraphResult,
  KnowledgeGraphConfig,
  GraphUpdate,
  InferenceResult
} from '../types/graph-types';
import { KnowledgeGraphExtractor, EntityExtractionResult } from './entity-extractor';
import { RelationshipExtractor, RelationshipExtractionResult } from './relationship-extractor';
import type { ExtractedContent } from '../../extraction/types';

export interface KnowledgeGraphBuilderConfig {
  extraction: KnowledgeGraphConfig;
  analytics: {
    enableCentralityCalculation: boolean;
    enableClustering: boolean;
    enableAnomalyDetection: boolean;
    centralityAlgorithm: 'betweenness' | 'closeness' | 'eigenvector' | 'pagerank';
  };
  storage: {
    enableCaching: boolean;
    enableVersioning: boolean;
    compressionEnabled: boolean;
  };
}

export interface GraphConstructionResult {
  result: KnowledgeGraphResult;
  updates: GraphUpdate[];
  inferences: InferenceResult[];
  performance: {
    entityExtractionTime: number;
    relationshipExtractionTime: number;
    analyticsTime: number;
    totalTime: number;
    memoryUsage: number;
  };
}

export class KnowledgeGraphBuilder {
  private config: KnowledgeGraphBuilderConfig;
  private entityExtractor: KnowledgeGraphExtractor;
  private relationshipExtractor: RelationshipExtractor;
  private graphCache: Map<string, GraphNode> = new Map();
  private updateHistory: GraphUpdate[] = [];

  constructor(config: KnowledgeGraphBuilderConfig, logger?: any) {
    this.config = config;
    this.entityExtractor = new KnowledgeGraphExtractor(config.extraction, logger);
    this.relationshipExtractor = new RelationshipExtractor(config.extraction, logger);
  }

  /**
   * Build knowledge graph from extracted content
   */
  async buildKnowledgeGraph(
    documentId: string,
    extractedContent: ExtractedContent,
    jurisdiction: string,
    existingGraph?: KnowledgeGraphResult
  ): Promise<GraphConstructionResult> {
    const startTime = Date.now();
    const performance = {
      entityExtractionTime: 0,
      relationshipExtractionTime: 0,
      analyticsTime: 0,
      totalTime: 0,
      memoryUsage: 0
    };

    // Step 1: Extract entities
    const entityStartTime = Date.now();
    const entityResult = await this.entityExtractor.extractFromContent(
      documentId,
      extractedContent,
      jurisdiction
    );
    performance.entityExtractionTime = Date.now() - entityStartTime;

    // Step 2: Extract relationships
    const relationshipStartTime = Date.now();
    const relationshipResult = await this.relationshipExtractor.extractRelationships(
      documentId,
      extractedContent,
      entityResult.entities,
      jurisdiction
    );
    performance.relationshipExtractionTime = Date.now() - relationshipStartTime;

    // Step 3: Build graph structure
    const graphNodes = this.buildGraphNodes(entityResult.entities, existingGraph);

    // Step 4: Calculate analytics
    const analyticsStartTime = Date.now();
    const analytics = await this.calculateGraphAnalytics(
      graphNodes,
      relationshipResult.relationships
    );
    performance.analyticsTime = Date.now() - analyticsStartTime;

    // Step 5: Generate updates
    const updates = this.generateUpdates(
      entityResult.entities,
      relationshipResult.relationships,
      existingGraph
    );

    // Step 6: Run inference engine
    const inferences = await this.runInferenceEngine(
      entityResult.entities,
      relationshipResult.relationships,
      graphNodes
    );

    // Step 7: Assemble final result
    const result: KnowledgeGraphResult = {
      entities: entityResult.entities,
      relationships: relationshipResult.relationships,
      analytics,
      queryTime: Date.now() - startTime,
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        jurisdiction,
        documentCount: 1 + (existingGraph?.metadata.documentCount || 0)
      }
    };

    performance.totalTime = Date.now() - startTime;
    performance.memoryUsage = this.estimateMemoryUsage(result);

    return {
      result,
      updates,
      inferences,
      performance
    };
  }

  /**
   * Build graph nodes from entities
   */
  private buildGraphNodes(
    entities: KnowledgeGraphEntity[],
    existingGraph?: KnowledgeGraphResult
  ): GraphNode[] {
    const nodes: GraphNode[] = [];
    const nodeMap = new Map<string, GraphNode>();

    // Create nodes for new entities
    for (const entity of entities) {
      const existingNode = existingGraph?.entities.find(e => e.id === entity.id);

      const node: GraphNode = {
        id: entity.id,
        entity,
        connections: [], // Will be populated when processing relationships
        metadata: {
          degree: 0,
          centrality: existingNode ? 0 : Math.random(), // Placeholder for now
          lastAnalyzed: new Date().toISOString()
        }
      };

      nodeMap.set(entity.id, node);
      nodes.push(node);
    }

    // Add existing nodes if merging with existing graph
    if (existingGraph) {
      for (const entity of existingGraph.entities) {
        if (!nodeMap.has(entity.id)) {
          const node: GraphNode = {
            id: entity.id,
            entity,
            connections: [],
            metadata: {
              degree: 0,
              centrality: 0,
              lastAnalyzed: new Date().toISOString()
            }
          };
          nodeMap.set(entity.id, node);
          nodes.push(node);
        }
      }
    }

    return nodes;
  }

  /**
   * Calculate graph analytics
   */
  private async calculateGraphAnalytics(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Promise<GraphAnalytics> {
    const analytics: GraphAnalytics = {
      entityCount: nodes.length,
      relationshipCount: relationships.length,
      averageDegree: 0,
      maxDegree: 0,
      connectedComponents: 1,
      clusteringCoefficient: 0,
      centralityScores: {},
      anomalyScores: {}
    };

    if (nodes.length === 0) {
      return analytics;
    }

    // Build adjacency list
    const adjacencyList = this.buildAdjacencyList(nodes, relationships);

    // Calculate degrees
    const degrees = nodes.map(node => adjacencyList.get(node.id)?.size || 0);
    analytics.averageDegree = degrees.reduce((sum, deg) => sum + deg, 0) / degrees.length;
    analytics.maxDegree = Math.max(...degrees);

    // Calculate centrality scores if enabled
    if (this.config.analytics.enableCentralityCalculation) {
      analytics.centralityScores = await this.calculateCentrality(
        adjacencyList,
        nodes.map(n => n.id)
      );
    }

    // Calculate clustering coefficient
    if (this.config.analytics.enableClustering) {
      analytics.clusteringCoefficient = this.calculateClusteringCoefficient(
        adjacencyList,
        nodes.map(n => n.id)
      );
    }

    // Detect anomalies if enabled
    if (this.config.analytics.enableAnomalyDetection) {
      analytics.anomalyScores = this.detectAnomalies(nodes, relationships);
    }

    return analytics;
  }

  /**
   * Build adjacency list for graph operations
   */
  private buildAdjacencyList(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Map<string, Set<string>> {
    const adjacencyList = new Map<string, Set<string>>();

    // Initialize all nodes
    for (const node of nodes) {
      adjacencyList.set(node.id, new Set());
    }

    // Add relationships (undirected for analytics)
    for (const rel of relationships) {
      if (adjacencyList.has(rel.sourceEntityId)) {
        adjacencyList.get(rel.sourceEntityId)!.add(rel.targetEntityId);
      }
      if (adjacencyList.has(rel.targetEntityId)) {
        adjacencyList.get(rel.targetEntityId)!.add(rel.sourceEntityId);
      }
    }

    return adjacencyList;
  }

  /**
   * Calculate centrality scores
   */
  private async calculateCentrality(
    adjacencyList: Map<string, Set<string>>,
    nodeIds: string[]
  ): Promise<Record<string, number>> {
    const centralityScores: Record<string, number> = {};

    switch (this.config.analytics.centralityAlgorithm) {
      case 'betweenness':
        centralityScores = this.calculateBetweennessCentrality(adjacencyList, nodeIds);
        break;
      case 'closeness':
        centralityScores = this.calculateClosenessCentrality(adjacencyList, nodeIds);
        break;
      case 'eigenvector':
        centralityScores = this.calculateEigenvectorCentrality(adjacencyList, nodeIds);
        break;
      case 'pagerank':
        centralityScores = this.calculatePageRank(adjacencyList, nodeIds);
        break;
      default:
        centralityScores = this.calculateDegreeCentrality(adjacencyList, nodeIds);
    }

    return centralityScores;
  }

  /**
   * Calculate degree centrality
   */
  private calculateDegreeCentrality(
    adjacencyList: Map<string, Set<string>>,
    nodeIds: string[]
  ): Record<string, number> {
    const centrality: Record<string, number> = {};
    const maxDegree = Math.max(
      ...Array.from(adjacencyList.values()).map(neighbors => neighbors.size)
    );

    for (const nodeId of nodeIds) {
      const degree = adjacencyList.get(nodeId)?.size || 0;
      centrality[nodeId] = maxDegree > 0 ? degree / maxDegree : 0;
    }

    return centrality;
  }

  /**
   * Calculate PageRank centrality
   */
  private calculatePageRank(
    adjacencyList: Map<string, Set<string>>,
    nodeIds: string[],
    dampingFactor: number = 0.85,
    iterations: number = 20
  ): Record<string, number> {
    const n = nodeIds.length;
    const pageRank: Record<string, number> = {};

    // Initialize equal PageRank for all nodes
    for (const nodeId of nodeIds) {
      pageRank[nodeId] = 1 / n;
    }

    // Iterative calculation
    for (let i = 0; i < iterations; i++) {
      const newPageRank: Record<string, number> = {};

      for (const nodeId of nodeIds) {
        let rank = (1 - dampingFactor) / n;

        // Add contributions from incoming links
        for (const [sourceId, neighbors] of adjacencyList.entries()) {
          if (neighbors.has(nodeId)) {
            const outDegree = neighbors.size;
            if (outDegree > 0) {
              rank += dampingFactor * pageRank[sourceId] / outDegree;
            }
          }
        }

        newPageRank[nodeId] = rank;
      }

      Object.assign(pageRank, newPageRank);
    }

    return pageRank;
  }

  /**
   * Calculate betweenness centrality (simplified)
   */
  private calculateBetweennessCentrality(
    adjacencyList: Map<string, Set<string>>,
    nodeIds: string[]
  ): Record<string, number> {
    const centrality: Record<string, number> = {};

    // Initialize centrality scores
    for (const nodeId of nodeIds) {
      centrality[nodeId] = 0;
    }

    // For each pair of nodes, find shortest paths
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const sourceId = nodeIds[i];
        const targetId = nodeIds[j];

        const paths = this.findShortestPaths(adjacencyList, sourceId, targetId);

        // Update centrality for nodes on shortest paths
        for (const path of paths) {
          for (let k = 1; k < path.length - 1; k++) {
            centrality[path[k]] += 1 / paths.length;
          }
        }
      }
    }

    return centrality;
  }

  /**
   * Calculate closeness centrality
   */
  private calculateClosenessCentrality(
    adjacencyList: Map<string, Set<string>>,
    nodeIds: string[]
  ): Record<string, number> {
    const centrality: Record<string, number> = {};

    for (const nodeId of nodeIds) {
      let totalDistance = 0;
      let reachableNodes = 0;

      for (const otherId of nodeIds) {
        if (nodeId !== otherId) {
          const distance = this.calculateShortestDistance(adjacencyList, nodeId, otherId);
          if (distance !== Infinity) {
            totalDistance += distance;
            reachableNodes++;
          }
        }
      }

      const nMinus1 = nodeIds.length - 1;
      centrality[nodeId] = reachableNodes > 0 ? reachableNodes / totalDistance : 0;
    }

    return centrality;
  }

  /**
   * Calculate eigenvector centrality (simplified power iteration)
   */
  private calculateEigenvectorCentrality(
    adjacencyList: Map<string, Set<string>>,
    nodeIds: string[],
    iterations: number = 20
  ): Record<string, number> {
    const centrality: Record<string, number> = {};

    // Initialize equal scores
    for (const nodeId of nodeIds) {
      centrality[nodeId] = 1;
    }

    // Power iteration
    for (let i = 0; i < iterations; i++) {
      const newCentrality: Record<string, number> = {};

      for (const nodeId of nodeIds) {
        let sum = 0;
        const neighbors = adjacencyList.get(nodeId) || new Set();

        for (const neighborId of neighbors) {
          sum += centrality[neighborId];
        }

        newCentrality[nodeId] = sum;
      }

      // Normalize
      const norm = Math.sqrt(Object.values(newCentrality).reduce((sum, val) => sum + val * val, 0));
      if (norm > 0) {
        for (const nodeId of nodeIds) {
          newCentrality[nodeId] /= norm;
        }
      }

      Object.assign(centrality, newCentrality);
    }

    return centrality;
  }

  /**
   * Calculate clustering coefficient
   */
  private calculateClusteringCoefficient(
    adjacencyList: Map<string, Set<string>>,
    nodeIds: string[]
  ): number {
    let totalClustering = 0;
    let validNodes = 0;

    for (const nodeId of nodeIds) {
      const neighbors = adjacencyList.get(nodeId) || new Set();

      if (neighbors.size < 2) {
        continue;
      }

      // Count edges between neighbors
      let neighborEdges = 0;
      const neighborArray = Array.from(neighbors);

      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          if (adjacencyList.get(neighborArray[i])?.has(neighborArray[j])) {
            neighborEdges++;
          }
        }
      }

      // Calculate clustering coefficient for this node
      const possibleEdges = (neighbors.size * (neighbors.size - 1)) / 2;
      const nodeClustering = neighborEdges / possibleEdges;

      totalClustering += nodeClustering;
      validNodes++;
    }

    return validNodes > 0 ? totalClustering / validNodes : 0;
  }

  /**
   * Detect anomalies in the graph
   */
  private detectAnomalies(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Record<string, number> {
    const anomalyScores: Record<string, number> = {};

    // Simple anomaly detection based on degree distribution
    const degrees = nodes.map(node =>
      relationships.filter(r => r.sourceEntityId === node.id || r.targetEntityId === node.id).length
    );

    const meanDegree = degrees.reduce((sum, deg) => sum + deg, 0) / degrees.length;
    const stdDev = Math.sqrt(
      degrees.reduce((sum, deg) => sum + Math.pow(deg - meanDegree, 2), 0) / degrees.length
    );

    for (let i = 0; i < nodes.length; i++) {
      const degree = degrees[i];
      const zScore = stdDev > 0 ? Math.abs(degree - meanDegree) / stdDev : 0;
      anomalyScores[nodes[i].id] = zScore;
    }

    return anomalyScores;
  }

  /**
   * Generate updates for incremental graph building
   */
  private generateUpdates(
    entities: KnowledgeGraphEntity[],
    relationships: KnowledgeGraphRelationship[],
    existingGraph?: KnowledgeGraphResult
  ): GraphUpdate[] {
    const updates: GraphUpdate[] = [];
    const timestamp = new Date().toISOString();

    if (!existingGraph) {
      // All entities and relationships are new
      for (const entity of entities) {
        updates.push({
          entityId: entity.id,
          operation: 'create',
          data: entity,
          timestamp,
          source: 'document_ingestion'
        });
      }

      for (const relationship of relationships) {
        updates.push({
          relationshipId: relationship.id,
          operation: 'create',
          data: relationship,
          timestamp,
          source: 'document_ingestion'
        });
      }
    } else {
      // Compare with existing graph
      const existingEntityIds = new Set(existingGraph.entities.map(e => e.id));
      const existingRelationshipIds = new Set(existingGraph.relationships.map(r => r.id));

      // Find new entities
      for (const entity of entities) {
        if (!existingEntityIds.has(entity.id)) {
          updates.push({
            entityId: entity.id,
            operation: 'create',
            data: entity,
            timestamp,
            source: 'document_ingestion'
          });
        }
      }

      // Find new relationships
      for (const relationship of relationships) {
        if (!existingRelationshipIds.has(relationship.id)) {
          updates.push({
            relationshipId: relationship.id,
            operation: 'create',
            data: relationship,
            timestamp,
            source: 'document_ingestion'
          });
        }
      }
    }

    return updates;
  }

  /**
   * Run inference engine for additional insights
   */
  private async runInferenceEngine(
    entities: KnowledgeGraphEntity[],
    relationships: KnowledgeGraphRelationship[],
    nodes: GraphNode[]
  ): Promise<InferenceResult[]> {
    const inferences: InferenceResult[] = [];

    // Find high-centrality entities that might be important regulators
    const highCentralityEntities = nodes
      .filter(node => node.metadata.centrality > 0.7)
      .map(node => node.entity);

    for (const entity of highCentralityEntities) {
      if (entity.type === 'regulatory_body' || entity.type === 'organization') {
        // Infer that this entity has broad influence
        const inference: InferenceResult = {
          inferredRelationship: {
            id: this.generateRelationshipId(entity.id, 'financial_system', 'influences'),
            sourceEntityId: entity.id,
            targetEntityId: 'financial_system',
            type: 'influences' as any,
            attributes: {
              inferred: true,
              inferenceType: 'high_centrality_influence',
              centralityScore: nodes.find(n => n.id === entity.id)?.metadata.centrality
            },
            confidence: 0.6,
            evidence: [{
              documentId: entity.source.documentId,
              textContext: entity.source.textContext,
              confidence: 0.6,
              extractionMethod: 'inference'
            }],
            jurisdiction: entity.jurisdiction,
            createdAt: new Date().toISOString()
          },
          confidence: 0.6,
          reasoning: `Entity ${entity.name} has high centrality (${nodes.find(n => n.id === entity.id)?.metadata.centrality}), suggesting broad influence in the regulatory network`,
          supportingEvidence: [{
            documentId: entity.source.documentId,
            textContext: entity.source.textContext,
            confidence: 0.6,
            extractionMethod: 'inference'
          }],
          timestamp: new Date().toISOString()
        };
        inferences.push(inference);
      }
    }

    return inferences;
  }

  /**
   * Find shortest paths between nodes (BFS)
   */
  private findShortestPaths(
    adjacencyList: Map<string, Set<string>>,
    sourceId: string,
    targetId: string
  ): string[][] {
    const queue: { node: string; path: string[] }[] = [{ node: sourceId, path: [sourceId] }];
    const visited = new Set<string>([sourceId]);
    const paths: string[][] = [];

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === targetId) {
        paths.push(path);
        continue;
      }

      const neighbors = adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return paths;
  }

  /**
   * Calculate shortest distance between nodes
   */
  private calculateShortestDistance(
    adjacencyList: Map<string, Set<string>>,
    sourceId: string,
    targetId: string
  ): number {
    const queue: { node: string; distance: number }[] = [{ node: sourceId, distance: 0 }];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const { node, distance } = queue.shift()!;

      if (node === targetId) {
        return distance;
      }

      const neighbors = adjacencyList.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, distance: distance + 1 });
        }
      }
    }

    return Infinity;
  }

  /**
   * Generate unique relationship ID
   */
  private generateRelationshipId(
    sourceId: string,
    targetId: string,
    type: string
  ): string {
    const hash = this.simpleHash(`${sourceId}-${targetId}-${type}`);
    return `${type}-${sourceId.substring(0, 8)}-${targetId.substring(0, 8)}-${hash}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Estimate memory usage of the graph
   */
  private estimateMemoryUsage(result: KnowledgeGraphResult): number {
    // Rough estimation in bytes
    const entitySize = result.entities.length * 1024; // ~1KB per entity
    const relationshipSize = result.relationships.length * 512; // ~512B per relationship
    const analyticsSize = 1024; // ~1KB for analytics
    const metadataSize = 1024; // ~1KB for metadata

    return entitySize + relationshipSize + analyticsSize + metadataSize;
  }

  /**
   * Get builder statistics
   */
  getBuilderStats(): {
    cachedNodes: number;
    updateHistory: number;
    extractionStats: any;
  } {
    return {
      cachedNodes: this.graphCache.size,
      updateHistory: this.updateHistory.length,
      extractionStats: {
        entities: this.entityExtractor.getExtractionStats(),
        relationships: this.relationshipExtractor.getExtractionStats()
      }
    };
  }

  /**
   * Clear cache and reset builder state
   */
  clearCache(): void {
    this.graphCache.clear();
    this.updateHistory = [];
  }
}
