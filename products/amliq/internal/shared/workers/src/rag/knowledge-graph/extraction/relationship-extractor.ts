/**
 * Knowledge Graph Relationship Extractor
 *
 * Identifies and extracts relationships between entities in regulatory documents
 * using AI, dependency parsing, and rule-based approaches.
 */

import {
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  RelationshipType,
  RelationshipEvidence,
  KnowledgeGraphConfig,
} from "../types/graph-types";
import type { ExtractedContent } from "../../extraction/types";

export interface RelationshipExtractionResult {
  relationships: KnowledgeGraphRelationship[];
  confidence: number;
  processingStats: {
    totalRelationships: number;
    relationshipsByType: Record<RelationshipType, number>;
    highConfidenceRelationships: number;
    inferredRelationships: number;
    processingTime: number;
  };
}

export interface RelationshipPattern {
  type: RelationshipType;
  patterns: RegExp[];
  confidence: number;
  extractDirection: "source-target" | "target-source" | "bidirectional";
}

export class RelationshipExtractor {
  private config: KnowledgeGraphConfig;
  private patterns: Map<RelationshipType, RelationshipPattern[]> = new Map();
  private relationshipCache: Map<string, KnowledgeGraphRelationship> =
    new Map();

  constructor(config: KnowledgeGraphConfig, logger?: any) {
    this.config = config;
    this.initializePatterns();
  }

  /**
   * Extract relationships from content given entities
   */
  async extractRelationships(
    documentId: string,
    extractedContent: ExtractedContent,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string,
  ): Promise<RelationshipExtractionResult> {
    const startTime = Date.now();

    const relationships: KnowledgeGraphRelationship[] = [];

    // Extract from text sections
    for (const section of extractedContent.sections) {
      const sectionRelationships = await this.extractFromText(
        documentId,
        section.content,
        section.id,
        entities,
        jurisdiction,
      );
      relationships.push(...sectionRelationships);
    }

    // Extract from tables
    for (const table of extractedContent.tables) {
      const tableRelationships = await this.extractFromTable(
        documentId,
        table,
        entities,
        jurisdiction,
      );
      relationships.push(...tableRelationships);
    }

    // Extract from cross-references
    if (extractedContent.crossReferences) {
      const crossRefRelationships = await this.extractFromCrossReferences(
        documentId,
        extractedContent.crossReferences,
        entities,
        jurisdiction,
      );
      relationships.push(...crossRefRelationships);
    }

    // Infer additional relationships if enabled
    let inferredRelationships: KnowledgeGraphRelationship[] = [];
    if (this.config.relationshipExtraction.enableInference) {
      inferredRelationships = await this.inferRelationships(
        relationships,
        entities,
        documentId,
        jurisdiction,
      );
    }

    // Combine and deduplicate relationships
    const allRelationships = [...relationships, ...inferredRelationships];
    const deduplicatedRelationships =
      await this.deduplicateRelationships(allRelationships);

    // Apply confidence filtering
    const filteredRelationships = deduplicatedRelationships.filter(
      (rel) =>
        rel.confidence >= this.config.relationshipExtraction.minConfidence,
    );

    // Limit relationships per section
    const limitedRelationships = this.limitRelationships(filteredRelationships);

    const processingTime = Date.now() - startTime;

    return {
      relationships: limitedRelationships,
      confidence: this.calculateOverallConfidence(limitedRelationships),
      processingStats: {
        totalRelationships: limitedRelationships.length,
        relationshipsByType:
          this.groupRelationshipsByType(limitedRelationships),
        highConfidenceRelationships: limitedRelationships.filter(
          (r) => r.confidence > 0.8,
        ).length,
        inferredRelationships: inferredRelationships.length,
        processingTime,
      },
    };
  }

  /**
   * Extract relationships from text using patterns and entity co-occurrence
   */
  private async extractFromText(
    documentId: string,
    text: string,
    sectionId: string,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string,
  ): Promise<KnowledgeGraphRelationship[]> {
    const relationships: KnowledgeGraphRelationship[] = [];

    // Pattern-based extraction
    for (const [relType, patterns] of this.patterns.entries()) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);

        for (const match of matches) {
          const involvedEntities = this.findEntitiesInContext(
            match[0],
            text,
            match.index || 0,
            entities,
          );

          if (involvedEntities.length >= 2) {
            const relationship = this.createRelationshipFromMatch(
              involvedEntities[0],
              involvedEntities[1],
              relType,
              pattern,
              documentId,
              sectionId,
              match[0],
              match.index || 0,
              text,
              jurisdiction,
            );

            if (relationship) {
              relationships.push(relationship);
            }
          }
        }
      }
    }

    // Co-occurrence-based extraction
    const cooccurrenceRelationships = this.extractCooccurrenceRelationships(
      text,
      documentId,
      sectionId,
      entities,
      jurisdiction,
    );
    relationships.push(...cooccurrenceRelationships);

    return relationships;
  }

  /**
   * Extract relationships from table structure
   */
  private async extractFromTable(
    documentId: string,
    table: any,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string,
  ): Promise<KnowledgeGraphRelationship[]> {
    const relationships: KnowledgeGraphRelationship[] = [];

    // Relationships within rows (row entities are related)
    for (let i = 0; i < table.rows.length; i++) {
      const rowText = table.rows[i].join(" ");
      const rowEntities = this.findEntitiesInText(rowText, entities);

      if (rowEntities.length >= 2) {
        // Create relationships between entities in the same row
        for (let j = 0; j < rowEntities.length - 1; j++) {
          for (let k = j + 1; k < rowEntities.length; k++) {
            const relationship: KnowledgeGraphRelationship = {
              id: this.generateRelationshipId(
                rowEntities[j].id,
                rowEntities[k].id,
                "related_to",
              ),
              sourceEntityId: rowEntities[j].id,
              targetEntityId: rowEntities[k].id,
              type: "related_to",
              attributes: {
                context: "table_row",
                tableId: table.id,
                rowIndex: i,
              },
              confidence: 0.6,
              evidence: [
                {
                  documentId,
                  sectionId: `table-${table.id}-row-${i}`,
                  textContext: rowText,
                  confidence: 0.6,
                  extractionMethod: "pattern-matching",
                },
              ],
              jurisdiction,
              createdAt: new Date().toISOString(),
            };
            relationships.push(relationship);
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Extract relationships from cross-references
   */
  private async extractFromCrossReferences(
    documentId: string,
    crossReferences: any[],
    entities: KnowledgeGraphEntity[],
    jurisdiction: string,
  ): Promise<KnowledgeGraphRelationship[]> {
    const relationships: KnowledgeGraphRelationship[] = [];

    for (const crossRef of crossReferences) {
      // Find entities mentioned in cross-reference
      const mentionedEntities = this.findEntitiesInText(
        crossRef.text,
        entities,
      );

      // Find referenced entities (if crossRef points to specific section)
      const referencedEntities = crossRef.targetSectionId
        ? entities.filter(
            (e) => e.source.sectionId === crossRef.targetSectionId,
          )
        : [];

      // Create relationships between mentioned and referenced entities
      for (const mentioned of mentionedEntities) {
        for (const referenced of referencedEntities) {
          if (mentioned.id !== referenced.id) {
            const relationship: KnowledgeGraphRelationship = {
              id: this.generateRelationshipId(
                mentioned.id,
                referenced.id,
                "references",
              ),
              sourceEntityId: mentioned.id,
              targetEntityId: referenced.id,
              type: "references",
              attributes: {
                crossReferenceType: crossRef.type,
                targetSection: crossRef.targetSectionId,
              },
              confidence: 0.8,
              evidence: [
                {
                  documentId,
                  textContext: crossRef.text,
                  confidence: 0.8,
                  extractionMethod: "pattern-matching",
                },
              ],
              jurisdiction,
              createdAt: new Date().toISOString(),
            };
            relationships.push(relationship);
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Infer additional relationships using transitivity and reasoning
   */
  private async inferRelationships(
    existingRelationships: KnowledgeGraphRelationship[],
    entities: KnowledgeGraphEntity[],
    documentId: string,
    jurisdiction: string,
  ): Promise<KnowledgeGraphRelationship[]> {
    const inferred: KnowledgeGraphRelationship[] = [];

    if (!this.config.relationshipExtraction.enableTransitivity) {
      return inferred;
    }

    // Apply transitive rules
    const transitiveRules = [
      // If A regulates B and B implements C, then A regulates C
      { antecedent: ["regulates", "implements"], consequent: "regulates" },
      // If A requires B and B addresses C, then A requires C
      { antecedent: ["requires", "addresses"], consequent: "requires" },
      // If A controls B and B reports to C, then A controls C
      { antecedent: ["controls", "reports_to"], consequent: "controls" },
    ];

    for (const rule of transitiveRules) {
      const inferredRels = this.applyTransitiveRule(
        rule.antecedent,
        rule.consequent,
        existingRelationships,
        entities,
        documentId,
        jurisdiction,
      );
      inferred.push(...inferredRels);
    }

    return inferred;
  }

  /**
   * Apply transitive relationship rule
   */
  private applyTransitiveRule(
    antecedent: [RelationshipType, RelationshipType],
    consequent: RelationshipType,
    relationships: KnowledgeGraphRelationship[],
    entities: KnowledgeGraphEntity[],
    documentId: string,
    jurisdiction: string,
  ): KnowledgeGraphRelationship[] {
    const inferred: KnowledgeGraphRelationship[] = [];

    // Find relationships matching the pattern
    for (const rel1 of relationships) {
      if (rel1.type === antecedent[0]) {
        for (const rel2 of relationships) {
          if (
            rel2.type === antecedent[1] &&
            rel1.targetEntityId === rel2.sourceEntityId
          ) {
            // Check if inferred relationship already exists
            const exists = relationships.some(
              (r) =>
                r.sourceEntityId === rel1.sourceEntityId &&
                r.targetEntityId === rel2.targetEntityId &&
                r.type === consequent,
            );

            if (!exists) {
              const inferredRel: KnowledgeGraphRelationship = {
                id: this.generateRelationshipId(
                  rel1.sourceEntityId,
                  rel2.targetEntityId,
                  consequent,
                ),
                sourceEntityId: rel1.sourceEntityId,
                targetEntityId: rel2.targetEntityId,
                type: consequent,
                attributes: {
                  inferred: true,
                  inferenceRule: `${antecedent[0]} + ${antecedent[1]} -> ${consequent}`,
                  sourceRelationships: [rel1.id, rel2.id],
                },
                confidence: Math.min(rel1.confidence, rel2.confidence) * 0.8, // Reduce confidence for inferences
                evidence: [...rel1.evidence, ...rel2.evidence].map((e) => ({
                  ...e,
                  extractionMethod: "inference" as const,
                })),
                jurisdiction,
                createdAt: new Date().toISOString(),
              };
              inferred.push(inferredRel);
            }
          }
        }
      }
    }

    return inferred;
  }

  /**
   * Extract co-occurrence relationships
   */
  private extractCooccurrenceRelationships(
    text: string,
    documentId: string,
    sectionId: string,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string,
  ): KnowledgeGraphRelationship[] {
    const relationships: KnowledgeGraphRelationship[] = [];
    const windowSize = 100; // words

    // Find entities that appear close to each other
    const entityPositions = entities
      .map((entity) => ({
        entity,
        position: text.toLowerCase().indexOf(entity.name.toLowerCase()),
      }))
      .filter((ep) => ep.position >= 0)
      .sort((a, b) => a.position - b.position);

    for (let i = 0; i < entityPositions.length - 1; i++) {
      for (let j = i + 1; j < entityPositions.length; j++) {
        const distance =
          entityPositions[j].position - entityPositions[i].position;

        if (distance <= windowSize * 5) {
          // Approximate word length
          const confidence = Math.max(0.3, 1 - distance / (windowSize * 5));

          const relationship: KnowledgeGraphRelationship = {
            id: this.generateRelationshipId(
              entityPositions[i].entity.id,
              entityPositions[j].entity.id,
              "associated_with",
            ),
            sourceEntityId: entityPositions[i].entity.id,
            targetEntityId: entityPositions[j].entity.id,
            type: "associated_with",
            attributes: {
              cooccurrenceDistance: distance,
              windowSize,
            },
            confidence,
            evidence: [
              {
                documentId,
                sectionId,
                textContext: text.substring(
                  entityPositions[i].position,
                  entityPositions[j].position +
                    entityPositions[j].entity.name.length,
                ),
                confidence,
                extractionMethod: "pattern-matching",
              },
            ],
            jurisdiction,
            createdAt: new Date().toISOString(),
          };
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  /**
   * Find entities in text context
   */
  private findEntitiesInContext(
    context: string,
    fullText: string,
    position: number,
    entities: KnowledgeGraphEntity[],
  ): KnowledgeGraphEntity[] {
    const contextStart = Math.max(0, position - 50);
    const contextEnd = Math.min(
      fullText.length,
      position + context.length + 50,
    );
    const textContext = fullText.substring(contextStart, contextEnd);

    return this.findEntitiesInText(textContext, entities);
  }

  /**
   * Find entities mentioned in text
   */
  private findEntitiesInText(
    text: string,
    entities: KnowledgeGraphEntity[],
  ): KnowledgeGraphEntity[] {
    const found: KnowledgeGraphEntity[] = [];
    const lowerText = text.toLowerCase();

    for (const entity of entities) {
      // Check for exact name match
      if (lowerText.includes(entity.name.toLowerCase())) {
        found.push(entity);
        continue;
      }

      // Check for alias matches
      for (const alias of entity.aliases) {
        if (lowerText.includes(alias.toLowerCase())) {
          found.push(entity);
          break;
        }
      }
    }

    return found;
  }

  /**
   * Create relationship from pattern match
   */
  private createRelationshipFromMatch(
    sourceEntity: KnowledgeGraphEntity,
    targetEntity: KnowledgeGraphEntity,
    type: RelationshipType,
    pattern: RelationshipPattern,
    documentId: string,
    sectionId: string,
    match: string,
    position: number,
    text: string,
    jurisdiction: string,
  ): KnowledgeGraphRelationship | null {
    if (!sourceEntity || !targetEntity || sourceEntity.id === targetEntity.id) {
      return null;
    }

    const contextStart = Math.max(0, position - 50);
    const contextEnd = Math.min(text.length, position + match.length + 50);
    const textContext = text.substring(contextStart, contextEnd);

    const relationship: KnowledgeGraphRelationship = {
      id: this.generateRelationshipId(sourceEntity.id, targetEntity.id, type),
      sourceEntityId: sourceEntity.id,
      targetEntityId: targetEntity.id,
      type,
      attributes: {
        patternMatch: match,
        position,
      },
      confidence: pattern.confidence,
      evidence: [
        {
          documentId,
          sectionId,
          textContext,
          confidence: pattern.confidence,
          extractionMethod: "pattern-matching",
        },
      ],
      jurisdiction,
      createdAt: new Date().toISOString(),
    };

    return relationship;
  }

  /**
   * Deduplicate relationships
   */
  private async deduplicateRelationships(
    relationships: KnowledgeGraphRelationship[],
  ): Promise<KnowledgeGraphRelationship[]> {
    const deduplicated: KnowledgeGraphRelationship[] = [];
    const seen = new Map<string, KnowledgeGraphRelationship>();

    for (const relationship of relationships) {
      const key = `${relationship.sourceEntityId}-${relationship.targetEntityId}-${relationship.type}`;

      if (seen.has(key)) {
        // Merge with existing relationship
        const existing = seen.get(key)!;
        existing.confidence = Math.max(
          existing.confidence,
          relationship.confidence,
        );
        existing.evidence.push(...relationship.evidence);

        // Merge attributes
        Object.assign(existing.attributes, relationship.attributes);
        existing.createdAt = new Date().toISOString();
      } else {
        seen.set(key, relationship);
        deduplicated.push(relationship);
      }
    }

    return deduplicated;
  }

  /**
   * Limit relationships per section to avoid noise
   */
  private limitRelationships(
    relationships: KnowledgeGraphRelationship[],
  ): KnowledgeGraphRelationship[] {
    const relationshipsBySection = new Map<
      string,
      KnowledgeGraphRelationship[]
    >();

    // Group by section
    for (const rel of relationships) {
      const section = rel.evidence[0]?.sectionId || "unknown";
      if (!relationshipsBySection.has(section)) {
        relationshipsBySection.set(section, []);
      }
      relationshipsBySection.get(section)!.push(rel);
    }

    const limited: KnowledgeGraphRelationship[] = [];

    // Apply limits per section
    for (const [section, rels] of relationshipsBySection.entries()) {
      if (
        rels.length >
        this.config.relationshipExtraction.maxRelationshipsPerSection
      ) {
        rels.sort((a, b) => b.confidence - a.confidence);
        rels.splice(
          this.config.relationshipExtraction.maxRelationshipsPerSection,
        );
      }
      limited.push(...rels);
    }

    return limited;
  }

  /**
   * Initialize relationship extraction patterns
   */
  private initializePatterns(): void {
    // Regulatory relationships
    this.patterns.set("regulates", [
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:shall regulate|must regulate|regulates?)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "source-target",
      },
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:is regulated by|subject to)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "target-source",
      },
    ]);

    this.patterns.set("requires", [
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:shall|must|required to)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "source-target",
      },
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:is required by|is mandated by)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "target-source",
      },
    ]);

    this.patterns.set("prohibits", [
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:shall not|must not|prohibited from)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "source-target",
      },
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:is prohibited by|is forbidden by)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "target-source",
      },
    ]);

    // Compliance relationships
    this.patterns.set("implements", [
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:implements|shall implement)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "source-target",
      },
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:is implemented by)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "target-source",
      },
    ]);

    this.patterns.set("reports_to", [
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:shall report|must report|reports to?)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "source-target",
      },
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:receives reports from)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.8,
        extractDirection: "target-source",
      },
    ]);

    // Risk relationships
    this.patterns.set("poses_risk_to", [
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:poses risk to|risks? affecting?)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.7,
        extractDirection: "source-target",
      },
      {
        patterns: [
          /\b(\w+(?:\s+\w+)*)\s+(?:is at risk from|vulnerable to)\s+(\w+(?:\s+\w+)*)\b/gi,
        ],
        confidence: 0.7,
        extractDirection: "target-source",
      },
    ]);
  }

  /**
   * Generate unique relationship ID
   */
  private generateRelationshipId(
    sourceId: string,
    targetId: string,
    type: RelationshipType,
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
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Group relationships by type for analytics
   */
  private groupRelationshipsByType(
    relationships: KnowledgeGraphRelationship[],
  ): Record<RelationshipType, number> {
    const groups: Record<string, number> = {};

    for (const rel of relationships) {
      groups[rel.type] = (groups[rel.type] || 0) + 1;
    }

    return groups as Record<RelationshipType, number>;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    relationships: KnowledgeGraphRelationship[],
  ): number {
    if (relationships.length === 0) return 0;

    const totalConfidence = relationships.reduce(
      (sum, rel) => sum + rel.confidence,
      0,
    );
    return totalConfidence / relationships.length;
  }

  /**
   * Get relationship extraction statistics
   */
  getExtractionStats(): {
    patternCount: number;
    cachedRelationships: number;
    supportedTypes: RelationshipType[];
  } {
    const patternCount = Array.from(this.patterns.values()).reduce(
      (total, patterns) => total + patterns.length,
      0,
    );

    return {
      patternCount,
      cachedRelationships: this.relationshipCache.size,
      supportedTypes: Array.from(this.patterns.keys()),
    };
  }
}
