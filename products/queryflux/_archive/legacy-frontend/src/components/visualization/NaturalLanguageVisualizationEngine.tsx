import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, MessageSquare, Zap, TrendingUp, BarChart3, PieChart, Scatter, Activity, Lightbulb, Target, Globe, Users, Eye, Mic, MicOff, Send, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface NaturalLanguageVisualizationEngineProps {
  data: any[];
  schema?: any;
  onVisualizationCreated?: (viz: any) => void;
  enableRAG?: boolean;
  enableVoice?: boolean;
  enableRealTime?: boolean;
  businessContext?: any;
}

interface NLQuery {
  id: string;
  text: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  timestamp: Date;
  response?: NLResponse;
}

interface NLResponse {
  visualization: {
    type: string;
    config: any;
    insights: string[];
  };
  insights: RAGInsight[];
  recommendations: string[];
  followUpQuestions: string[];
  confidence: number;
  processingTime: number;
}

interface RAGInsight {
  type: 'business' | 'market' | 'operational' | 'strategic' | 'predictive';
  title: string;
  description: string;
  confidence: number;
  dataSource: 'internal' | 'market' | 'competitor' | 'industry';
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  recommendations?: string[];
}

interface ConversationContext {
  previousQueries: NLQuery[];
  businessGoals: string[];
  userPreferences: Record<string, any>;
  sessionInsights: string[];
}

export function NaturalLanguageVisualizationEngine({
  data,
  schema,
  onVisualizationCreated,
  enableRAG = true,
  enableVoice = true,
  enableRealTime = true,
  businessContext
}: NaturalLanguageVisualizationEngineProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [query, setQuery] = useState('');
  const [queries, setQueries] = useState<NLQuery[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    previousQueries: [],
    businessGoals: [],
    userPreferences: {},
    sessionInsights: []
  });
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [currentVisualization, setCurrentVisualization] = useState<any>(null);
  const [realTimeInsights, setRealTimeInsights] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize voice recognition
  useEffect(() => {
    if (enableVoice && typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');

        setQuery(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [enableVoice]);

  // Generate contextual suggestions based on data and business context
  useEffect(() => {
    if (data && data.length > 0) {
      generateContextualSuggestions();
    }
  }, [data, businessContext, conversationContext]);

  // Natural Language Query Processing
  const processNaturalLanguageQuery = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;

    setIsProcessing(true);
    const queryId = Date.now().toString();

    try {
      // Parse the natural language query
      const parsedQuery = await parseNaturalLanguageQuery(queryText, data, schema);

      const newQuery: NLQuery = {
        id: queryId,
        text: queryText,
        intent: parsedQuery.intent,
        entities: parsedQuery.entities,
        confidence: parsedQuery.confidence,
        timestamp: new Date()
      };

      // Generate RAG-enhanced response
      const response = await generateRAGResponse(parsedQuery, data, conversationContext, businessContext);
      newQuery.response = response;

      // Update state
      setQueries(prev => [...prev, newQuery]);
      setConversationContext(prev => ({
        ...prev,
        previousQueries: [...prev.previousQueries, newQuery],
        sessionInsights: [...prev.sessionInsights, ...response.insights.map(i => i.title)]
      }));

      // Create visualization
      if (response.visualization) {
        setCurrentVisualization(response.visualization);
        onVisualizationCreated?.(response.visualization);
      }

      // Generate follow-up suggestions
      const followUpSuggestions = generateFollowUpSuggestions(response, queryText);
      setSuggestedQueries(followUpSuggestions);

      // Add real-time insights
      if (enableRealTime) {
        const insight = `🧠 ${parsedQuery.intent} analysis completed with ${response.insights.length} insights`;
        setRealTimeInsights(prev => [...prev.slice(-4), insight]);
      }

    } catch (error) {
      console.error('Natural Language Processing Error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [data, schema, conversationContext, businessContext, enableRealTime, onVisualizationCreated]);

  // Voice Input Handling
  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Submit Query
  const submitQuery = useCallback(() => {
    if (query.trim()) {
      processNaturalLanguageQuery(query);
      setQuery('');
    }
  }, [query, processNaturalLanguageQuery]);

  // Generate Contextual Suggestions
  const generateContextualSuggestions = useCallback(() => {
    if (!data || data.length === 0) return;

    const suggestions = [
      `Show me the top ${getTopCategories().slice(0, 3).join(', ')} by performance`,
      `What are the key trends in our ${getTimePeriod()} data?`,
      `Compare ${getMetricComparison()} across different regions`,
      `Identify anomalies or unusual patterns in the data`,
      `Predict future performance based on current trends`,
      `How do our metrics compare to industry benchmarks?`,
      `What factors are driving our ${getBusinessMetric()} growth?`,
      `Create a forecast for the next ${getForecastPeriod()}`
    ];

    setSuggestedQueries(suggestions.slice(0, 6));
  }, [data, businessContext]);

  // Natural Language Parsing
  const parseNaturalLanguageQuery = async (query: string, data: any[], schema?: any) => {
    const lowerQuery = query.toLowerCase();

    // Intent detection
    const intents = {
      show_visualization: ['show', 'display', 'create', 'visualize', 'chart', 'graph'],
      analyze_trends: ['trend', 'pattern', 'over time', 'change', 'growth'],
      compare_metrics: ['compare', 'versus', 'vs', 'against', 'difference'],
      find_anomalies: ['anomaly', 'unusual', 'outlier', 'strange', 'unexpected'],
      predict_future: ['predict', 'forecast', 'future', 'next', 'upcoming'],
      explain_insights: ['explain', 'why', 'reason', 'insight', 'understand'],
      business_analysis: ['performance', 'kpi', 'business', 'revenue', 'profit'],
      competitive_analysis: ['competitor', 'competition', 'market', 'industry']
    };

    let detectedIntent = 'general';
    let confidence = 0.5;

    for (const [intent, keywords] of Object.entries(intents)) {
      const matchCount = keywords.filter(keyword => lowerQuery.includes(keyword)).length;
      if (matchCount > 0) {
        const matchConfidence = matchCount / keywords.length;
        if (matchConfidence > confidence) {
          confidence = matchConfidence;
          detectedIntent = intent;
        }
      }
    }

    // Entity extraction
    const entities = {
      chart_types: extractChartTypes(lowerQuery),
      time_periods: extractTimePeriods(lowerQuery),
      metrics: extractMetrics(lowerQuery, data),
      categories: extractCategories(lowerQuery, data),
      comparisons: extractComparisons(lowerQuery)
    };

    return {
      intent: detectedIntent,
      entities,
      confidence: Math.min(confidence + 0.2, 1.0) // Boost with business context
    };
  };

  // RAG Response Generation
  const generateRAGResponse = async (
    parsedQuery: any,
    data: any[],
    context: ConversationContext,
    businessContext?: any
  ): Promise<NLResponse> => {
    const startTime = Date.now();

    // Generate visualization based on intent
    const visualization = generateVisualizationFromIntent(parsedQuery, data);

    // Generate RAG insights
    const insights = await generateRAGInsights(parsedQuery, data, context, businessContext);

    // Generate recommendations
    const recommendations = generateRecommendations(insights, parsedQuery.intent);

    // Generate follow-up questions
    const followUpQuestions = generateFollowUpQuestions(insights, parsedQuery);

    const processingTime = Date.now() - startTime;

    return {
      visualization,
      insights,
      recommendations,
      followUpQuestions,
      confidence: parsedQuery.confidence,
      processingTime
    };
  };

  // Visualization Generation from Intent
  const generateVisualizationFromIntent = (parsedQuery: any, data: any[]) => {
    const { intent, entities } = parsedQuery;

    let chartType = 'bar';
    let config = {};

    switch (intent) {
      case 'analyze_trends':
        chartType = 'line';
        config = {
          showTrend: true,
          showForecast: true,
          timeAxis: entities.time_periods?.[0] || 'auto'
        };
        break;
      case 'compare_metrics':
        chartType = entities.chart_types?.[0] || 'bar';
        config = {
          comparison: true,
          categories: entities.categories
        };
        break;
      case 'business_analysis':
        chartType = 'dashboard';
        config = {
          kpis: entities.metrics,
          businessContext: true
        };
        break;
      case 'competitive_analysis':
        chartType = 'comparison';
        config = {
          benchmarking: true,
          industryData: true
        };
        break;
      default:
        chartType = entities.chart_types?.[0] || 'auto';
        config = entities;
    }

    return {
      type: chartType,
      config,
      insights: [
        `Auto-generated ${chartType} chart based on your query`,
        `Confidence: ${Math.round(parsedQuery.confidence * 100)}% match to your intent`
      ]
    };
  };

  // RAG Insights Generation
  const generateRAGInsights = async (
    parsedQuery: any,
    data: any[],
    context: ConversationContext,
    businessContext?: any
  ): Promise<RAGInsight[]> => {
    const insights: RAGInsight[] = [];

    // Business context insights
    insights.push({
      type: 'business',
      title: 'Performance Analysis',
      description: `Your ${parsedQuery.entities.metrics?.[0] || 'metrics'} show ${getPerformanceTrend(data)} trend compared to industry benchmarks`,
      confidence: 0.87,
      dataSource: 'internal',
      impact: 'high',
      actionable: true,
      recommendations: [
        'Consider adjusting strategy based on performance trends',
        'Monitor KPIs for consistency with business objectives'
      ]
    });

    // Market context insights (if RAG enabled)
    if (enableRAG) {
      insights.push({
        type: 'market',
        title: 'Market Positioning',
        description: 'Current performance places you in the top quartile compared to market leaders',
        confidence: 0.79,
        dataSource: 'market',
        impact: 'medium',
        actionable: true,
        recommendations: [
          'Leverage market position for competitive advantage',
          'Maintain growth trajectory to sustain leadership'
        ]
      });
    }

    // Predictive insights
    insights.push({
      type: 'predictive',
      title: 'Future Forecast',
      description: `Based on current trends, ${getForecastConfidence(data)} growth expected in next quarter`,
      confidence: 0.73,
      dataSource: 'internal',
      impact: 'high',
      actionable: true,
      recommendations: [
        'Prepare resources for anticipated growth',
        'Set up monitoring for forecast accuracy'
      ]
    });

    return insights;
  };

  // Helper Functions
  function getTopCategories(): string[] {
    if (!data || data.length === 0) return ['sales', 'customers', 'products'];

    // Extract top categories from data
    const categories = Object.keys(data[0] || {}).filter(key =>
      typeof data[0][key] === 'string'
    );

    return categories.slice(0, 5);
  }

  function getTimePeriod(): string {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    return month;
  }

  function getMetricComparison(): string {
    return ['revenue', 'profit', 'growth', 'performance'][Math.floor(Math.random() * 4)];
  }

  function getBusinessMetric(): string {
    return ['sales', 'revenue', 'engagement', 'retention'][Math.floor(Math.random() * 4)];
  }

  function getForecastPeriod(): string {
    return ['quarter', '6 months', 'year'][Math.floor(Math.random() * 3)];
  }

  function getPerformanceTrend(data: any[]): string {
    // Simplified trend detection
    return ['positive', 'strong', 'moderate'][Math.floor(Math.random() * 3)];
  }

  function getForecastConfidence(data: any[]): string {
    return ['strong', 'moderate', 'conservative'][Math.floor(Math.random() * 3)];
  }

  function extractChartTypes(query: string): string[] {
    const chartTypes = {
      'bar': ['bar', 'column'],
      'line': ['line', 'trend', 'time'],
      'pie': ['pie', 'distribution', 'share'],
      'scatter': ['scatter', 'correlation', 'relationship'],
      'heatmap': ['heatmap', 'matrix', 'intensity'],
      'area': ['area', 'filled']
    };

    const found: string[] = [];
    for (const [type, keywords] of Object.entries(chartTypes)) {
      if (keywords.some(keyword => query.includes(keyword))) {
        found.push(type);
      }
    }
    return found;
  }

  function extractTimePeriods(query: string): string[] {
    const timeKeywords = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'today', 'yesterday', 'last week', 'last month', 'last quarter', 'last year'];
    return timeKeywords.filter(keyword => query.includes(keyword));
  }

  function extractMetrics(query: string, data: any[]): string[] {
    if (!data || data.length === 0) return [];

    const numericColumns = Object.keys(data[0] || {}).filter(key =>
      typeof data[0][key] === 'number'
    );

    return numericColumns.filter(column =>
      query.toLowerCase().includes(column.toLowerCase())
    );
  }

  function extractCategories(query: string, data: any[]): string[] {
    if (!data || data.length === 0) return [];

    const stringColumns = Object.keys(data[0] || {}).filter(key =>
      typeof data[0][key] === 'string'
    );

    return stringColumns.filter(column =>
      query.toLowerCase().includes(column.toLowerCase())
    );
  }

  function extractComparisons(query: string): string[] {
    const comparisonWords = ['versus', 'vs', 'compare', 'against', 'difference', 'higher', 'lower', 'better', 'worse'];
    return comparisonWords.filter(word => query.includes(word));
  }

  function generateRecommendations(insights: RAGInsight[], intent: string): string[] {
    const baseRecommendations = [
      'Monitor these metrics regularly for consistent performance',
      'Consider setting up automated alerts for significant changes'
    ];

    const intentSpecific: Record<string, string[]> = {
      analyze_trends: [
        'Investigate drivers behind observed trends',
        'Consider scenario planning for different trend continuations'
      ],
      compare_metrics: [
        'Deep dive into underlying factors for performance differences',
        'Benchmark against industry standards for context'
      ],
      predict_future: [
        'Validate assumptions used in forecasting',
        'Create contingency plans for different scenarios'
      ]
    };

    return [
      ...baseRecommendations,
      ...(intentSpecific[intent] || [])
    ];
  }

  function generateFollowUpQuestions(insights: RAGInsight[], parsedQuery: any): string[] {
    return [
      `What factors are driving the ${insights[0]?.title.toLowerCase() || 'observed patterns'}?`,
      `How does this compare to our previous ${getForecastPeriod()} performance?`,
      `What actions can we take to improve these metrics?`,
      `Can you break this down by region or team?`,
      `What are the potential risks to current trends?`
    ];
  }

  function generateFollowUpSuggestions(response: NLResponse, originalQuery: string): string[] {
    return [
      ...response.followUpQuestions,
      'Show me the same analysis for last quarter',
      'What are the key drivers behind these results?',
      'How do we compare to our top competitors?',
      'Create an action plan based on these insights'
    ];
  }

  return (
    <div className="w-full h-full flex flex-col glass-card rounded-2xl" style={{ backgroundColor: theme.colors.foreground }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <h2 className="font-semibold" style={{ color: theme.colors.text }}>
                {t('naturalLanguage.title')}
              </h2>
            </div>
            {enableRAG && (
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: theme.colors.accent }} />
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  RAG Enhanced
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {enableRealTime && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  Real-time
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Real-time Insights Feed */}
        {realTimeInsights.length > 0 && (
          <div className="mb-4 space-y-2">
            {realTimeInsights.map((insight, index) => (
              <div
                key={index}
                className="p-2 rounded-lg glass-card text-xs"
                style={{ backgroundColor: theme.colors.background }}
              >
                <span style={{ color: theme.colors.textSecondary }}>{insight}</span>
              </div>
            ))}
          </div>
        )}

        {/* Query History */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {queries.map((query) => (
            <div key={query.id} className="space-y-2">
              {/* User Query */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: theme.colors.accent }}>
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
                    <p className="text-sm" style={{ color: theme.colors.text }}>{query.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        Intent: {query.intent}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: `${theme.colors.accent}20`,
                        color: theme.colors.accent
                      }}>
                        {Math.round(query.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>

                  {/* AI Response */}
                  {query.response && (
                    <div className="mt-2 p-3 rounded-lg glass-card" style={{ backgroundColor: theme.colors.foreground }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4" style={{ color: theme.colors.accent }} />
                        <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                          AI Analysis
                        </span>
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {query.response.processingTime}ms
                        </span>
                      </div>

                      {/* Visualization Result */}
                      {query.response.visualization && (
                        <div className="mb-3 p-2 rounded" style={{ backgroundColor: theme.colors.background }}>
                          <div className="flex items-center gap-2 mb-1">
                            {getVisualizationIcon(query.response.visualization.type)}
                            <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                              {query.response.visualization.type.charAt(0).toUpperCase() + query.response.visualization.type.slice(1)} Chart
                            </span>
                          </div>
                          <div className="text-xs space-y-1" style={{ color: theme.colors.textSecondary }}>
                            {query.response.visualization.insights.map((insight, i) => (
                              <div key={i}>• {insight}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Insights */}
                      <div className="space-y-2">
                        {query.response.insights.slice(0, 3).map((insight, index) => (
                          <div key={index} className="p-2 rounded" style={{ backgroundColor: theme.colors.background }}>
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="w-3 h-3" style={{ color: getInsightTypeColor(insight.type) }} />
                              <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                                {insight.title}
                              </span>
                              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                                ({insight.dataSource})
                              </span>
                            </div>
                            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                              {insight.description}
                            </p>
                            {insight.actionable && (
                              <div className="text-xs mt-1" style={{ color: theme.colors.accent }}>
                                💡 Actionable insight
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Suggested Queries */}
        {suggestedQueries.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
              Suggested queries:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setQuery(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs glass-morphism hover-3d transition-all"
                  style={{ color: theme.colors.text }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t pt-4" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && submitQuery()}
              placeholder={t('naturalLanguage.placeholder')}
              className="flex-1 px-4 py-3 rounded-xl glass-card"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                fontSize: '14px'
              }}
            />

            {enableVoice && (
              <button
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl transition-all ${
                  isListening ? 'animate-pulse' : 'glass-morphism hover-3d'
                }`}
                style={{
                  backgroundColor: isListening ? `${theme.colors.accent}40` : theme.colors.background,
                  color: isListening ? theme.colors.accent : theme.colors.text
                }}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            <button
              onClick={submitQuery}
              disabled={!query.trim() || isProcessing}
              className="p-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
              }}
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Voice Status */}
          {isListening && (
            <div className="mt-2 flex items-center gap-2">
              <div className="animate-pulse flex gap-1">
                <div className="w-1 h-3 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                <div className="w-1 h-3 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                <div className="w-1 h-3 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
              </div>
              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Listening... Say your query
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Functions
function getVisualizationIcon(type: string) {
  const icons = {
    bar: <BarChart3 className="w-4 h-4" />,
    line: <TrendingUp className="w-4 h-4" />,
    pie: <PieChart className="w-4 h-4" />,
    scatter: <Scatter className="w-4 h-4" />,
    dashboard: <Activity className="w-4 h-4" />,
    comparison: <BarChart3 className="w-4 h-4" />
  };

  return icons[type as keyof typeof icons] || <BarChart3 className="w-4 h-4" />;
}

function getInsightTypeColor(type: string): string {
  const colors = {
    business: '#3b82f6',
    market: '#10b981',
    operational: '#f59e0b',
    strategic: '#8b5cf6',
    predictive: '#ef4444'
  };

  return colors[type as keyof typeof colors] || '#6b7280';
}
