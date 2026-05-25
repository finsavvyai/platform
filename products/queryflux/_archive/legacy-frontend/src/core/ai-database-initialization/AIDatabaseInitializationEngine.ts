/**
 * AI Database Initialization Engine
 *
 * The main engine that orchestrates the entire AI-powered database
 * initialization process, from natural language understanding to
 * automated database creation and configuration.
 */

import {
  AIDatabaseAnalysis,
  DatabaseRecommendation,
  DatabaseCreationPlan,
  NaturalLanguageAnalysis,
  DumpFileAnalysis,
  AIDatabaseInitializationConfig,
  DatabaseRequirement,
  PerformanceProfile,
  CostEstimate
} from './types';

import { NaturalLanguageProcessor } from './processors/NaturalLanguageProcessor';
import { DumpFileAnalyzer } from './processors/DumpFileAnalyzer';
import { DatabaseRecommendationEngine } from './engines/DatabaseRecommendationEngine';
import { ConfigurationGenerator } from './generators/ConfigurationGenerator';
import { CreationPlanGenerator } from './generators/CreationPlanGenerator';
import { DatabaseCreator } from './executors/DatabaseCreator';

export class AIDatabaseInitializationEngine {
  private config: AIDatabaseInitializationConfig;
  private nlProcessor: NaturalLanguageProcessor;
  private dumpAnalyzer: DumpFileAnalyzer;
  private recommendationEngine: DatabaseRecommendationEngine;
  private configGenerator: ConfigurationGenerator;
  private planGenerator: CreationPlanGenerator;
  private databaseCreator: DatabaseCreator;

  constructor(config: AIDatabaseInitializationConfig) {
    this.config = config;
    this.nlProcessor = new NaturalLanguageProcessor(config);
    this.dumpAnalyzer = new DumpFileAnalyzer(config);
    this.recommendationEngine = new DatabaseRecommendationEngine(config);
    this.configGenerator = new ConfigurationGenerator(config);
    this.planGenerator = new CreationPlanGenerator(config);
    this.databaseCreator = new DatabaseCreator(config);
  }

  /**
   * Main entry point for AI database initialization
   */
  async initializeDatabase(
    input: string | File,
    options: {
      inputType?: 'natural_language' | 'dump_file' | 'mixed';
      preferences?: {
        budgetRange?: { min: number; max: number; currency: string };
        preferredCloud?: string[];
        complianceRequirements?: string[];
        teamSize?: string;
        technicalLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
      };
    } = {}
  ): Promise<{
    analysis: AIDatabaseAnalysis;
    recommendations: DatabaseRecommendation[];
    creationPlan: DatabaseCreationPlan;
  }> {
    const startTime = Date.now();

    try {
      // Step 1: Analyze input and extract requirements
      const analysis = await this.analyzeInput(input, options.inputType || 'natural_language');

      // Step 2: Generate database recommendations
      const recommendations = await this.generateRecommendations(analysis, options.preferences);

      // Step 3: Select best recommendation and create plan
      const selectedRecommendation = this.selectBestRecommendation(recommendations, options.preferences);
      const creationPlan = await this.generateCreationPlan(analysis, selectedRecommendation);

      const processingTime = Date.now() - startTime;

      return {
        analysis: { ...analysis, processingTime },
        recommendations,
        creationPlan
      };
    } catch (error) {
      console.error('AI Database Initialization failed:', error);
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }

  /**
   * Analyze input (natural language or dump file) to extract requirements
   */
  private async analyzeInput(
    input: string | File,
    inputType: 'natural_language' | 'dump_file' | 'mixed'
  ): Promise<AIDatabaseAnalysis> {
    let requirements: DatabaseRequirement[] = [];
    let dumpAnalysis: DumpFileAnalysis | null = null;
    let nlAnalysis: NaturalLanguageAnalysis | null = null;
    let rawData: string;

    if (inputType === 'natural_language' || inputType === 'mixed') {
      const text = typeof input === 'string' ? input : await this.readFileContent(input);
      rawData = text;
      nlAnalysis = await this.nlProcessor.analyze(text);
      requirements = this.extractRequirementsFromNL(nlAnalysis);
    }

    if (inputType === 'dump_file' || inputType === 'mixed') {
      if (input instanceof File) {
        dumpAnalysis = await this.dumpAnalyzer.analyze(input);
        requirements = [
          ...requirements,
          ...this.extractRequirementsFromDump(dumpAnalysis)
        ];
        rawData = `${dumpAnalysis.fileName} (${dumpAnalysis.size} bytes)`;
      } else {
        throw new Error('Dump file analysis requires a File object');
      }
    }

    // Merge and prioritize requirements
    const mergedRequirements = this.mergeRequirements(requirements);

    return {
      id: this.generateId(),
      inputType,
      rawData,
      extractedRequirements: mergedRequirements,
      recommendedDatabases: [], // Will be filled by recommendation engine
      confidence: this.calculateOverallConfidence(nlAnalysis, dumpAnalysis),
      processingTime: 0 // Will be set by caller
    };
  }

  /**
   * Generate database recommendations based on analysis
   */
  private async generateRecommendations(
    analysis: AIDatabaseAnalysis,
    preferences?: any
  ): Promise<DatabaseRecommendation[]> {
    return await this.recommendationEngine.generate(analysis, preferences);
  }

  /**
   * Generate creation plan for selected database
   */
  private async generateCreationPlan(
    analysis: AIDatabaseAnalysis,
    recommendation: DatabaseRecommendation
  ): Promise<DatabaseCreationPlan> {
    return await this.planGenerator.generate(analysis, recommendation);
  }

  /**
   * Execute the creation plan
   */
  async executeCreationPlan(plan: DatabaseCreationPlan): Promise<{
    success: boolean;
    results: any[];
    errors: string[];
    duration: number;
  }> {
    return await this.databaseCreator.execute(plan);
  }

  /**
   * Extract requirements from natural language analysis
   */
  private extractRequirementsFromNL(analysis: NaturalLanguageAnalysis): DatabaseRequirement[] {
    const requirements: DatabaseRequirement[] = [];

    // Extract performance requirements
    const performanceEntities = analysis.entities.filter(e => e.type === 'performance');
    performanceEntities.forEach(entity => {
      requirements.push({
        id: this.generateId(),
        type: 'performance',
        description: entity.value,
        priority: this.mapConfidenceToPriority(entity.confidence),
        category: this.inferDatabaseCategory(entity.value),
        estimatedLoad: this.estimateLoadFromDescription(entity.value)
      });
    });

    // Extract scale requirements
    const scaleEntities = analysis.entities.filter(e => e.type === 'scale');
    scaleEntities.forEach(entity => {
      requirements.push({
        id: this.generateId(),
        type: 'functional',
        description: entity.value,
        priority: this.mapConfidenceToPriority(entity.confidence),
        category: this.inferDatabaseCategory(entity.value),
        estimatedLoad: this.estimateLoadFromDescription(entity.value)
      });
    });

    // Extract compliance requirements
    const complianceEntities = analysis.entities.filter(e => e.type === 'compliance');
    complianceEntities.forEach(entity => {
      requirements.push({
        id: this.generateId(),
        type: 'compliance',
        description: entity.value,
        priority: 'high', // Compliance is usually high priority
        category: this.inferDatabaseCategory(entity.value),
        estimatedLoad: 'medium' // Default to medium for compliance
      });
    });

    // Add explicit requirements
    analysis.requirements.forEach(req => {
      requirements.push({
        id: this.generateId(),
        type: this.mapRequirementType(req.category),
        description: req.description,
        priority: req.priority,
        category: this.inferDatabaseCategory(req.description),
        estimatedLoad: this.estimateLoadFromRequirement(req)
      });
    });

    return requirements;
  }

  /**
   * Extract requirements from dump file analysis
   */
  private extractRequirementsFromDump(analysis: DumpFileAnalysis): DatabaseRequirement[] {
    const requirements: DatabaseRequirement[] = [];

    // Analyze schema complexity
    requirements.push({
      id: this.generateId(),
      type: 'functional',
      description: `Support ${analysis.tableCount} tables with ${analysis.estimatedSchema.normalizationLevel} normalization`,
      priority: 'high',
      category: 'rdbms',
      estimatedLoad: this.estimateLoadFromComplexity(analysis.complexity)
    });

    // Analyze data patterns
    analysis.dataPatterns.forEach(pattern => {
      requirements.push({
        id: this.generateId(),
        type: 'functional',
        description: `Optimize for ${pattern.type} data patterns`,
        priority: this.mapConfidenceToPriority(pattern.confidence),
        category: this.inferCategoryFromPattern(pattern.type),
        estimatedLoad: 'medium'
      });
    });

    // Analyze performance requirements from indexes
    const highFrequencyIndexes = analysis.indexes.filter(idx => idx.usageFrequency === 'high');
    if (highFrequencyIndexes.length > 0) {
      requirements.push({
        id: this.generateId(),
        type: 'performance',
        description: `High-performance query support with ${highFrequencyIndexes.length} frequently used indexes`,
        priority: 'high',
        category: 'rdbms',
        estimatedLoad: 'high'
      });
    }

    return requirements;
  }

  /**
   * Merge and deduplicate requirements
   */
  private mergeRequirements(requirements: DatabaseRequirement[]): DatabaseRequirement[] {
    const merged: DatabaseRequirement[] = [];
    const seen = new Set<string>();

    requirements.forEach(req => {
      const key = `${req.type}-${req.description.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(req);
      }
    });

    // Sort by priority and importance
    return merged.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Select the best recommendation based on preferences
   */
  private selectBestRecommendation(
    recommendations: DatabaseRecommendation[],
    preferences?: any
  ): DatabaseRecommendation {
    if (!recommendations.length) {
      throw new Error('No database recommendations available');
    }

    // If no preferences, return the highest confidence recommendation
    if (!preferences) {
      return recommendations.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
    }

    // Score recommendations based on preferences
    let bestScore = -1;
    let bestRecommendation = recommendations[0];

    recommendations.forEach(rec => {
      const score = this.scoreRecommendation(rec, preferences);
      if (score > bestScore) {
        bestScore = score;
        bestRecommendation = rec;
      }
    });

    return bestRecommendation;
  }

  /**
   * Score a recommendation based on user preferences
   */
  private scoreRecommendation(recommendation: DatabaseRecommendation, preferences: any): number {
    let score = recommendation.confidence * 100;

    // Budget scoring
    if (preferences.budgetRange) {
      const { min, max } = preferences.budgetRange;
      const monthlyCost = recommendation.estimatedCost.monthly;
      if (monthlyCost >= min && monthlyCost <= max) {
        score += 50;
      } else if (monthlyCost > max) {
        score -= (monthlyCost - max) / max * 30;
      }
    }

    // Cloud provider preference
    if (preferences.preferredCloud?.length > 0) {
      const dbType = recommendation.databaseType.toLowerCase();
      const cloudMatch = preferences.preferredCloud.some(cloud =>
        dbType.includes(cloud.toLowerCase())
      );
      if (cloudMatch) {
        score += 30;
      }
    }

    // Compliance requirements
    if (preferences.complianceRequirements?.length > 0) {
      // This would need more sophisticated matching logic
      score += 20;
    }

    return score;
  }

  // Helper methods
  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateOverallConfidence(nlAnalysis?: NaturalLanguageAnalysis | null, dumpAnalysis?: DumpFileAnalysis | null): number {
    const confidences: number[] = [];

    if (nlAnalysis) confidences.push(nlAnalysis.confidence);
    if (dumpAnalysis) confidences.push(0.8); // Dump analysis is usually more reliable

    return confidences.length > 0
      ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
      : 0.5;
  }

  private mapConfidenceToPriority(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  private inferDatabaseCategory(description: string): DatabaseRequirement['category'] {
    const lower = description.toLowerCase();

    if (lower.includes('document') || lower.includes('json') || lower.includes('nosql')) return 'nosql';
    if (lower.includes('graph') || lower.includes('network') || lower.includes('relationship')) return 'graph';
    if (lower.includes('time') || lower.includes('series') || lower.includes('iot')) return 'timeseries';
    if (lower.includes('cache') || lower.includes('redis') || lower.includes('memory')) return 'cache';
    if (lower.includes('cloud') || lower.includes('aws') || lower.includes('azure')) return 'cloud';

    return 'rdbms'; // Default to relational
  }

  private inferCategoryFromPattern(pattern: string): DatabaseRequirement['category'] {
    switch (pattern) {
      case 'network': return 'graph';
      case 'document': return 'nosql';
      case 'key_value': return 'cache';
      case 'temporal': return 'timeseries';
      default: return 'rdbms';
    }
  }

  private estimateLoadFromDescription(description: string): DatabaseRequirement['estimatedLoad'] {
    const lower = description.toLowerCase();

    if (lower.includes('enterprise') || lower.includes('large scale') || lower.includes('high traffic')) {
      return 'enterprise';
    }
    if (lower.includes('medium') || lower.includes('moderate')) {
      return 'high';
    }
    if (lower.includes('small') || lower.includes('simple')) {
      return 'low';
    }

    return 'medium';
  }

  private estimateLoadFromRequirement(req: any): DatabaseRequirement['estimatedLoad'] {
    // Similar logic to above but based on structured requirement data
    return 'medium';
  }

  private estimateLoadFromComplexity(complexity: string): DatabaseRequirement['estimatedLoad'] {
    switch (complexity) {
      case 'very_complex': return 'enterprise';
      case 'complex': return 'high';
      case 'moderate': return 'medium';
      case 'simple': return 'low';
      default: return 'medium';
    }
  }

  private mapRequirementType(category: string): DatabaseRequirement['type'] {
    switch (category) {
      case 'performance':
      case 'scalability':
      case 'availability':
        return 'performance';
      case 'security':
      case 'compliance':
        return 'security';
      default:
        return 'functional';
    }
  }

  /**
   * Get analysis progress updates
   */
  onAnalysisProgress(callback: (step: string, progress: number) => void): void {
    // Implementation for progress callbacks
    console.log('Analysis progress callback registered');
  }

  /**
   * Get supported input formats
   */
  getSupportedFormats(): {
    naturalLanguage: boolean;
    dumpFiles: string[];
    maxSize: number;
  } {
    return {
      naturalLanguage: true,
      dumpFiles: ['.sql', '.json', '.csv', '.bson', '.dump'],
      maxSize: 100 * 1024 * 1024 // 100MB
    };
  }

  /**
   * Validate input before processing
   */
  async validateInput(input: string | File): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof input === 'string') {
      if (input.trim().length < 10) {
        errors.push('Natural language input is too short to be meaningful');
      }
      if (input.length > 10000) {
        warnings.push('Long input may take longer to process');
      }
    } else {
      if (input.size > 100 * 1024 * 1024) {
        errors.push('File size exceeds 100MB limit');
      }

      const extension = '.' + input.name.split('.').pop()?.toLowerCase();
      const supportedFormats = this.getSupportedFormats().dumpFiles;
      if (!supportedFormats.includes(extension)) {
        errors.push(`Unsupported file format: ${extension}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
