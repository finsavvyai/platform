/**
 * Knowledge Graph Types and Interfaces
 *
 * Defines the structure for building knowledge graphs from financial regulatory documents
 * including entities, relationships, and graph-based reasoning capabilities.
 */

export interface KnowledgeGraphEntity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  attributes: Record<string, any>;
  confidence: number;
  source: {
    documentId: string;
    sectionId?: string;
    textContext: string;
    extractionMethod: 'ai' | 'regex' | 'rule-based' | 'manual';
  };
  temporalInfo?: {
    validFrom?: string;
    validTo?: string;
    mentionedAt?: string;
  };
  jurisdiction: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  attributes: Record<string, any>;
  confidence: number;
  evidence: RelationshipEvidence[];
  temporalInfo?: {
    validFrom?: string;
    validTo?: string;
  };
  jurisdiction: string;
  createdAt: string;
}

export interface RelationshipEvidence {
  documentId: string;
  sectionId?: string;
  textContext: string;
  confidence: number;
  extractionMethod: 'ai' | 'pattern-matching' | 'dependency-parsing';
}

export interface GraphNode {
  id: string;
  entity: KnowledgeGraphEntity;
  connections: string[]; // Connected entity IDs
  metadata: {
    degree: number; // Number of connections
    centrality: number; // Graph centrality measure
    clusterId?: string; // Community/cluster assignment
    lastAnalyzed: string;
  };
}

export interface GraphPath {
  entities: KnowledgeGraphEntity[];
  relationships: KnowledgeGraphRelationship[];
  path: string[]; // Entity IDs in order
  strength: number; // Path confidence/strength
  length: number;
}

export interface GraphQuery {
  startEntity?: string | KnowledgeGraphEntity;
  endEntity?: string | KnowledgeGraphEntity;
  entityTypes?: EntityType[];
  relationshipTypes?: RelationshipType[];
  maxDepth?: number;
  maxResults?: number;
  filters?: {
    jurisdiction?: string;
    validAt?: string;
    minConfidence?: number;
    attributes?: Record<string, any>;
  };
}

export interface KnowledgeGraphConfig {
  entityExtraction: {
    minConfidence: number;
    maxEntitiesPerSection: number;
    enableDisambiguation: boolean;
    enableTemporalExtraction: boolean;
  };
  relationshipExtraction: {
    minConfidence: number;
    maxRelationshipsPerSection: number;
    enableInference: boolean;
    enableTransitivity: boolean;
  };
  graphConstruction: {
    enableClustering: boolean;
    enableCentralityCalculation: boolean;
    enablePathFinding: boolean;
    enableAnomalyDetection: boolean;
  };
  storage: {
    batchSize: number;
    compressionEnabled: boolean;
    indexingEnabled: boolean;
  };
}

export type EntityType =
  // Financial Entities
  | 'financial_institution'
  | 'regulatory_body'
  | 'compliance_program'
  | 'risk_assessment'
  | 'transaction_type'
  | 'account_type'

  // Legal Entities
  | 'regulation'
  | 'law'
  | 'statute'
  | 'directive'
  | 'guideline'
  | 'standard'
  | 'requirement'

  // Risk & Compliance
  | 'risk_factor'
  | 'threat_actor'
  | 'vulnerability'
  | 'control_measure'
  | 'mitigation_strategy'

  // Geographic & Jurisdictional
  | 'country'
  | 'region'
  | 'jurisdiction'
  | 'supervisory_authority'

  // Business Entities
  | 'customer'
  | 'beneficial_owner'
  | 'legal_entity'
  | 'business_activity'
  | 'industry_sector'

  // Technical Entities
  | 'system'
  | 'technology'
  | 'protocol'
  | 'data_element'
  | 'api_endpoint'

  // Temporal Entities
  | 'time_period'
  | 'date'
  | 'deadline'
  | 'effective_date'

  // Generic
  | 'person'
  | 'organization'
  | 'location'
  | 'concept'
  | 'metric';

export type RelationshipType =
  // Regulatory Relationships
  | 'regulates'
  | 'requires'
  | 'prohibits'
  | 'mandates'
  | 'exempts'
  | 'authorizes'
  | 'supersedes'
  | 'amends'

  // Compliance Relationships
  | 'implements'
  | 'violates'
  | 'addresses'
  | 'mitigates'
  | 'controls'
  | 'monitors'
  | 'reports'
  | 'audits'

  // Risk Relationships
  | 'poses_risk_to'
  | 'vulnerable_to'
  | 'exploits'
  | 'protects_against'
  | 'reduces_risk'
  | 'increases_risk'

  // Organizational Relationships
  | 'owns'
  | 'controls'
  | 'reports_to'
  | 'supervises'
  | 'collaborates_with'
  | 'competes_with'

  // Temporal Relationships
  | 'precedes'
  | 'follows'
  | 'overlaps'
  | 'contains'
  | 'valid_during'

  // Geographic Relationships
  | 'located_in'
  | 'operates_in'
  | 'applies_to'
  | 'jurisdiction_of'

  // Technical Relationships
  | 'implements'
  | 'integrates_with'
  | 'depends_on'
  | 'processes'
  | 'stores'
  | 'transmits'

  // Generic Relationships
  | 'related_to'
  | 'is_a'
  | 'has_property'
  | 'belongs_to'
  | 'associated_with';

export interface GraphAnalytics {
  entityCount: number;
  relationshipCount: number;
  averageDegree: number;
  maxDegree: number;
  connectedComponents: number;
  clusteringCoefficient: number;
  centralityScores: Record<string, number>;
  anomalyScores: Record<string, number>;
}

export interface KnowledgeGraphResult {
  entities: KnowledgeGraphEntity[];
  relationships: KnowledgeGraphRelationship[];
  analytics: GraphAnalytics;
  queryTime: number;
  metadata: {
    version: string;
    lastUpdated: string;
    jurisdiction: string;
    documentCount: number;
  };
}

export interface GraphUpdate {
  entityId?: string;
  relationshipId?: string;
  operation: 'create' | 'update' | 'delete';
  data: Partial<KnowledgeGraphEntity | KnowledgeGraphRelationship>;
  timestamp: string;
  source: string;
}

export interface InferenceResult {
  inferredRelationship: KnowledgeGraphRelationship;
  confidence: number;
  reasoning: string;
  supportingEvidence: RelationshipEvidence[];
  timestamp: string;
}

export interface GraphPathResult {
  paths: GraphPath[];
  analytics: {
    totalPaths: number;
    averagePathLength: number;
    strongestPath: GraphPath;
    shortestPath: GraphPath;
  };
  query: GraphQuery;
  executionTime: number;
}
