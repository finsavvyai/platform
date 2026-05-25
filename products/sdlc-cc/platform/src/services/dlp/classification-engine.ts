/**
 * ClassificationEngine - Data classification using ensemble of classifiers
 */

import {
  DLPConfig,
  DataClassification,
  DataType,
  ProcessedData,
  ClassificationPrediction,
  AggregatedPrediction,
} from '../../types/dlp';

export class ClassificationEngine {
  private config: DLPConfig['classification'];
  private models: Map<string, Record<string, unknown>> = new Map();

  constructor(config: DLPConfig['classification']) {
    this.config = config;
    this.initializeModels();
  }

  async classify(data: ProcessedData): Promise<DataClassification> {
    const text = this.extractText(data);

    const predictions = await Promise.all([
      this.classifyWithRegex(text),
      this.classifyWithML(text),
      this.classifyWithKeywords(text),
      this.classifyWithMetadata(data)
    ]);

    const aggregated = this.aggregatePredictions(predictions);

    return {
      type: aggregated.type,
      confidence: aggregated.confidence,
      tags: aggregated.tags,
      metadata: aggregated.metadata
    };
  }

  private extractText(data: ProcessedData | string): string {
    if (typeof data === 'string') return data;
    if (data.text) return data.text;
    if (typeof data === 'object') return JSON.stringify(data);
    return String(data);
  }

  private async classifyWithRegex(text: string): Promise<ClassificationPrediction> {
    const patterns = {
      'PII': [
        /\b\d{3}-\d{2}-\d{4}\b/g,
        /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/gi
      ],
      'PHI': [
        /\b(mr|mrs|ms|dr)\s+\w+\s+\w+\b/gi,
        /\b(hospital|medical|clinic|pharmacy)\b/gi
      ],
      'FINANCIAL': [
        /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        /\b\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g
      ]
    };

    const matches = {};
    let totalMatches = 0;

    for (const [type, regexes] of Object.entries(patterns)) {
      matches[type] = 0;
      for (const regex of regexes) {
        const found = text.match(regex);
        if (found) {
          matches[type] += found.length;
          totalMatches += found.length;
        }
      }
    }

    if (totalMatches === 0) {
      return { type: 'PUBLIC', confidence: 0.8 };
    }

    const maxType = Object.entries(matches).reduce((a, b) =>
      matches[a[0]] > matches[b[0]] ? a : b
    )[0];

    return {
      type: maxType as DataType,
      confidence: Math.min(0.9, matches[maxType] / totalMatches)
    };
  }

  private async classifyWithML(text: string): Promise<ClassificationPrediction> {
    return { type: 'UNKNOWN', confidence: 0.5 };
  }

  private async classifyWithKeywords(text: string): Promise<ClassificationPrediction> {
    const keywords = {
      'PII': ['social security', 'ssn', 'birth date', 'address', 'phone'],
      'PHI': ['patient', 'diagnosis', 'treatment', 'prescription', 'medical'],
      'FINANCIAL': ['credit card', 'bank account', 'payment', 'invoice', 'transaction'],
      'CONFIDENTIAL': ['confidential', 'proprietary', 'trade secret', 'internal only'],
      'INTERNAL': ['internal', 'company', 'employee', 'meeting', 'project']
    };

    const scores = {};
    const lowerText = text.toLowerCase();

    for (const [type, words] of Object.entries(keywords)) {
      scores[type] = 0;
      for (const word of words) {
        if (lowerText.includes(word.toLowerCase())) {
          scores[type]++;
        }
      }
    }

    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      return { type: 'UNKNOWN', confidence: 0.3 };
    }

    const maxType = Object.entries(scores).reduce((a, b) =>
      scores[a[0]] > scores[b[0]] ? a : b
    )[0];

    return {
      type: maxType as DataType,
      confidence: Math.min(0.7, maxScore / 10)
    };
  }

  private async classifyWithMetadata(data: ProcessedData): Promise<ClassificationPrediction> {
    const metadata = data.metadata || {};

    if (metadata.classification) {
      return {
        type: metadata.classification,
        confidence: 0.9,
        tags: metadata.tags || []
      };
    }

    return { type: 'UNKNOWN', confidence: 0.2 };
  }

  private aggregatePredictions(predictions: ClassificationPrediction[]): AggregatedPrediction {
    const weights = [0.3, 0.4, 0.2, 0.1];
    const typeScores = {};

    predictions.forEach((pred, index) => {
      if (!typeScores[pred.type]) {
        typeScores[pred.type] = 0;
      }
      typeScores[pred.type] += pred.confidence * weights[index];
    });

    const bestType = Object.entries(typeScores).reduce((a, b) =>
      typeScores[a[0]] > typeScores[b[0]] ? a : b
    )[0];

    return {
      type: bestType as DataType,
      confidence: Math.min(0.95, typeScores[bestType]),
      tags: [],
      metadata: {}
    };
  }

  private initializeModels(): void {
    // Initialize ML models - in production, load pre-trained models
  }
}
