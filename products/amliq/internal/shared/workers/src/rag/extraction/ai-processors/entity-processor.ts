export interface EntityPattern {
  type: "LegalEntity" | "Organization" | "Date" | "Amount" | "Jurisdiction" | "Regulation";
  regex: RegExp;
  confidence: number;
}

export class EntityProcessor {
  private ai: any;
  private logger: any;
  private patterns: EntityPattern[];

  constructor(ai: any, logger: any) {
    this.ai = ai;
    this.logger = logger;
    this.patterns = this.initializePatterns();
  }

  async extractEntities(text: string, context?: any): Promise<any[]> {
    try {
      if (this.ai?.run) {
        const result = await this.ai.run("@cf/unrealistic/entity-recognition", { 
          text,
          context: {
            documentType: context?.documentType,
            jurisdiction: context?.jurisdiction,
            industry: "financial"
          }
        });
        return result.entities || [];
      }
      
      return this.fallbackEntityExtraction(text);
    } catch (error) {
      this.logger?.warn("AI entity processing failed", { error: error.message });
      return this.fallbackEntityExtraction(text);
    }
  }

  private fallbackEntityExtraction(text: string): any[] {
    const entities = [];

    for (const pattern of this.patterns) {
      let match;
      const regex = new RegExp(pattern.regex);
      
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type: pattern.type,
          confidence: pattern.confidence,
          location: {
            page: 1,
            startPosition: match.index,
            endPosition: match.index + match[0].length
          }
        });
      }
    }

    return entities;
  }

  private initializePatterns(): EntityPattern[] {
    return [
      // Legal entities
      {
        type: "LegalEntity",
        regex: /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+(?:Inc\.|LLC|Corp\.|Ltd\.|Co\.|PLC|AG|GmbH|S\.A\.|S\.p\.A\.)/g,
        confidence: 0.9
      },
      // Organizations
      {
        type: "Organization",
        regex: /(?:SEC|FDA|CFPB|OCC|Federal Reserve|FINRA|NYSE|NASDAQ|Fannie Mae|Freddie Mac)/g,
        confidence: 0.95
      },
      // Dates
      {
        type: "Date",
        regex: /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/gi,
        confidence: 0.85
      },
      // Amounts
      {
        type: "Amount",
        regex: /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s+(?:USD|EUR|GBP|JPY|CAD|AUD)/gi,
        confidence: 0.9
      },
      // Jurisdictions
      {
        type: "Jurisdiction",
        regex: /(?:United States|U\.S\.|US|European Union|EU|United Kingdom|UK|Canada|California|New York|Delaware)/gi,
        confidence: 0.8
      },
      // Regulations
      {
        type: "Regulation",
        regex: /(?:[A-Z]+-\d+-\d+|17\s+CFR\s+\d+|12\s+CFR\s+\d+|Regulation\s+[A-Z]|Rule\s+\d+[a-z]?)/g,
        confidence: 0.85
      }
    ];
  }

  // Enhanced entity validation
  validateEntity(entity: any, context: any): boolean {
    // Additional validation logic based on context
    if (entity.type === "Amount" && context?.documentType === "regulation") {
      // Regulations often reference monetary thresholds
      return entity.confidence > 0.8;
    }

    if (entity.type === "Regulation" && context?.jurisdiction) {
      // Ensure regulation matches expected format for jurisdiction
      return entity.text.match(/^[A-Z]+-\d+-\d+$/);
    }

    return entity.confidence > 0.7;
  }
}
