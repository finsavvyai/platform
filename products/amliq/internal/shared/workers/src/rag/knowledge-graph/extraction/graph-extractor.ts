/**
 * Knowledge Graph Extractor
 *
 * Extracts entities and relationships from regulatory documents to build
 * a comprehensive knowledge graph for compliance and risk analysis.
 */

import {
  KnowledgeGraphEntity,
  KnowledgeGraphRelationship,
  RelationshipEvidence,
  EntityType,
  RelationshipType,
  KnowledgeGraphConfig
} from '../types/graph-types';

export interface EntityExtractionResult {
  entities: KnowledgeGraphEntity[];
  confidence: number;
  extractionMethod: 'ai' | 'rule-based' | 'hybrid';
  processingTime: number;
}

export interface RelationshipExtractionResult {
  relationships: KnowledgeGraphRelationship[];
  confidence: number;
  inferenceResults: any[];
  processingTime: number;
}

export class KnowledgeGraphExtractor {
  private ai: any;
  private logger: any;
  private config: KnowledgeGraphConfig;

  constructor(ai: any, logger: any, config?: Partial<KnowledgeGraphConfig>) {
    this.ai = ai;
    this.logger = logger;
    this.config = {
      entityExtraction: {
        minConfidence: 0.7,
        maxEntitiesPerSection: 50,
        enableDisambiguation: true,
        enableTemporalExtraction: true,
        ...config?.entityExtraction
      },
      relationshipExtraction: {
        minConfidence: 0.6,
        maxRelationshipsPerSection: 100,
        enableInference: true,
        enableTransitivity: true,
        ...config?.relationshipExtraction
      },
      graphConstruction: {
        enableClustering: true,
        enableCentralityCalculation: true,
        enablePathFinding: true,
        enableAnomalyDetection: true,
        ...config?.graphConstruction
      },
      storage: {
        batchSize: 100,
        compressionEnabled: true,
        indexingEnabled: true,
        ...config?.storage
      },
      ...config
    };
  }

  /**
   * Extract entities from document content
   */
  async extractEntities(
    documentId: string,
    content: any,
    jurisdiction: string = 'US'
  ): Promise<EntityExtractionResult> {
    const startTime = Date.now();

    this.logger?.info("Starting entity extraction", {
      documentId,
      jurisdiction,
      contentSections: content.sections?.length || 0
    });

    try {
      const entities: KnowledgeGraphEntity[] = [];

      // Process sections for entity extraction
      if (content.sections) {
        for (const section of content.sections) {
          const sectionEntities = await this.extractEntitiesFromSection(
            documentId,
            section,
            jurisdiction
          );
          entities.push(...sectionEntities);
        }
      }

      // Process tables for entity extraction
      if (content.tables) {
        for (const table of content.tables) {
          const tableEntities = await this.extractEntitiesFromTable(
            documentId,
            table,
            jurisdiction
          );
          entities.push(...tableEntities);
        }
      }

      // Process pre-extracted entities
      if (content.entities) {
        const processedEntities = await this.processPreExtractedEntities(
          documentId,
          content.entities,
          jurisdiction
        );
        entities.push(...processedEntities);
      }

      // Entity disambiguation and deduplication
      const deduplicatedEntities = await this.deduplicateEntities(entities);

      const processingTime = Date.now() - startTime;
      const avgConfidence = this.calculateAverageConfidence(
        deduplicatedEntities.map(e => e.confidence)
      );

      this.logger?.info("Entity extraction completed", {
        documentId,
        entitiesFound: deduplicatedEntities.length,
        averageConfidence: avgConfidence,
        processingTime
      });

      return {
        entities: deduplicatedEntities,
        confidence: avgConfidence,
        extractionMethod: 'hybrid',
        processingTime
      };

    } catch (error) {
      this.logger?.error("Entity extraction failed", {
        documentId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Extract relationships between entities
   */
  async extractRelationships(
    documentId: string,
    content: any,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string = 'US'
  ): Promise<RelationshipExtractionResult> {
    const startTime = Date.now();

    this.logger?.info("Starting relationship extraction", {
      documentId,
      entityCount: entities.length,
      jurisdiction
    });

    try {
      const relationships: KnowledgeGraphRelationship[] = [];
      const inferenceResults: any[] = [];

      // Extract explicit relationships from text
      if (content.sections) {
        for (const section of content.sections) {
          const sectionRelationships = await this.extractRelationshipsFromSection(
            documentId,
            section,
            entities,
            jurisdiction
          );
          relationships.push(...sectionRelationships);
        }
      }

      // Extract relationships from tables
      if (content.tables) {
        for (const table of content.tables) {
          const tableRelationships = await this.extractRelationshipsFromTable(
            documentId,
            table,
            entities,
            jurisdiction
          );
          relationships.push(...tableRelationships);
        }
      }

      // Infer additional relationships using AI
      if (this.config.relationshipExtraction.enableInference) {
        const inferredResults = await this.inferRelationships(
          documentId,
          entities,
          relationships,
          jurisdiction
        );
        relationships.push(...inferredResults.relationships);
        inferenceResults.push(...inferredResults.inferences);
      }

      // Apply transitivity rules
      if (this.config.relationshipExtraction.enableTransitivity) {
        const transitiveRelationships = await this.applyTransitivity(relationships);
        relationships.push(...transitiveRelationships);
      }

      // Remove duplicates and low-confidence relationships
      const filteredRelationships = await this.filterRelationships(relationships);

      const processingTime = Date.now() - startTime;
      const avgConfidence = this.calculateAverageConfidence(
        filteredRelationships.map(r => r.confidence)
      );

      this.logger?.info("Relationship extraction completed", {
        documentId,
        relationshipsFound: filteredRelationships.length,
        inferencesMade: inferenceResults.length,
        averageConfidence: avgConfidence,
        processingTime
      });

      return {
        relationships: filteredRelationships,
        confidence: avgConfidence,
        inferenceResults,
        processingTime
      };

    } catch (error) {
      this.logger?.error("Relationship extraction failed", {
        documentId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Extract entities from a document section
   */
  private async extractEntitiesFromSection(
    documentId: string,
    section: any,
    jurisdiction: string
  ): Promise<KnowledgeGraphEntity[]> {
    const entities: KnowledgeGraphEntity[] = [];

    try {
      // Use AI to extract entities
      const aiPrompt = this.buildEntityExtractionPrompt(section.content, jurisdiction);
      const aiResult = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: "system",
            content: "You are an expert in financial regulation and compliance. Extract entities from the given text and classify them according to the predefined types."
          },
          {
            role: "user",
            content: aiPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const extractedEntities = this.parseAIEntityResponse(aiResult.response);

      for (const entityData of extractedEntities) {
        if (entityData.confidence >= this.config.entityExtraction.minConfidence) {
          const entity: KnowledgeGraphEntity = {
            id: this.generateEntityId(documentId, section.id, entityData.name),
            type: entityData.type as EntityType,
            name: entityData.name,
            aliases: entityData.aliases || [],
            attributes: entityData.attributes || {},
            confidence: entityData.confidence,
            source: {
              documentId,
              sectionId: section.id,
              textContext: this.extractTextContext(section.content, entityData.name),
              extractionMethod: 'ai'
            },
            temporalInfo: entityData.temporalInfo,
            jurisdiction,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          entities.push(entity);
        }
      }

      // Apply rule-based extraction for common patterns
      const ruleBasedEntities = await this.extractEntitiesWithRules(
        documentId,
        section,
        jurisdiction
      );
      entities.push(...ruleBasedEntities);

    } catch (error) {
      this.logger?.warn("Entity extraction failed for section", {
        documentId,
        sectionId: section.id,
        error: error.message
      });
    }

    return entities.slice(0, this.config.entityExtraction.maxEntitiesPerSection);
  }

  /**
   * Extract entities from table content
   */
  private async extractEntitiesFromTable(
    documentId: string,
    table: any,
    jurisdiction: string
  ): Promise<KnowledgeGraphEntity[]> {
    const entities: KnowledgeGraphEntity[] = [];

    try {
      // Extract entities from table headers and cells
      const tableText = [
        ...table.headers,
        ...table.rows.flat()
      ].join(' ');

      // Use AI for table entity extraction
      const aiPrompt = this.buildTableEntityExtractionPrompt(table, jurisdiction);
      const aiResult = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: "system",
            content: "Extract structured entities from the table data, focusing on regulatory concepts, thresholds, requirements, and organizational entities."
          },
          {
            role: "user",
            content: aiPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });

      const extractedEntities = this.parseAIEntityResponse(aiResult.response);

      for (const entityData of extractedEntities) {
        const entity: KnowledgeGraphEntity = {
          id: this.generateEntityId(documentId, table.id, entityData.name),
          type: entityData.type as EntityType,
          name: entityData.name,
          aliases: entityData.aliases || [],
          attributes: {
            ...entityData.attributes,
            source: 'table',
            tableContext: table.title
          },
          confidence: entityData.confidence,
          source: {
            documentId,
            sectionId: table.id,
            textContext: tableText,
            extractionMethod: 'ai'
          },
          jurisdiction,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        entities.push(entity);
      }

    } catch (error) {
      this.logger?.warn("Table entity extraction failed", {
        documentId,
        tableId: table.id,
        error: error.message
      });
    }

    return entities;
  }

  /**
   * Process pre-extracted entities from content extraction phase
   */
  private async processPreExtractedEntities(
    documentId: string,
    preExtractedEntities: any[],
    jurisdiction: string
  ): Promise<KnowledgeGraphEntity[]> {
    const entities: KnowledgeGraphEntity[] = [];

    for (const preExtracted of preExtractedEntities) {
      // Map to knowledge graph entity types
      const mappedType = this.mapToGraphEntityType(preExtracted.type);

      if (mappedType && preExtracted.confidence >= this.config.entityExtraction.minConfidence) {
        const entity: KnowledgeGraphEntity = {
          id: this.generateEntityId(documentId, preExtracted.id, preExtracted.name),
          type: mappedType,
          name: preExtracted.name,
          aliases: [],
          attributes: {
            originalType: preExtracted.type,
            context: preExtracted.context
          },
          confidence: preExtracted.confidence,
          source: {
            documentId,
            textContext: preExtracted.context,
            extractionMethod: 'ai'
          },
          jurisdiction,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Extract relationships from a section
   */
  private async extractRelationshipsFromSection(
    documentId: string,
    section: any,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string
  ): Promise<KnowledgeGraphRelationship[]> {
    const relationships: KnowledgeGraphRelationship[] = [];

    try {
      // Find entities mentioned in this section
      const sectionEntities = this.findEntitiesInSection(entities, section);

      if (sectionEntities.length < 2) {
        return relationships;
      }

      // Use AI to extract relationships
      const aiPrompt = this.buildRelationshipExtractionPrompt(
        section.content,
        sectionEntities,
        jurisdiction
      );

      const aiResult = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: "system",
            content: "Extract relationships between entities in the regulatory text. Focus on regulatory, compliance, and risk relationships."
          },
          {
            role: "user",
            content: aiPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const extractedRelationships = this.parseAIRelationshipResponse(aiResult.response);

      for (const relData of extractedRelationships) {
        const sourceEntity = this.findEntityByName(sectionEntities, relData.source);
        const targetEntity = this.findEntityByName(sectionEntities, relData.target);

        if (sourceEntity && targetEntity &&
            relData.confidence >= this.config.relationshipExtraction.minConfidence) {

          const relationship: KnowledgeGraphRelationship = {
            id: this.generateRelationshipId(documentId, section.id, relData),
            sourceEntityId: sourceEntity.id,
            targetEntityId: targetEntity.id,
            type: relData.type as RelationshipType,
            attributes: relData.attributes || {},
            confidence: relData.confidence,
            evidence: [{
              documentId,
              sectionId: section.id,
              textContext: this.extractTextContext(section.content, relData.source, relData.target),
              confidence: relData.confidence,
              extractionMethod: 'ai'
            }],
            jurisdiction,
            createdAt: new Date().toISOString()
          };
          relationships.push(relationship);
        }
      }

    } catch (error) {
      this.logger?.warn("Relationship extraction failed for section", {
        documentId,
        sectionId: section.id,
        error: error.message
      });
    }

    return relationships.slice(0, this.config.relationshipExtraction.maxRelationshipsPerSection);
  }

  /**
   * Infer additional relationships using AI reasoning
   */
  private async inferRelationships(
    documentId: string,
    entities: KnowledgeGraphEntity[],
    existingRelationships: KnowledgeGraphRelationship[],
    jurisdiction: string
  ): Promise<{ relationships: KnowledgeGraphRelationship[], inferences: any[] }> {
    const relationships: KnowledgeGraphRelationship[] = [];
    const inferences: any[] = [];

    try {
      // Group entities by type and look for implicit relationships
      const regulatoryEntities = entities.filter(e =>
        ['regulation', 'law', 'directive', 'guideline'].includes(e.type)
      );

      const institutionalEntities = entities.filter(e =>
        ['financial_institution', 'regulatory_body', 'supervisory_authority'].includes(e.type)
      );

      // Use AI to infer regulatory relationships
      for (const regEntity of regulatoryEntities) {
        for (const instEntity of institutionalEntities) {
          const inferencePrompt = this.buildInferencePrompt(
            regEntity,
            instEntity,
            existingRelationships,
            jurisdiction
          );

          const aiResult = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
              {
                role: "system",
                content: "Analyze whether there's an implicit regulatory relationship between these entities based on regulatory patterns and domain knowledge."
              },
              {
                role: "user",
                content: inferencePrompt
              }
            ],
            temperature: 0.2,
            max_tokens: 1000
          });

          const inference = this.parseInferenceResponse(aiResult.response);

          if (inference.confidence >= this.config.relationshipExtraction.minConfidence) {
            const relationship: KnowledgeGraphRelationship = {
              id: this.generateRelationshipId(documentId, 'inferred', {
                source: regEntity.name,
                target: instEntity.name,
                type: inference.type
              }),
              sourceEntityId: regEntity.id,
              targetEntityId: instEntity.id,
              type: inference.type as RelationshipType,
              attributes: {
                inferred: true,
                reasoning: inference.reasoning
              },
              confidence: inference.confidence,
              evidence: [{
                documentId,
                textContext: `Inferred relationship between ${regEntity.name} and ${instEntity.name}`,
                confidence: inference.confidence,
                extractionMethod: 'ai'
              }],
              jurisdiction,
              createdAt: new Date().toISOString()
            };
            relationships.push(relationship);
            inferences.push(inference);
          }
        }
      }

    } catch (error) {
      this.logger?.warn("Relationship inference failed", {
        documentId,
        error: error.message
      });
    }

    return { relationships, inferences };
  }

  /**
   * Helper methods
   */
  private buildEntityExtractionPrompt(content: string, jurisdiction: string): string {
    return `
Extract entities from the following regulatory text for ${jurisdiction} jurisdiction.

Text: "${content}"

Extract entities of these types:
- financial_institution, regulatory_body, compliance_program
- regulation, law, directive, guideline, requirement
- risk_factor, threat_actor, vulnerability, control_measure
- country, region, jurisdiction, supervisory_authority
- customer, beneficial_owner, legal_entity, business_activity
- time_period, date, deadline, effective_date
- person, organization, location, concept, metric

For each entity provide:
- name (exact text from document)
- type (from the list above)
- confidence (0-1)
- aliases (alternative names)
- attributes (additional properties)
- temporal_info (if applicable)

Respond in JSON format with an array of entities.
`;
  }

  private buildRelationshipExtractionPrompt(
    content: string,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string
  ): string {
    const entityList = entities.map(e => `- ${e.name} (${e.type})`).join('\n');

    return `
Extract relationships between entities from the following regulatory text for ${jurisdiction} jurisdiction.

Text: "${content}"

Entities mentioned:
${entityList}

Extract relationships of these types:
- regulates, requires, prohibits, mandates, exempts, authorizes
- implements, violates, addresses, mitigates, controls, monitors
- poses_risk_to, vulnerable_to, exploits, protects_against
- owns, controls, reports_to, supervises, collaborates_with
- located_in, operates_in, applies_to, jurisdiction_of
- precedes, follows, overlaps, valid_during

For each relationship provide:
- source_entity (exact name)
- target_entity (exact name)
- type (from the list above)
- confidence (0-1)
- attributes (additional properties)

Respond in JSON format with an array of relationships.
`;
  }

  private buildInferencePrompt(
    regEntity: KnowledgeGraphEntity,
    instEntity: KnowledgeGraphEntity,
    existingRelationships: KnowledgeGraphRelationship[],
    jurisdiction: string
  ): string {
    return `
Analyze the potential regulatory relationship between:

Regulatory Entity: ${regEntity.name} (${regEntity.type})
Institutional Entity: ${instEntity.name} (${instEntity.type})
Jurisdiction: ${jurisdiction}

Consider common regulatory patterns:
- Regulations typically apply to financial institutions operating in their jurisdiction
- Regulatory bodies supervise institutions under their authority
- Requirements and obligations flow from regulations to regulated entities

Existing relationships between these entities:
${existingRelationships.length > 0 ?
  existingRelationships.map(r => `- ${r.type} from ${r.sourceEntityId} to ${r.targetEntityId}`).join('\n') :
  'No direct relationships found'
}

Infer if there's likely a regulatory relationship and specify:
- relationship_type
- confidence (0-1)
- reasoning (brief explanation)

Respond in JSON format.
`;
  }

  private parseAIEntityResponse(response: string): any[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      this.logger?.warn("Failed to parse AI entity response", { error: error.message });
      return [];
    }
  }

  private parseAIRelationshipResponse(response: string): any[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      this.logger?.warn("Failed to parse AI relationship response", { error: error.message });
      return [];
    }
  }

  private parseInferenceResponse(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { confidence: 0, reasoning: "Failed to parse response" };
    } catch (error) {
      this.logger?.warn("Failed to parse inference response", { error: error.message });
      return { confidence: 0, reasoning: "Failed to parse response" };
    }
  }

  private generateEntityId(documentId: string, sectionId: string, entityName: string): string {
    return `${documentId}_${sectionId}_${entityName.toLowerCase().replace(/\s+/g, '_')}`;
  }

  private generateRelationshipId(documentId: string, sectionId: string, relationshipData: any): string {
    return `${documentId}_${sectionId}_${relationshipData.source.toLowerCase().replace(/\s+/g, '_')}_${relationshipData.type}_${relationshipData.target.toLowerCase().replace(/\s+/g, '_')}`;
  }

  private extractTextContext(content: string, ...entities: string[]): string {
    const words = content.split(/\s+/);
    const entityIndices = entities.map(entity => {
      const index = words.findIndex(word =>
        word.toLowerCase().includes(entity.toLowerCase())
      );
      return index;
    }).filter(index => index >= 0);

    if (entityIndices.length === 0) return content.substring(0, 200);

    const minIndex = Math.min(...entityIndices);
    const maxIndex = Math.max(...entityIndices);
    const start = Math.max(0, minIndex - 10);
    const end = Math.min(words.length, maxIndex + 11);

    return words.slice(start, end).join(' ');
  }

  private findEntitiesInSection(entities: KnowledgeGraphEntity[], section: any): KnowledgeGraphEntity[] {
    return entities.filter(entity =>
      entity.source.sectionId === section.id ||
      (section.content &&
       section.content.toLowerCase().includes(entity.name.toLowerCase()))
    );
  }

  private findEntityByName(entities: KnowledgeGraphEntity[], name: string): KnowledgeGraphEntity | null {
    return entities.find(entity =>
      entity.name.toLowerCase() === name.toLowerCase() ||
      entity.aliases.some(alias => alias.toLowerCase() === name.toLowerCase())
    ) || null;
  }

  private mapToGraphEntityType(originalType: string): EntityType | null {
    const typeMapping: Record<string, EntityType> = {
      'organization': 'organization',
      'person': 'person',
      'location': 'location',
      'regulation': 'regulation',
      'date': 'date',
      'concept': 'concept'
    };
    return typeMapping[originalType] || null;
  }

  private async deduplicateEntities(entities: KnowledgeGraphEntity[]): Promise<KnowledgeGraphEntity[]> {
    const deduplicated: KnowledgeGraphEntity[] = [];
    const seen = new Set<string>();

    for (const entity of entities) {
      const key = `${entity.type}_${entity.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(entity);
      }
    }

    return deduplicated;
  }

  private async filterRelationships(relationships: KnowledgeGraphRelationship[]): Promise<KnowledgeGraphRelationship[]> {
    const filtered: KnowledgeGraphRelationship[] = [];
    const seen = new Set<string>();

    for (const relationship of relationships) {
      const key = `${relationship.sourceEntityId}_${relationship.type}_${relationship.targetEntityId}`;
      if (!seen.has(key) &&
          relationship.confidence >= this.config.relationshipExtraction.minConfidence) {
        seen.add(key);
        filtered.push(relationship);
      }
    }

    return filtered;
  }

  private async applyTransitivity(relationships: KnowledgeGraphRelationship[]): Promise<KnowledgeGraphRelationship[]> {
    const transitiveRelationships: KnowledgeGraphRelationship[] = [];

    // Simple transitivity: if A regulates B and B is a type of C, then A regulates C
    const typeRelationships = relationships.filter(r => r.type === 'is_a');
    const regulatoryRelationships = relationships.filter(r =>
      ['regulates', 'requires', 'mandates'].includes(r.type)
    );

    for (const regRel of regulatoryRelationships) {
      for (const typeRel of typeRelationships) {
        if (regRel.targetEntityId === typeRel.sourceEntityId) {
          const transitiveRel: KnowledgeGraphRelationship = {
            id: `${regRel.id}_transitive_${typeRel.id}`,
            sourceEntityId: regRel.sourceEntityId,
            targetEntityId: typeRel.targetEntityId,
            type: regRel.type,
            attributes: {
              ...regRel.attributes,
              transitive: true,
              sourceRelationship: regRel.id,
              typeRelationship: typeRel.id
            },
            confidence: regRel.confidence * 0.8, // Reduce confidence for inferred relationships
            evidence: regRel.evidence,
            jurisdiction: regRel.jurisdiction,
            createdAt: new Date().toISOString()
          };
          transitiveRelationships.push(transitiveRel);
        }
      }
    }

    return transitiveRelationships;
  }

  private async extractEntitiesWithRules(
    documentId: string,
    section: any,
    jurisdiction: string
  ): Promise<KnowledgeGraphEntity[]> {
    const entities: KnowledgeGraphEntity[] = [];

    // Define regex patterns for common entity types
    const patterns = [
      {
        type: 'date' as EntityType,
        pattern: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,
        confidence: 0.9
      },
      {
        type: 'monetary_amount' as EntityType,
        pattern: /\$\s*\d{1,3}(,\d{3})*(\.\d{2})?|\d{1,3}(,\d{3})*\s*(USD|EUR|GBP)/g,
        confidence: 0.85
      },
      {
        type: 'percentage' as EntityType,
        pattern: /\d+\.?\d*%/g,
        confidence: 0.8
      },
      {
        type: 'effective_date' as EntityType,
        pattern: /effective\s+(?:date|on)\s+([^\n\r]+)/gi,
        confidence: 0.75
      }
    ];

    for (const pattern of patterns) {
      const matches = section.content.match(pattern.pattern);
      if (matches) {
        for (const match of matches) {
          const entity: KnowledgeGraphEntity = {
            id: this.generateEntityId(documentId, section.id, `rule_${match}`),
            type: pattern.type,
            name: match.trim(),
            aliases: [],
            attributes: {
              extractedBy: 'rule-based',
              pattern: pattern.pattern.source
            },
            confidence: pattern.confidence,
            source: {
              documentId,
              sectionId: section.id,
              textContext: this.extractTextContext(section.content, match),
              extractionMethod: 'rule-based'
            },
            jurisdiction,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          entities.push(entity);
        }
      }
    }

    return entities;
  }

  private buildTableEntityExtractionPrompt(table: any, jurisdiction: string): string {
    const tableText = `
Table: ${table.title}
Headers: ${table.headers.join(', ')}
Rows: ${table.rows.map(row => row.join(' | ')).join('\n')}
`;

    return `
Extract entities from this table data for ${jurisdiction} jurisdiction.

${tableText}

Focus on extracting:
- Regulatory concepts and requirements
- Financial thresholds and limits
- Organizational entities and roles
- Compliance measures and controls
- Time periods and deadlines

Respond in JSON format with an array of entities including name, type, confidence, and attributes.
`;
  }

  private extractRelationshipsFromTable(
    documentId: string,
    table: any,
    entities: KnowledgeGraphEntity[],
    jurisdiction: string
  ): Promise<KnowledgeGraphRelationship[]> {
    // Implement table-specific relationship extraction
    // This would analyze table structure to find relationships
    return Promise.resolve([]);
  }

  private calculateAverageConfidence(confidences: number[]): number {
    if (confidences.length === 0) return 0;
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  static defaultConfig(): KnowledgeGraphConfig {
    return {
      entityExtraction: {
        minConfidence: 0.7,
        maxEntitiesPerSection: 50,
        enableDisambiguation: true,
        enableTemporalExtraction: true
      },
      relationshipExtraction: {
        minConfidence: 0.6,
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
  }
}
