/**
 * Knowledge Graph Entity Extractor
 *
 * Uses AI and rule-based approaches to extract entities from regulatory documents
 * and create a comprehensive knowledge graph for financial compliance.
 */

import {
  KnowledgeGraphEntity,
  EntityType,
  KnowledgeGraphConfig,
} from "../types/graph-types";
import type { ExtractedContent } from "../../extraction/types";

export interface EntityExtractionResult {
  entities: KnowledgeGraphEntity[];
  confidence: number;
  processingStats: {
    totalEntities: number;
    entitiesByType: Record<EntityType, number>;
    highConfidenceEntities: number;
    temporalEntities: number;
    processingTime: number;
  };
}

export interface EntityPattern {
  type: EntityType;
  patterns: RegExp[];
  confidence: number;
  attributes?: Record<string, any>;
}

export class KnowledgeGraphExtractor {
  private config: KnowledgeGraphConfig;
  private patterns: Map<EntityType, EntityPattern[]> = new Map();
  private entityCache: Map<string, KnowledgeGraphEntity> = new Map();

  constructor(config: KnowledgeGraphConfig, logger?: any) {
    this.config = config;
    this.initializePatterns();
  }

  /**
   * Extract entities and relationships from extracted content
   */
  async extractFromContent(
    documentId: string,
    extractedContent: ExtractedContent,
    jurisdiction: string,
  ): Promise<EntityExtractionResult> {
    const startTime = Date.now();

    const entities: KnowledgeGraphEntity[] = [];

    // Extract from text sections
    for (const section of extractedContent.sections) {
      const sectionEntities = await this.extractFromText(
        documentId,
        section.content,
        section.id,
        jurisdiction,
      );
      entities.push(...sectionEntities);
    }

    // Extract from tables
    for (const table of extractedContent.tables) {
      const tableEntities = await this.extractFromTable(
        documentId,
        table,
        jurisdiction,
      );
      entities.push(...tableEntities);
    }

    // Process existing entities from content extractor
    if (extractedContent.entities) {
      const enhancedEntities = await this.enhanceExtractedEntities(
        documentId,
        extractedContent.entities,
        jurisdiction,
      );
      entities.push(...enhancedEntities);
    }

    // Deduplicate and disambiguate entities
    const deduplicatedEntities = await this.deduplicateEntities(entities);

    // Apply confidence filtering
    const filteredEntities = deduplicatedEntities.filter(
      (entity) =>
        entity.confidence >= this.config.entityExtraction.minConfidence,
    );

    const processingTime = Date.now() - startTime;

    return {
      entities: filteredEntities,
      confidence: this.calculateOverallConfidence(filteredEntities),
      processingStats: {
        totalEntities: filteredEntities.length,
        entitiesByType: this.groupEntitiesByType(filteredEntities),
        highConfidenceEntities: filteredEntities.filter(
          (e) => e.confidence > 0.8,
        ).length,
        temporalEntities: filteredEntities.filter((e) => e.temporalInfo).length,
        processingTime,
      },
    };
  }

  /**
   * Extract entities from text content using AI and patterns
   */
  private async extractFromText(
    documentId: string,
    text: string,
    sectionId: string,
    jurisdiction: string,
  ): Promise<KnowledgeGraphEntity[]> {
    const entities: KnowledgeGraphEntity[] = [];

    // Pattern-based extraction
    for (const [entityType, patterns] of this.patterns.entries()) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);

        for (const match of matches) {
          const entity = this.createEntityFromMatch(
            match[0] || match.groups?.entity,
            entityType,
            pattern,
            documentId,
            sectionId,
            match.index || 0,
            text,
            jurisdiction,
          );

          if (entity) {
            entities.push(entity);
          }
        }
      }
    }

    // Temporal entity extraction
    const temporalEntities = this.extractTemporalEntities(
      text,
      documentId,
      sectionId,
      jurisdiction,
    );
    entities.push(...temporalEntities);

    // Limit entities per section
    if (entities.length > this.config.entityExtraction.maxEntitiesPerSection) {
      entities.sort((a, b) => b.confidence - a.confidence);
      entities.splice(this.config.entityExtraction.maxEntitiesPerSection);
    }

    return entities;
  }

  /**
   * Extract entities from table content
   */
  private async extractFromTable(
    documentId: string,
    table: any,
    jurisdiction: string,
  ): Promise<KnowledgeGraphEntity[]> {
    const entities: KnowledgeGraphEntity[] = [];

    // Extract from headers
    for (const header of table.headers) {
      const headerEntities = await this.extractFromText(
        documentId,
        header,
        `table-${table.id}-headers`,
        jurisdiction,
      );
      entities.push(...headerEntities);
    }

    // Extract from table rows
    for (let i = 0; i < table.rows.length; i++) {
      const rowText = table.rows[i].join(" ");
      const rowEntities = await this.extractFromText(
        documentId,
        rowText,
        `table-${table.id}-row-${i}`,
        jurisdiction,
      );
      entities.push(...rowEntities);
    }

    return entities;
  }

  /**
   * Enhance entities from content extractor with additional attributes
   */
  private async enhanceExtractedEntities(
    documentId: string,
    extractedEntities: any[],
    jurisdiction: string,
  ): Promise<KnowledgeGraphEntity[]> {
    const enhanced: KnowledgeGraphEntity[] = [];

    for (const extractedEntity of extractedEntities) {
      const entity: KnowledgeGraphEntity = {
        id: this.generateEntityId(extractedEntity.name, extractedEntity.type),
        type: this.mapEntityType(extractedEntity.type),
        name: extractedEntity.name,
        aliases: extractedEntity.aliases || [],
        attributes: {
          ...extractedEntity.metadata,
          originalConfidence: extractedEntity.confidence,
        },
        confidence: extractedEntity.confidence,
        source: {
          documentId,
          textContext: extractedEntity.context || "",
          extractionMethod: "ai",
        },
        jurisdiction,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      enhanced.push(entity);
    }

    return enhanced;
  }

  /**
   * Extract temporal entities (dates, periods, deadlines)
   */
  private extractTemporalEntities(
    text: string,
    documentId: string,
    sectionId: string,
    jurisdiction: string,
  ): KnowledgeGraphEntity[] {
    const entities: KnowledgeGraphEntity[] = [];

    // Date patterns
    const datePatterns = [
      /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g, // MM/DD/YYYY
      /\b(\d{4}-\d{2}-\d{2})\b/g, // YYYY-MM-DD
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi,
    ];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const entity: KnowledgeGraphEntity = {
          id: this.generateEntityId(match[0], "date"),
          type: "date",
          name: match[0],
          aliases: [],
          attributes: {
            parsedDate: this.parseDate(match[0]),
            format: this.detectDateFormat(match[0]),
          },
          confidence: 0.9,
          source: {
            documentId,
            sectionId,
            textContext: match[0],
            extractionMethod: "regex",
          },
          temporalInfo: {
            mentionedAt: new Date().toISOString(),
          },
          jurisdiction,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Create entity from pattern match
   */
  private createEntityFromMatch(
    match: string,
    type: EntityType,
    pattern: EntityPattern,
    documentId: string,
    sectionId: string,
    position: number,
    text: string,
    jurisdiction: string,
  ): KnowledgeGraphEntity | null {
    if (!match || match.length < 2) return null;

    const contextStart = Math.max(0, position - 50);
    const contextEnd = Math.min(text.length, position + match.length + 50);
    const textContext = text.substring(contextStart, contextEnd);

    const entity: KnowledgeGraphEntity = {
      id: this.generateEntityId(match, type),
      type,
      name: match.trim(),
      aliases: [],
      attributes: {
        ...pattern.attributes,
        position,
        length: match.length,
      },
      confidence: pattern.confidence,
      source: {
        documentId,
        sectionId,
        textContext,
        extractionMethod: "regex",
      },
      jurisdiction,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return entity;
  }

  /**
   * Deduplicate entities using name matching and fuzzy matching
   */
  private async deduplicateEntities(
    entities: KnowledgeGraphEntity[],
  ): Promise<KnowledgeGraphEntity[]> {
    if (!this.config.entityExtraction.enableDisambiguation) {
      return entities;
    }

    const deduplicated: KnowledgeGraphEntity[] = [];
    const seen = new Map<string, KnowledgeGraphEntity>();

    for (const entity of entities) {
      const normalizedName = this.normalizeEntityName(entity.name);
      const key = `${entity.type}:${normalizedName}`;

      if (seen.has(key)) {
        // Merge with existing entity
        const existing = seen.get(key)!;
        existing.aliases.push(entity.name);
        existing.confidence = Math.max(existing.confidence, entity.confidence);

        // Merge attributes
        Object.assign(existing.attributes, entity.attributes);

        // Update with most recent source
        if (
          new Date(entity.source.textContext) >
          new Date(existing.source.textContext)
        ) {
          existing.source = entity.source;
        }

        existing.updatedAt = new Date().toISOString();
      } else {
        seen.set(key, entity);
        deduplicated.push(entity);
      }
    }

    return deduplicated;
  }

  /**
   * Initialize entity extraction patterns
   */
  private initializePatterns(): void {
    // Financial institutions
    this.patterns.set("financial_institution", [
      {
        patterns: [
          /\b(Bank|Credit Union|Financial Institution)\s+of\s+([A-Z][a-z\s]+)\b/g,
        ],
        confidence: 0.8,
      },
      { patterns: [/\b([A-Z][a-z\s]+Bank)\b/g], confidence: 0.7 },
      { patterns: [/\b([A-Z][a-z\s]+Credit\s+Union)\b/g], confidence: 0.7 },
    ]);

    // Regulatory bodies
    this.patterns.set("regulatory_body", [
      { patterns: [/\b(Federal Reserve|SEC|FINCEN|OCC)\b/g], confidence: 0.9 },
      {
        patterns: [/\b(Consumer Financial Protection Bureau|CFPB)\b/g],
        confidence: 0.9,
      },
      {
        patterns: [/\b(Financial Crimes Enforcement Network)\b/g],
        confidence: 0.8,
      },
    ]);

    // Regulations
    this.patterns.set("regulation", [
      { patterns: [/\b(Bank Secrecy Act|BSA)\b/g], confidence: 0.9 },
      { patterns: [/\b(Patriot Act|USA PATRIOT Act)\b/g], confidence: 0.9 },
      { patterns: [/\b(Anti-Money Laundering|AML)\b/g], confidence: 0.8 },
    ]);

    // Risk factors
    this.patterns.set("risk_factor", [
      {
        patterns: [/\b(money laundering|terrorist financing|fraud)\b/gi],
        confidence: 0.8,
      },
      {
        patterns: [/\b(suspicious activity|unusual transaction)\b/gi],
        confidence: 0.7,
      },
    ]);

    // Transaction types
    this.patterns.set("transaction_type", [
      {
        patterns: [
          /\b(wire transfer|electronic fund transfer|ACH transaction)\b/gi,
        ],
        confidence: 0.8,
      },
      {
        patterns: [/\b(cash transaction|currency transaction|CTR)\b/gi],
        confidence: 0.7,
      },
    ]);

    // Account types
    this.patterns.set("account_type", [
      {
        patterns: [/\b(checking account|savings account|business account)\b/gi],
        confidence: 0.7,
      },
      {
        patterns: [/\b(trust account|escrow account|custodial account)\b/gi],
        confidence: 0.7,
      },
    ]);
  }

  /**
   * Generate unique entity ID
   */
  private generateEntityId(name: string, type: EntityType): string {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const hash = this.simpleHash(name + type);
    return `${type}-${normalizedName}-${hash}`;
  }

  /**
   * Normalize entity name for deduplication
   */
  private normalizeEntityName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(the|and|of|in|for|to|with|by)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
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
   * Map extracted entity type to knowledge graph type
   */
  private mapEntityType(extractedType: string): EntityType {
    const typeMap: Record<string, EntityType> = {
      organization: "organization",
      person: "person",
      location: "location",
      regulation: "regulation",
      requirement: "requirement",
      date: "date",
      amount: "metric",
    };

    return typeMap[extractedType.toLowerCase()] || "concept";
  }

  /**
   * Group entities by type for analytics
   */
  private groupEntitiesByType(
    entities: KnowledgeGraphEntity[],
  ): Record<EntityType, number> {
    const groups: Record<string, number> = {};

    for (const entity of entities) {
      groups[entity.type] = (groups[entity.type] || 0) + 1;
    }

    return groups as Record<EntityType, number>;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(entities: KnowledgeGraphEntity[]): number {
    if (entities.length === 0) return 0;

    const totalConfidence = entities.reduce(
      (sum, entity) => sum + entity.confidence,
      0,
    );
    return totalConfidence / entities.length;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date | null {
    try {
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  /**
   * Detect date format
   */
  private detectDateFormat(dateStr: string): string {
    if (dateStr.includes("/")) return "MM/DD/YYYY";
    if (dateStr.includes("-")) return "YYYY-MM-DD";
    if (dateStr.match(/[A-Za-z]/)) return "textual";
    return "unknown";
  }

  /**
   * Get entity extraction statistics
   */
  getExtractionStats(): {
    patternCount: number;
    cachedEntities: number;
    supportedTypes: EntityType[];
  } {
    const patternCount = Array.from(this.patterns.values()).reduce(
      (total, patterns) => total + patterns.length,
      0,
    );

    return {
      patternCount,
      cachedEntities: this.entityCache.size,
      supportedTypes: Array.from(this.patterns.keys()),
    };
  }
}
