export interface ExtractedContent {
  text: string;
  tables: ExtractedTable[];
  figures: ExtractedFigure[];
  metadata: DocumentMetadata;
  entities: ExtractedEntity[];
  crossReferences: CrossReference[];
  confidence: number;
  processingTime: number;
}

export interface ExtractedTable {
  id: string;
  title?: string;
  headers: string[];
  rows: string[][];
  confidence: number;
  location: {
    page: number;
    position: { x: number; y: number; width: number; height: number; };
  };
}

export interface ExtractedFigure {
  id: string;
  title?: string;
  description: string;
  type: "chart" | "graph" | "diagram" | "image";
  confidence: number;
  location: {
    page: number;
    position: { x: number; y: number; width: number; height: number; };
  };
}

export interface DocumentMetadata {
  title: string;
  author?: string;
  publicationDate?: string;
  documentType: string;
  language: string;
  pageCount: number;
  wordCount: number;
  confidence: number;
}

export interface ExtractedEntity {
  text: string;
  type: "LegalEntity" | "Organization" | "Date" | "Amount" | "Jurisdiction" | "Regulation";
  confidence: number;
  location: {
    page: number;
    startPosition: number;
    endPosition: number;
  };
}

export interface CrossReference {
  sourceId: string;
  targetId: string;
  type: "supersedes" | "references" | "amends" | "relates_to";
  confidence: number;
  context: string;
}

export interface ContentExtractionConfig {
  enableTableExtraction: boolean;
  enableFigureExtraction: boolean;
  enableEntityRecognition: boolean;
  enableCrossReferenceDetection: boolean;
  confidenceThreshold: number;
  maxProcessingTime: number;
}

export class ContentExtractor {
  private ai: any;
  private config: ContentExtractionConfig;
  private logger: any;

  constructor(ai: any, logger: any, config: ContentExtractionConfig = ContentExtractor.defaultConfig()) {
    this.ai = ai;
    this.logger = logger;
    this.config = config;
  }

  async extractContent(documentId: string, content: string, metadata: any): Promise<ExtractedContent> {
    const startTime = Date.now();
    
    this.logger?.info("Starting AI content extraction", { documentId });
    
    try {
      const text = await this.extractTextContent(content);
      const tables = this.config.enableTableExtraction ? await this.extractTables(content) : [];
      const figures = this.config.enableFigureExtraction ? await this.extractFigures(content) : [];
      const entities = this.config.enableEntityRecognition ? await this.extractEntities(text, metadata) : [];
      const crossReferences = this.config.enableCrossReferenceDetection ? await this.detectCrossReferences(text, entities) : [];
      const documentMetadata = await this.generateMetadata(content, metadata);
      const confidence = this.calculateOverallConfidence(text, tables, figures, entities, crossReferences);
      const processingTime = Date.now() - startTime;
      
      const result: ExtractedContent = {
        text,
        tables,
        figures,
        metadata: documentMetadata,
        entities,
        crossReferences,
        confidence,
        processingTime
      };
      
      this.logger?.info("AI content extraction completed", {
        documentId,
        processingTime,
        confidence,
        entitiesFound: entities.length,
        tablesFound: tables.length,
        figuresFound: figures.length
      });
      
      return result;
      
    } catch (error) {
      this.logger?.error("AI content extraction failed", { documentId, error: error.message });
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }

  private async extractTextContent(content: string): Promise<string> {
    try {
      if (this.ai && this.ai.run) {
        const result = await this.ai.run("@cf/unrealistic/text-extraction", { content });
        return result.text || content;
      }
      
      return this.cleanTextContent(content);
      
    } catch (error) {
      this.logger?.warn("AI text extraction failed, using fallback", { error: error.message });
      return this.cleanTextContent(content);
    }
  }

  private cleanTextContent(content: string): string {
    return content
      .replace(/\s+/g, " ")
      .replace(/[\r\n]+/g, " ")
      .replace(/[\t\f\v]/g, " ")
      .trim();
  }

  private async extractTables(content: string): Promise<ExtractedTable[]> {
    try {
      if (this.ai && this.ai.run) {
        const result = await this.ai.run("@cf/unrealistic/table-extraction", { content });
        return result.tables || [];
      }
      
      return this.extractTablesWithRegex(content);
      
    } catch (error) {
      this.logger?.warn("AI table extraction failed, using fallback", { error: error.message });
      return this.extractTablesWithRegex(content);
    }
  }

  private async extractFigures(content: string): Promise<ExtractedFigure[]> {
    try {
      if (this.ai && this.ai.run) {
        const result = await this.ai.run("@cf/unrealistic/figure-extraction", { content });
        return result.figures || [];
      }
      
      return this.extractFiguresWithRegex(content);
      
    } catch (error) {
      this.logger?.warn("AI figure extraction failed, using fallback", { error: error.message });
      return this.extractFiguresWithRegex(content);
    }
  }

  private async extractEntities(text: string, metadata: any): Promise<ExtractedEntity[]> {
    try {
      if (this.ai && this.ai.run) {
        const result = await this.ai.run("@cf/unrealistic/entity-recognition", { text, context: metadata });
        return result.entities || [];
      }
      
      return this.extractEntitiesWithPatterns(text);
      
    } catch (error) {
      this.logger?.warn("AI entity extraction failed, using fallback", { error: error.message });
      return this.extractEntitiesWithPatterns(text);
    }
  }

  private async detectCrossReferences(text: string, entities: ExtractedEntity[]): Promise<CrossReference[]> {
    try {
      if (this.ai && this.ai.run) {
        const result = await this.ai.run("@cf/unrealistic/cross-reference-detection", { text, entities });
        return result.crossReferences || [];
      }
      
      return this.detectCrossReferencesWithPatterns(text, entities);
      
    } catch (error) {
      this.logger?.warn("AI cross-reference detection failed, using fallback", { error: error.message });
      return this.detectCrossReferencesWithPatterns(text, entities);
    }
  }

  private async generateMetadata(content: string, existingMetadata: any): Promise<DocumentMetadata> {
    try {
      const title = this.extractTitle(content, existingMetadata);
      const wordCount = content.split(/\s+/).length;
      const pageCount = Math.ceil(content.length / 2000);
      const language = this.detectLanguage(content);
      
      return {
        title,
        author: existingMetadata.author,
        publicationDate: existingMetadata.publicationDate,
        documentType: existingMetadata.documentType || "unknown",
        language,
        pageCount,
        wordCount,
        confidence: 0.9
      };
      
    } catch (error) {
      this.logger?.error("Metadata generation failed", { error: error.message });
      throw error;
    }
  }

  private calculateOverallConfidence(text: string, tables: ExtractedTable[], figures: ExtractedFigure[], entities: ExtractedEntity[], crossReferences: CrossReference[]): number {
    const textConfidence = 0.95;
    const tableConfidence = tables.length > 0 ? tables.reduce((sum, t) => sum + t.confidence, 0) / tables.length : 0;
    const figureConfidence = figures.length > 0 ? figures.reduce((sum, f) => sum + f.confidence, 0) / figures.length : 0;
    const entityConfidence = entities.length > 0 ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length : 0;
    const refConfidence = crossReferences.length > 0 ? crossReferences.reduce((sum, r) => sum + r.confidence, 0) / crossReferences.length : 0;
    
    const weights = { text: 0.4, tables: 0.2, figures: 0.15, entities: 0.15, references: 0.1 };
    
    return (
      textConfidence * weights.text +
      tableConfidence * weights.tables +
      figureConfidence * weights.figures +
      entityConfidence * weights.entities +
      refConfidence * weights.references
    );
  }

  private extractTablesWithRegex(content: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];
    const tableRegex = /\|.*\|/g;
    let match;
    let tableId = 1;
    
    while ((match = tableRegex.exec(content)) !== null) {
      const cells = match[0].split("|").filter(cell => cell.trim());
      tables.push({
        id: `table_${tableId++}`,
        headers: cells.slice(0, 3),
        rows: [cells],
        confidence: 0.6,
        location: { page: 1, position: { x: 0, y: 0, width: 0, height: 0 } }
      });
    }
    
    return tables;
  }

  private extractFiguresWithRegex(content: string): ExtractedFigure[] {
    const figures: ExtractedFigure[] = [];
    const figureRegex = /(Figure|Chart|Diagram|Graph)\s+\d+/gi;
    let match;
    let figureId = 1;
    
    while ((match = figureRegex.exec(content)) !== null) {
      figures.push({
        id: `figure_${figureId++}`,
        title: match[0],
        description: `Extracted ${match[0]}`,
        type: "chart",
        confidence: 0.5,
        location: { page: 1, position: { x: 0, y: 0, width: 0, height: 0 } }
      });
    }
    
    return figures;
  }

  private extractEntitiesWithPatterns(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    const dateRegex = /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/g;
    let match;
    while ((match = dateRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: "Date",
        confidence: 0.8,
        location: { page: 1, startPosition: match.index, endPosition: match.index + match[0].length }
      });
    }
    
    const amountRegex = /\$\d{1,3}(,\d{3})*(\.\d{2})?/g;
    while ((match = amountRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: "Amount",
        confidence: 0.9,
        location: { page: 1, startPosition: match.index, endPosition: match.index + match[0].length }
      });
    }
    
    return entities;
  }

  private detectCrossReferencesWithPatterns(text: string, entities: ExtractedEntity[]): CrossReference[] {
    const references: CrossReference[] = [];
    const refRegex = /(see|refer to|as amended by|supersedes)\s+([A-Z]+-\d+-\d+)/gi;
    let match;
    
    while ((match = refRegex.exec(text)) !== null) {
      references.push({
        sourceId: "current",
        targetId: match[2],
        type: "references",
        confidence: 0.6,
        context: match[0]
      });
    }
    
    return references;
  }

  private extractTitle(content: string, metadata: any): string {
    if (metadata.title) return metadata.title;
    
    const lines = content.split("\n").filter(line => line.trim());
    for (const line of lines.slice(0, 5)) {
      if (line.length < 100 && line.match(/^[A-Z][a-z]/)) {
        return line.trim();
      }
    }
    
    return "Untitled Document";
  }

  private detectLanguage(content: string): string {
    const englishWords = ["the", "and", "or", "but", "in", "on", "at", "to", "for", "of"];
    const words = content.toLowerCase().split(/\s+/).slice(0, 100);
    const englishCount = words.filter(word => englishWords.includes(word)).length;
    
    return englishCount > 10 ? "en" : "unknown";
  }

  static defaultConfig(): ContentExtractionConfig {
    return {
      enableTableExtraction: true,
      enableFigureExtraction: true,
      enableEntityRecognition: true,
      enableCrossReferenceDetection: true,
      confidenceThreshold: 0.7,
      maxProcessingTime: 30
    };
  }
}
