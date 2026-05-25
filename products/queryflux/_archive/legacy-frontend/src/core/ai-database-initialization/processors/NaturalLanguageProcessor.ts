/**
 * Natural Language Processor for Database Initialization
 *
 * This component processes natural language descriptions to understand
 * database requirements, preferences, and constraints using advanced
 * NLP techniques and domain-specific knowledge.
 */

import {
  NaturalLanguageAnalysis,
  ExtractedEntity,
  ExtractedConstraint,
  ExtractedRequirement,
  AnalysisContext,
  AIDatabaseInitializationConfig,
} from "../types";

export class NaturalLanguageProcessor {
  private config: AIDatabaseInitializationConfig;
  private domainKeywords: Map<string, string[]>;
  private performanceIndicators: Map<string, number>;
  private scaleIndicators: Map<string, string>;
  private complianceKeywords: Map<string, string[]>;

  constructor(config: AIDatabaseInitializationConfig) {
    this.config = config;
    this.initializeKeywordMaps();
  }

  /**
   * Main analysis method
   */
  async analyze(text: string): Promise<NaturalLanguageAnalysis> {
    const cleanedText = this.preprocessText(text);
    const entities = await this.extractEntities(cleanedText);
    const constraints = await this.extractConstraints(cleanedText);
    const requirements = await this.extractRequirements(cleanedText);
    const context = await this.analyzeContext(cleanedText);
    const intent = await this.determineIntent(cleanedText, entities);
    const confidence = this.calculateConfidence(
      entities,
      constraints,
      requirements,
    );

    return {
      input: text,
      intent,
      entities,
      constraints,
      requirements,
      context,
      confidence,
    };
  }

  /**
   * Preprocess and clean the input text
   */
  private preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s.,!?-]/g, " ") // Remove special characters except punctuation
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Extract entities from the text
   */
  private async extractEntities(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    const words = text.split(/\s+/);

    // Extract database types
    this.domainKeywords.forEach((keywords, type) => {
      keywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        let match;
        while ((match = regex.exec(text)) !== null) {
          entities.push({
            type: "database_type",
            value: keyword,
            confidence: 0.9,
            startPosition: match.index,
            endPosition: match.index + match[0].length,
            synonyms: this.getSynonyms(keyword),
          });
        }
      });
    });

    // Extract performance requirements
    this.performanceIndicators.forEach((indicator, pattern) => {
      const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: "performance",
          value: match[0],
          confidence: 0.8,
          startPosition: match.index,
          endPosition: match.index + match[0].length,
          synonyms: [],
        });
      }
    });

    // Extract scale requirements
    this.scaleIndicators.forEach((scale, pattern) => {
      const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        entities.push({
          type: "scale",
          value: match[0],
          confidence: 0.8,
          startPosition: match.index,
          endPosition: match.index + match[0].length,
          synonyms: [],
        });
      }
    });

    // Extract budget constraints
    const budgetRegex =
      /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(k|m|b)?\s*(?:per\s)?(month|year|annual|monthly)?/gi;
    let match;
    while ((match = budgetRegex.exec(text)) !== null) {
      entities.push({
        type: "budget",
        value: match[0],
        confidence: 0.9,
        startPosition: match.index,
        endPosition: match.index + match[0].length,
        synonyms: [],
      });
    }

    // Extract compliance requirements
    this.complianceKeywords.forEach((keywords, standard) => {
      keywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        let match;
        while ((match = regex.exec(text)) !== null) {
          entities.push({
            type: "compliance",
            value: keyword,
            confidence: 0.85,
            startPosition: match.index,
            endPosition: match.index + match[0].length,
            synonyms: [],
          });
        }
      });
    });

    return this.deduplicateEntities(entities);
  }

  /**
   * Extract constraints from the text
   */
  private async extractConstraints(
    text: string,
  ): Promise<ExtractedConstraint[]> {
    const constraints: ExtractedConstraint[] = [];

    // Performance constraints
    const performancePatterns = [
      /(?:must|should|need to|has to)\s+(?:handle|support|process)\s+(?:up to|at least|over|more than)\s+(\d+)\s+(?:requests|queries|operations|users)/gi,
      /(?:response|latency|load)\s+(?:time|delay)\s+(?:must|should|needs to)\s+(?:be|stay)\s+(?:under|below|less than)\s+(\d+)\s*(?:ms|milliseconds|seconds?)/gi,
      /(?:uptime|availability)\s+(?:must|should|needs to)\s+(?:be|stay)\s+(\d+(?:\.\d+)?)\s*%/gi,
    ];

    performancePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        constraints.push({
          type: "performance",
          description: match[0],
          priority: "high",
          measurable: true,
          verificationCriteria: [this.generateVerificationCriteria(match[0])],
        });
      }
    });

    // Security constraints
    const securityPatterns = [
      /(?:must|should|need to)\s+(?:be|ensure)\s+(?:secure|encrypted|protected|private|confidential)/gi,
      /(?: gdpr|hipaa|sox|pci-dss|ccpa )/gi,
      /(?:data|information)\s+(?:must|should|needs to)\s+(?:be|remain)\s+(?:private|confidential|secure)/gi,
    ];

    securityPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        constraints.push({
          type: "compliance",
          description: match[0],
          priority: "critical",
          measurable: false,
          verificationCriteria: [
            "Security audit required",
            "Compliance review needed",
          ],
        });
      }
    });

    // Business constraints
    const businessPatterns = [
      /(?:budget|cost)\s+(?:limit|constraint|restriction)/gi,
      /(?:must|should|need to)\s+(?:fit|work)\s+(?:within|under)\s+(?:budget|cost)/gi,
      /(?:deadline|timeline)\s+(?:must|should|needs to)\s+(?:be|stay)\s+(?:within|under)/gi,
    ];

    businessPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        constraints.push({
          type: "business",
          description: match[0],
          priority: "medium",
          measurable: true,
          verificationCriteria: ["Budget review", "Timeline verification"],
        });
      }
    });

    return constraints;
  }

  /**
   * Extract requirements from the text
   */
  private async extractRequirements(
    text: string,
  ): Promise<ExtractedRequirement[]> {
    const requirements: ExtractedRequirement[] = [];

    // Performance requirements
    const perfRequirements = [
      {
        pattern:
          /(?:support|handle|process)\s+(?:up to|at least|over)\s+(\d+)\s+(?:users|requests|queries|operations)/gi,
        category: "performance" as const,
        metric: "throughput",
        unit: "requests/second",
      },
      {
        pattern:
          /(?:response|latency)\s+(?:time|delay)\s+(?:under|below|less than)\s+(\d+)\s*(?:ms|milliseconds)/gi,
        category: "performance" as const,
        metric: "latency",
        unit: "milliseconds",
      },
      {
        pattern: /(?:uptime|availability)\s+(\d+(?:\.\d+)?)\s*%/gi,
        category: "availability" as const,
        metric: "availability",
        unit: "percentage",
      },
    ];

    perfRequirements.forEach((req) => {
      let match;
      while ((match = req.pattern.exec(text)) !== null) {
        requirements.push({
          category: req.category,
          description: match[0],
          metric: req.metric,
          target: parseFloat(match[1]),
          unit: req.unit,
          priority: this.inferPriority(match[0]),
        });
      }
    });

    // Scalability requirements
    const scaleRequirements = [
      {
        pattern:
          /(?:scale|grow|expand)\s+(?:to|up to)\s+(\d+)\s+(?:users|customers|records)/gi,
        category: "scalability" as const,
      },
      {
        pattern:
          /(?:handle|support)\s+(\d+)\s*(?:million|billion|thousand)?\s+(?:users|customers|records|rows)/gi,
        category: "scalability" as const,
      },
    ];

    scaleRequirements.forEach((req) => {
      let match;
      while ((match = req.pattern.exec(text)) !== null) {
        const value = parseFloat(match[1]);
        const multiplier = this.extractMultiplier(text, match.index);

        requirements.push({
          category: req.category,
          description: match[0],
          metric: "max_capacity",
          target: value * multiplier,
          unit: "records",
          priority: "high",
        });
      }
    });

    // Security requirements
    if (/gdpr|hipaa|sox|pci-dss|ccpa|compliance/i.test(text)) {
      requirements.push({
        category: "compliance",
        description: "Must comply with relevant regulations",
        priority: "critical",
      });
    }

    // Cost requirements
    const budgetMatch = text.match(
      /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(k|m|b)?\s*(?:per\s)?(month|year|annual|monthly)?/i,
    );
    if (budgetMatch) {
      const amount = parseFloat(budgetMatch[1].replace(/,/g, ""));
      const multiplier = this.getBudgetMultiplier(budgetMatch[2]);
      const period = budgetMatch[3] || "month";

      requirements.push({
        category: "cost",
        description: `Budget constraint: ${budgetMatch[0]}`,
        metric: "monthly_cost",
        target: (amount * multiplier) / (period.includes("year") ? 12 : 1),
        unit: "USD",
        priority: "high",
      });
    }

    return requirements;
  }

  /**
   * Analyze context from the text
   */
  private async analyzeContext(text: string): Promise<AnalysisContext> {
    // Domain detection
    let domain: AnalysisContext["domain"] = "enterprise";
    const domainPatterns = {
      ecommerce: [
        "ecommerce",
        "shopping",
        "cart",
        "product",
        "order",
        "payment",
      ],
      healthcare: [
        "healthcare",
        "medical",
        "patient",
        "hospital",
        "clinical",
        "diagnosis",
      ],
      finance: [
        "finance",
        "financial",
        "banking",
        "payment",
        "transaction",
        "investment",
      ],
      iot: ["iot", "sensor", "device", "telemetry", "smart", "connected"],
      analytics: [
        "analytics",
        "data",
        "insights",
        "reporting",
        "dashboard",
        "metrics",
      ],
      social: ["social", "users", "posts", "comments", "likes", "followers"],
      content: ["content", "cms", "articles", "media", "files", "documents"],
      gaming: [
        "gaming",
        "game",
        "player",
        "score",
        "leaderboard",
        "multiplayer",
      ],
    };

    for (const [dom, keywords] of Object.entries(domainPatterns)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        domain = dom as AnalysisContext["domain"];
        break;
      }
    }

    // Scale detection
    let scale: AnalysisContext["scale"] = "medium";
    const scalePatterns = {
      personal: ["personal", "individual", "solo"],
      small_business: ["small business", "startup", "small team"],
      startup: ["startup", "new company", "early stage"],
      medium: ["medium", "mid-size", "growing"],
      large: ["large", "enterprise", "big company"],
      enterprise: ["enterprise", "fortune", "multinational", "global"],
    };

    for (const [sc, patterns] of Object.entries(scalePatterns)) {
      if (patterns.some((pattern) => text.includes(pattern))) {
        scale = sc as AnalysisContext["scale"];
        break;
      }
    }

    // Team size detection
    let teamSize: AnalysisContext["teamSize"] = "small";
    const teamSizeMatch = text.match(
      /(\d+)\s*(?:people|person|team|developers|engineers)/i,
    );
    if (teamSizeMatch) {
      const size = parseInt(teamSizeMatch[1]);
      if (size <= 3) teamSize = "solo";
      else if (size <= 10) teamSize = "small";
      else if (size <= 50) teamSize = "medium";
      else teamSize = "large";
    }

    // Budget level detection
    let budgetLevel: AnalysisContext["budgetLevel"] = "growth";
    const budgetMatch = text.match(
      /\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(k|m|b)?/i,
    );
    if (budgetMatch) {
      const amount = parseFloat(budgetMatch[1].replace(/,/g, ""));
      const multiplier = this.getBudgetMultiplier(budgetMatch[2]);
      const totalBudget = amount * multiplier;

      if (totalBudget < 1000) budgetLevel = "bootstrap";
      else if (totalBudget < 10000) budgetLevel = "seed";
      else if (totalBudget < 100000) budgetLevel = "growth";
      else if (totalBudget < 1000000) budgetLevel = "established";
      else budgetLevel = "enterprise";
    }

    // Time to market detection
    let timeToMarket: AnalysisContext["timeToMarket"] = "normal";
    const timePatterns = {
      urgent: ["urgent", "asap", "immediately", "rush", "emergency"],
      soon: ["soon", "quickly", "fast", "short timeline"],
      normal: ["normal", "standard", "regular"],
      flexible: ["flexible", "when ready", "no rush", "eventually"],
    };

    for (const [time, patterns] of Object.entries(timePatterns)) {
      if (patterns.some((pattern) => text.includes(pattern))) {
        timeToMarket = time as AnalysisContext["timeToMarket"];
        break;
      }
    }

    return {
      domain,
      scale,
      technicalStack: this.extractTechnicalStack(text),
      teamSize,
      budgetLevel,
      timeToMarket,
    };
  }

  /**
   * Determine the user's intent
   */
  private async determineIntent(
    text: string,
    entities: ExtractedEntity[],
  ): Promise<NaturalLanguageAnalysis["intent"]> {
    const createKeywords = [
      "create",
      "setup",
      "build",
      "design",
      "start",
      "new",
      "fresh",
    ];
    const migrateKeywords = [
      "migrate",
      "move",
      "transfer",
      "import",
      "convert",
    ];
    const optimizeKeywords = [
      "optimize",
      "improve",
      "enhance",
      "better",
      "faster",
    ];
    const analyzeKeywords = [
      "analyze",
      "understand",
      "review",
      "examine",
      "check",
    ];

    const createCount = createKeywords.filter((keyword) =>
      text.includes(keyword),
    ).length;
    const migrateCount = migrateKeywords.filter((keyword) =>
      text.includes(keyword),
    ).length;
    const optimizeCount = optimizeKeywords.filter((keyword) =>
      text.includes(keyword),
    ).length;
    const analyzeCount = analyzeKeywords.filter((keyword) =>
      text.includes(keyword),
    ).length;

    const counts = {
      create: createCount,
      migrate: migrateCount,
      optimize: optimizeCount,
      analyze: analyzeCount,
    };
    const maxCount = Math.max(...Object.values(counts));

    if (maxCount === 0) return "design_from_scratch";

    const intent = Object.entries(counts).find(
      ([_, count]) => count === maxCount,
    )?.[0];
    return (
      (intent as NaturalLanguageAnalysis["intent"]) || "design_from_scratch"
    );
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    entities: ExtractedEntity[],
    constraints: ExtractedConstraint[],
    requirements: ExtractedRequirement[],
  ): number {
    const entityConfidence =
      entities.reduce((sum, e) => sum + e.confidence, 0) /
      (entities.length || 1);
    const constraintCount = constraints.length;
    const requirementCount = requirements.length;

    // More extracted items generally mean higher confidence
    const extractionScore = Math.min(
      1,
      (entityConfidence + constraintCount * 0.1 + requirementCount * 0.1) / 1.2,
    );

    return Math.round(extractionScore * 100) / 100;
  }

  // Helper methods
  private initializeKeywordMaps(): void {
    this.domainKeywords = new Map([
      ["postgresql", ["postgresql", "postgres", "postgis"]],
      ["mysql", ["mysql", "mariadb"]],
      ["mongodb", ["mongodb", "mongo", "document"]],
      ["redis", ["redis", "cache", "key-value"]],
      ["cassandra", ["cassandra", "wide column"]],
      ["neo4j", ["neo4j", "graph", "nodes", "relationships"]],
      ["influxdb", ["influxdb", "time series", "iot"]],
      ["elasticsearch", ["elasticsearch", "search", "full-text"]],
      ["sqlite", ["sqlite", "embedded", "mobile"]],
      ["sqlserver", ["sql server", "mssql", "windows"]],
      ["oracle", ["oracle", "enterprise"]],
    ]);

    this.performanceIndicators = new Map([
      ["high performance", 0.9],
      ["fast", 0.8],
      ["quick", 0.7],
      ["responsive", 0.8],
      ["real-time", 0.9],
      ["low latency", 0.8],
    ]);

    this.scaleIndicators = new Map([
      ["large scale", "large"],
      ["enterprise", "enterprise"],
      ["small", "small"],
      ["startup", "startup"],
      ["medium", "medium"],
    ]);

    this.complianceKeywords = new Map([
      ["gdpr", ["gdpr", "general data protection regulation"]],
      ["hipaa", ["hipaa", "health insurance portability"]],
      ["sox", ["sox", "sarbanes oxley"]],
      ["pci-dss", ["pci dss", "payment card industry"]],
      ["ccpa", ["ccpa", "california consumer privacy"]],
    ]);
  }

  private getSynonyms(keyword: string): string[] {
    const synonymMap: Record<string, string[]> = {
      postgresql: ["postgres", "postgis"],
      mysql: ["mariadb"],
      mongodb: ["mongo", "document"],
      fast: ["quick", "responsive", "high performance"],
      large: ["big", "enterprise", "scalable"],
    };
    return synonymMap[keyword.toLowerCase()] || [];
  }

  private deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Set<string>();
    return entities.filter((entity) => {
      const key = `${entity.type}-${entity.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private generateVerificationCriteria(description: string): string {
    if (description.includes("latency")) return "Performance testing required";
    if (description.includes("users")) return "Load testing required";
    if (description.includes("uptime")) return "Monitoring setup required";
    return "Manual verification required";
  }

  private inferPriority(description: string): ExtractedRequirement["priority"] {
    if (description.includes("critical") || description.includes("must"))
      return "critical";
    if (description.includes("should") || description.includes("important"))
      return "high";
    if (description.includes("could") || description.includes("nice"))
      return "medium";
    return "low";
  }

  private extractMultiplier(text: string, index: number): number {
    const context = text.substring(Math.max(0, index - 50), index + 50);
    if (context.includes("million")) return 1000000;
    if (context.includes("billion")) return 1000000000;
    if (context.includes("thousand")) return 1000;
    return 1;
  }

  private getBudgetMultiplier(suffix?: string): number {
    switch (suffix?.toLowerCase()) {
      case "k":
        return 1000;
      case "m":
        return 1000000;
      case "b":
        return 1000000000;
      default:
        return 1;
    }
  }

  private extractTechnicalStack(text: string): string[] {
    const techStack: string[] = [];
    const technologies = [
      "react",
      "angular",
      "vue",
      "nodejs",
      "python",
      "java",
      "docker",
      "kubernetes",
      "aws",
      "azure",
      "gcp",
    ];

    technologies.forEach((tech) => {
      if (text.includes(tech)) {
        techStack.push(tech);
      }
    });

    return techStack;
  }
}
