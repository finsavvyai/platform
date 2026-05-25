/**
 * Knowledge Graph Builder
 *
 * Orchestrates the construction of knowledge graphs from regulatory documents
 * by coordinating entity extraction, relationship extraction, and graph construction.
 */

import {
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  GraphNode,
  GraphAnalytics,
  KnowledgeGraphResult,
  KnowledgeGraphConfig
} from '../types/graph-types';
import { KnowledgeGraphExtractor, EntityExtractionResult } from './entity-extractor';
import { RelationshipExtractor, RelationshipExtractionResult } from './relationship-extractor';
import type { ExtractedContent } from '../../extraction/types';

export interface KnowledgeGraphBuildOptions {
  documentId: string;
  extractedContent: ExtractedContent;
  jurisdiction: string;
  enableAnalytics?: boolean;
  enableClustering?: boolean;
  enableInference?: boolean;
  updateMode?: 'create' | 'update' | 'merge';
  existingGraph?: KnowledgeGraphResult;
}

export interface GraphConstructionResult {
  entities: KnowledgeGraphEntity[];
  relationships: KnowledgeGraphRelationship[];
  nodes: GraphNode[];
  analytics: GraphAnalytics;
  buildStats: {
    entityCount: number;
    relationshipCount: number;
    nodeCount: number;
    buildTime: number;
    confidenceScore: number;
    updateCount: number;
  };
}

export class KnowledgeGraphBuilder {
  private config: KnowledgeGraphConfig;
  private entityExtractor: KnowledgeGraphExtractor;
  private relationshipExtractor: RelationshipExtractor;
  private graphIndex: Map<string, GraphNode> = new Map();
  private entityIndex: Map<string, KnowledgeGraphEntity> = new Map();
  private relationshipIndex: Map<string, KnowledgeGraphRelationship> = new Map();

  constructor(config: KnowledgeGraphConfig, logger?: any) {
    this.config = config;
    this.entityExtractor = new KnowledgeGraphExtractor(config, logger);
    this.relationshipExtractor = new RelationshipExtractor(config, logger);
  }

  /**
   * Build knowledge graph from extracted content
   */
  async buildKnowledgeGraph(
    options: KnowledgeGraphBuildOptions
  ): Promise<GraphConstructionResult> {
    const startTime = Date.now();

    // Extract entities
    const entityResult = await this.entityExtractor.extractFromContent(
      options.documentId,
      options.extractedContent,
      options.jurisdiction
    );

    // Extract relationships
    const relationshipResult = await this.relationshipExtractor.extractRelationships(
      options.documentId,
      options.extractedContent,
      entityResult.entities,
      options.jurisdiction
    );

    // Build graph structure
    const nodes = this.buildGraphNodes(entityResult.entities, relationshipResult.relationships);

    // Calculate analytics
    const analytics = await this.calculateGraphAnalytics(nodes, relationshipResult.relationships);

    // Apply clustering if enabled
    if (options.enableClustering || this.config.graphConstruction.enableClustering) {
      await this.applyClustering(nodes, relationshipResult.relationships);
    }

    // Apply centrality calculation if enabled
    if (this.config.graphConstruction.enableCentralityCalculation) {
      await this.calculateCentrality(nodes, relationshipResult.relationships);
    }

    const buildTime = Date.now() - startTime;

    return {
      entities: entityResult.entities,
      relationships: relationshipResult.relationships,
      nodes,
      analytics,
      buildStats: {
        entityCount: entityResult.entities.length,
        relationshipCount: relationshipResult.relationships.length,
        nodeCount: nodes.length,
        buildTime,
        confidenceScore: (entityResult.confidence + relationshipResult.confidence) / 2,
        updateCount: this.calculateUpdateCount(options)
      }
    };
  }

  /**
   * Update existing knowledge graph with new content
   */
  async updateKnowledgeGraph(
    existingGraph: KnowledgeGraphResult,
    newOptions: KnowledgeGraphBuildOptions
  ): Promise<GraphConstructionResult> {
    // Set update mode and existing graph for merging
    newOptions.updateMode = 'merge';
    newOptions.existingGraph = existingGraph;

    // Build new graph portion
    const newResult = await this.buildKnowledgeGraph(newOptions);

    // Merge with existing graph
    const mergedResult = await this.mergeGraphs(existingGraph, newResult);

    return mergedResult;
  }

  /**
   * Build graph nodes from entities and relationships
   */
  private buildGraphNodes(
    entities: KnowledgeGraphEntity[],
    relationships: KnowledgeGraphRelationship[]
  ): GraphNode[] {
    const nodes: GraphNode[] = [];

    // Update indexes
    for (const entity of entities) {
      this.entityIndex.set(entity.id, entity);
    }

    for (const relationship of relationships) {
      this.relationshipIndex.set(relationship.id, relationship);
    }

    // Create nodes
    for (const entity of entities) {
      const connections = this.findConnections(entity.id, relationships);

      const node: GraphNode = {
        id: entity.id,
        entity,
        connections,
        metadata: {
          degree: connections.length,
          centrality: 0, // Will be calculated later
          lastAnalyzed: new Date().toISOString()
        }
      };

      nodes.push(node);
      this.graphIndex.set(entity.id, node);
    }

    return nodes;
  }

  /**
   * Find all connections for an entity
   */
  private findConnections(
    entityId: string,
    relationships: KnowledgeGraphRelationship[]
  ): string[] {
    const connections: string[] = [];

    for (const rel of relationships) {
      if (rel.sourceEntityId === entityId) {
        connections.push(rel.targetEntityId);
      } else if (rel.targetEntityId === entityId) {
        connections.push(rel.sourceEntityId);
      }
    }

    return [...new Set(connections)]; // Remove duplicates
  }

  /**
   * Calculate comprehensive graph analytics
   */
  private async calculateGraphAnalytics(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Promise<GraphAnalytics> {
    const entityCount = nodes.length;
    const relationshipCount = relationships.length;

    // Calculate degrees
    const degrees = nodes.map(node => node.connections.length);
    const averageDegree = degrees.length > 0
      ? degrees.reduce((sum, deg) => sum + deg, 0) / degrees.length
      : 0;
    const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0;

    // Calculate connected components
    const connectedComponents = this.calculateConnectedComponents(nodes);

    // Calculate clustering coefficient
    const clusteringCoefficient = this.calculateClusteringCoefficient(nodes, relationships);

    // Calculate centrality scores
    const centralityScores = await this.calculateCentralityScores(nodes, relationships);

    // Calculate anomaly scores if enabled
    let anomalyScores: Record<string, number> = {};
    if (this.config.graphConstruction.enableAnomalyDetection) {
      anomalyScores = await this.detectAnomalies(nodes, relationships);
    }

    return {
      entityCount,
      relationshipCount,
      averageDegree,
      maxDegree,
      connectedComponents,
      clusteringCoefficient,
      centralityScores,
      anomalyScores
    };
  }

  /**
   * Calculate connected components in the graph
   */
  private calculateConnectedComponents(nodes: GraphNode[]): number {
    const visited = new Set<string>();
    let componentCount = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.depthFirstSearch(node.id, visited, nodes);
        componentCount++;
      }
    }

    return componentCount;
  }

  /**
   * Depth-first search for connected components
   */
  private depthFirstSearch(
    nodeId: string,
    visited: Set<string>,
    nodes: GraphNode[]
  ): void {
    visited.add(nodeId);
    const node = nodes.find(n => n.id === nodeId);

    if (node) {
      for (const connectedId of node.connections) {
        if (!visited.has(connectedId)) {
          this.depthFirstSearch(connectedId, visited, nodes);
        }
      }
    }
  }

  /**
   * Calculate clustering coefficient
   */
  private calculateClusteringCoefficient(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): number {
    let totalClustering = 0;
    let nodeCount = 0;

    for (const node of nodes) {
      if (node.connections.length >= 2) {
        const neighbors = node.connections;
        let edgesBetweenNeighbors = 0;

        // Count edges between neighbors
        for (let i = 0; i < neighbors.length; i++) {
          for (let j = i + 1; j < neighbors.length; j++) {
            const hasEdge = relationships.some(rel =>
              (rel.sourceEntityId === neighbors[i] && rel.targetEntityId === neighbors[j]) ||
              (rel.sourceEntityId === neighbors[j] && rel.targetEntityId === neighbors[i])
            );
            if (hasEdge) edgesBetweenNeighbors++;
          }
        }

        const possibleEdges = (neighbors.length * (neighbors.length - 1)) / 2;
        const clusteringCoefficient = possibleEdges > 0 ? edgesBetweenNeighbors / possibleEdges : 0;

        totalClustering += clusteringCoefficient;
        nodeCount++;
      }
    }

    return nodeCount > 0 ? totalClustering / nodeCount : 0;
  }

  /**
   * Calculate centrality scores (simplified PageRank)
   */
  private async calculateCentralityScores(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Promise<Record<string, number>> {
    const centralityScores: Record<string, number> = {};
    const dampingFactor = 0.85;
    const maxIterations = 100;
    const tolerance = 1e-6;

    // Initialize centrality scores
    for (const node of nodes) {
      centralityScores[node.id] = 1.0;
    }

    // Build adjacency list
    const adjacencyList: Record<string, string[]> = {};
    for (const rel of relationships) {
      if (!adjacencyList[rel.sourceEntityId]) {
        adjacencyList[rel.sourceEntityId] = [];
      }
      adjacencyList[rel.sourceEntityId].push(rel.targetEntityId);
    }

    // Iterative PageRank calculation
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const newScores: Record<string, number> = {};

      for (const node of nodes) {
        let score = (1 - dampingFactor);

        if (adjacencyList[node.id]) {
          for (const neighborId of adjacencyList[node.id]) {
            const neighborNode = nodes.find(n => n.id === neighborId);
            if (neighborNode && neighborNode.connections.length > 0) {
              score += dampingFactor * (centralityScores[neighborId] / neighborNode.connections.length);
            }
          }
        }

        newScores[node.id] = score;
      }

      // Check convergence
      let maxChange = 0;
      for (const node of nodes) {
        const change = Math.abs(newScores[node.id] - centralityScores[node.id]);
        maxChange = Math.max(maxChange, change);
        centralityScores[node.id] = newScores[node.id];
      }

      if (maxChange < tolerance) break;
    }

    // Normalize scores
    const maxScore = Math.max(...Object.values(centralityScores));
    if (maxScore > 0) {
      for (const nodeId in centralityScores) {
        centralityScores[nodeId] /= maxScore;
      }
    }

    return centralityScores;
  }

  /**
   * Apply graph clustering (simplified community detection)
   */
  private async applyClustering(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Promise<void> {
    // Simple clustering based on connectivity
    let clusterId = 0;
    const visited = new Set<string>();

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.assignCluster(node.id, clusterId, visited, nodes, relationships);
        clusterId++;
      }
    }
  }

  /**
   * Assign cluster ID to connected component
   */
  private assignCluster(
    nodeId: string,
    clusterId: string,
    visited: Set<string>,
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): void {
    visited.add(nodeId);
    const node = nodes.find(n => n.id === nodeId);

    if (node) {
      node.metadata.clusterId = clusterId;

      for (const connectedId of node.connections) {
        if (!visited.has(connectedId)) {
          this.assignCluster(connectedId, clusterId, visited, nodes, relationships);
        }
      }
    }
  }

  /**
   * Calculate centrality for each node
   */
  private async calculateCentrality(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Promise<void> {
    const centralityScores = await this.calculateCentralityScores(nodes, relationships);

    for (const node of nodes) {
      node.metadata.centrality = centralityScores[node.id] || 0;
    }
  }

  /**
   * Detect anomalies in the graph
   */
  private async detectAnomalies(
    nodes: GraphNode[],
    relationships: KnowledgeGraphRelationship[]
  ): Promise<Record<string, number>> {
    const anomalyScores: Record<string, number> = {};

    // Calculate degree distribution statistics
    const degrees = nodes.map(node => node.connections.length);
    const meanDegree = degrees.reduce((sum, deg) => sum + deg, 0) / degrees.length;
    const degreeVariance = degrees.reduce((sum, deg) => sum + Math.pow(deg - meanDegree, 2), 0) / degrees.length;
    const degreeStdDev = Math.sqrt(degreeVariance);

    // Calculate anomaly scores based on degree deviation
    for (const node of nodes) {
      const degreeDeviation = Math.abs(node.connections.length - meanDegree);
      const zScore = degreeStdDev > 0 ? degreeDeviation / degreeStdDev : 0;
      anomalyScores[node.id] = Math.min(1.0, zScore / 3); // Cap at 1.0
    }

    return anomalyScores;
  }

  /**
   * Merge two graphs together
   */
  private async mergeGraphs(
    existingGraph: KnowledgeGraphResult,
    newGraph: GraphConstructionResult
  ): Promise<GraphConstructionResult> {
    // Merge entities (deduplicate)
    const mergedEntities = new Map<string, KnowledgeGraphEntity>();

    // Add existing entities
    for (const entity of existingGraph.entities) {
      mergedEntities.set(entity.id, entity);
    }

    // Add or update with new entities
    for (const entity of newGraph.entities) {
      if (mergedEntities.has(entity.id)) {
        // Update existing entity
        const existing = mergedEntities.get(entity.id)!;
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        existing.aliases.push(...entity.aliases);
        existing.updatedAt = new Date().toISOString();
      } else {
        mergedEntities.set(entity.id, entity);
      }
    }

    // Merge relationships
    const mergedRelationships = new Map<string, KnowledgeGraphRelationship>();

    // Add existing relationships
    for (const rel of existingGraph.relationships) {
      mergedRelationships.set(rel.id, rel);
    }

    // Add or update with new relationships
    for (const rel of newGraph.relationships) {
      if (mergedRelationships.has(rel.id)) {
        // Update existing relationship
        const existing = mergedRelationships.get(rel.id)!;
        existing.confidence = Math.max(existing.confidence, rel.confidence);
        existing.evidence.push(...rel.evidence);
      } else {
        mergedRelationships.set(rel.id, rel);
      }
    }

    // Rebuild graph structure
    const mergedEntitiesArray = Array.from(mergedEntities.values());
    const mergedRelationshipsArray = Array.from(mergedRelationships.values());
    const mergedNodes = this.buildGraphNodes(mergedEntitiesArray, mergedRelationshipsArray);

    // Recalculate analytics
    const mergedAnalytics = await this.calculateGraphAnalytics(mergedNodes, mergedRelationshipsArray);

    return {
      entities: mergedEntitiesArray,
      relationships: mergedRelationshipsArray,
      nodes: mergedNodes,
      analytics: mergedAnalytics,
      buildStats: {
        entityCount: mergedEntitiesArray.length,
        relationshipCount: mergedRelationshipsArray.length,
        nodeCount: mergedNodes.length,
        buildTime: newGraph.buildStats.buildTime,
        confidenceScore: (existingGraph.analytics.entityCount > 0
          ? (existingGraph.analytics.entityCount / (existingGraph.analytics.entityCount + newGraph.buildStats.entityCount)))
          : newGraph.buildStats.confidenceScore,
        updateCount: newGraph.buildStats.entityCount + newGraph.buildStats.relationshipCount
      }
    };
  }

  /**
   * Calculate update count
   */
  private calculateUpdateCount(options: KnowledgeGraphBuildOptions): number {
    if (options.updateMode === 'create') {
      return 0;
    }

    // For update modes, this would be calculated based on actual changes
    return 0;
  }

  /**
   * Get graph construction statistics
   */
  getConstructionStats(): {
    indexedNodes: number;
    indexedEntities: number;
    indexedRelationships: number;
    config: KnowledgeGraphConfig;
  } {
    return {
      indexedNodes: this.graphIndex.size,
      indexedEntities: this.entityIndex.size,
      indexedRelationships: this.relationshipIndex.size,
      config: this.config
    };
  }

  /**
   * Clear all indexes (for memory management)
   */
  clearIndexes(): void {
    this.graphIndex.clear();
    this.entityIndex.clear();
    this.relationshipIndex.clear();
  }

  /**
   * Export graph for persistence
   */
  exportGraph(): KnowledgeGraphResult {
    const nodes = Array.from(this.graphIndex.values());
    const entities = Array.from(this.entityIndex.values());
    const relationships = Array.from(this.relationshipIndex.values());

    // Calculate final analytics
    const analytics = {
      entityCount: entities.length,
      relationshipCount: relationships.length,
      averageDegree: nodes.length > 0
        ? nodes.reduce((sum, node) => sum + node.metadata.degree, 0) / nodes.length
        : 0,
      maxDegree: nodes.length > 0
        ? Math.max(...nodes.map(node => node.metadata.degree))
        : 0,
      connectedComponents: this.calculateConnectedComponents(nodes),
      clusteringCoefficient: this.calculateClusteringCoefficient(nodes, relationships),
      centralityScores: Object.fromEntries(
        nodes.map(node => [node.id, node.metadata.centrality])
      ),
      anomalyScores: {} // Would need to recalculate
    };

    return {
      entities,
      relationships,
      analytics,
      queryTime: 0, // Not applicable for export
      metadata: {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        jurisdiction: 'GLOBAL', // Would track actual jurisdictions
        documentCount: new Set(entities.map(e => e.source.documentId)).size
      }
    };
  }
}
