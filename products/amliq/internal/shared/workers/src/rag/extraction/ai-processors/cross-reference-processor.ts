export class CrossReferenceProcessor {
  private ai: any;
  private logger: any;

  constructor(ai: any, logger: any) {
    this.ai = ai;
    this.logger = logger;
  }

  async detectCrossReferences(text: string, entities: any[]): Promise<any[]> {
    try {
      if (this.ai?.run) {
        const result = await this.ai.run("@cf/unrealistic/cross-reference-detection", { 
          text,
          entities,
          context: {
            documentType: "regulatory",
            referenceTypes: ["supersedes", "references", "amends", "relates_to", "implements"]
          }
        });
        return result.crossReferences || [];
      }
      
      return this.fallbackCrossReferenceDetection(text, entities);
    } catch (error) {
      this.logger?.warn("AI cross-reference processing failed", { error: error.message });
      return this.fallbackCrossReferenceDetection(text, entities);
    }
  }

  private fallbackCrossReferenceDetection(text: string, entities: any[]): any[] {
    const references = [];
    
    // Pattern for regulatory references
    const referencePatterns = [
      {
        type: "supersedes",
        pattern: /supersedes?\s+([A-Z]+-\d+-\d+)/gi,
        confidence: 0.8
      },
      {
        type: "references", 
        pattern: /(?:refer to|reference|see)\s+([A-Z]+-\d+-\d+)/gi,
        confidence: 0.7
      },
      {
        type: "amends",
        pattern: /amend(?:s|ed)?\s+([A-Z]+-\d+-\d+)/gi,
        confidence: 0.8
      },
      {
        type: "implements",
        pattern: /implement(?:s|ed)?\s+([A-Z]+-\d+-\d+)/gi,
        confidence: 0.75
      },
      {
        type: "relates_to",
        pattern: /(?:relate[sd]? to|pertain[s]? to)\s+([A-Z]+-\d+-\d+)/gi,
        confidence: 0.6
      }
    ];

    for (const pattern of referencePatterns) {
      let match;
      const regex = new RegExp(pattern.pattern);
      
      while ((match = regex.exec(text)) !== null) {
        references.push({
          sourceId: "current",
          targetId: match[1],
          type: pattern.type,
          confidence: pattern.confidence,
          context: match[0],
          location: {
            startPosition: match.index,
            endPosition: match.index + match[0].length
          }
        });
      }
    }

    // Filter and validate references
    return references.filter(ref => this.validateReference(ref, entities));
  }

  private validateReference(reference: any, entities: any[]): boolean {
    // Ensure target reference exists in entities or is properly formatted
    if (reference.type === "supersedes" || reference.type === "amends") {
      return reference.targetId.match(/^[A-Z]+-\d+-\d+$/);
    }

    return reference.confidence > 0.6;
  }

  // Build relationship graph from references
  buildRelationshipGraph(references: any[]): any {
    const graph = {
      nodes: new Set(),
      edges: []
    };

    references.forEach(ref => {
      graph.nodes.add(ref.sourceId);
      graph.nodes.add(ref.targetId);
      
      graph.edges.push({
        source: ref.sourceId,
        target: ref.targetId,
        type: ref.type,
        confidence: ref.confidence,
        context: ref.context
      });
    });

    return {
      nodes: Array.from(graph.nodes),
      edges: graph.edges
    };
  }
}
