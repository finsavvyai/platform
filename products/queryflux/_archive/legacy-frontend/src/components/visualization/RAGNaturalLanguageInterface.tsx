import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, Brain, Zap, TrendingUp, Lightbulb, Target, Globe, Users, Clock, RefreshCw, Download } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface RAGNaturalLanguageInterfaceProps {
  data: any[];
  onVisualizationGenerated: (viz: any) => void;
  onInsightsGenerated: (insights: any[]) => void;
  enableRAG?: boolean;
  enableVoice?: boolean;
  enableCollaboration?: boolean;
  maxMessages?: number;
}

interface RAGMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  visualizations?: any[];
  insights?: any[];
  externalData?: any;
  businessContext?: any;
  actionItems?: any[];
}

interface RAGQueryIntent {
  type: 'visualization' | 'analysis' | 'comparison' | 'prediction' | 'enrichment' | 'insights';
  primaryGoal: string;
  secondaryGoals?: string[];
  timeFrame?: string;
  stakeholders?: string[];
  businessImpact?: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
}

interface RAGResponse {
  type: 'visualization' | 'insights' | 'recommendations' | 'predictions' | 'enrichment';
  content: string;
  confidence: number;
  data?: any;
  visualizations?: any[];
  insights?: any[];
  externalContext?: any;
  actionItems?: string[];
  businessImpact?: any;
  confidenceScore?: number;
}

export function RAGNaturalLanguageInterface({
  data,
  onVisualizationGenerated,
  onInsightsGenerated,
  enableRAG = true,
  enableVoice = true,
  enableCollaboration = true,
  maxMessages = 50
}: RAGNaturalLanguageInterfaceProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<RAGMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [ragContext, setRagContext] = useState<any>({});
  const [querySuggestions, setQuerySuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // RAG-powered query understanding
  const understandRAGQuery = useCallback(async (query: string): Promise<RAGQueryIntent> => {
    if (!enableRAG) {
      return {
        type: 'visualization',
        primaryGoal: query,
        complexity: 'simple',
        businessImpact: 'medium'
      };
    }

    // Simulate RAG processing with business context
    const lowerQuery = query.toLowerCase();

    // Advanced intent analysis with business context
    if (lowerQuery.includes('show') || lowerQuery.includes('create') || lowerQuery.includes('visualize')) {
      return {
        type: 'visualization',
        primaryGoal: extractVisualizationGoal(query),
        stakeholders: extractStakeholders(query),
        businessImpact: assessBusinessImpact(query),
        complexity: assessComplexity(query)
      };
    }

    if (lowerQuery.includes('analyze') || lowerQuery.includes('what') || lowerQuery.includes('how')) {
      return {
        type: 'analysis',
        primaryGoal: extractAnalysisGoal(query),
        timeFrame: extractTimeFrame(query),
        businessImpact: assessBusinessImpact(query),
        complexity: assessComplexity(query)
      };
    }

    if (lowerQuery.includes('compare') || lowerQuery.includes('versus') || lowerQuery.includes('against')) {
      return {
        type: 'comparison',
        primaryGoal: extractComparisonGoal(query),
        stakeholders: extractStakeholders(query),
        businessImpact: 'high',
        complexity: 'moderate'
      };
    }

    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast') || lowerQuery.includes('future')) {
      return {
        type: 'prediction',
        primaryGoal: extractPredictionGoal(query),
        timeFrame: extractTimeFrame(query),
        businessImpact: 'high',
        complexity: 'complex'
      };
    }

    if (lowerQuery.includes('enrich') || lowerQuery.includes('add') || lowerQuery.includes('external')) {
      return {
        type: 'enrichment',
        primaryGoal: extractEnrichmentGoal(query),
        stakeholders: extractStakeholders(query),
        businessImpact: 'medium',
        complexity: 'simple'
      };
    }

    return {
      type: 'insights',
      primaryGoal: query,
      businessImpact: 'medium',
      complexity: 'simple'
    };
  }, [enableRAG]);

  // RAG-enhanced response generation
  const generateRAGResponse = useCallback(async (
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> => {
    if (!enableRAG) {
      return {
        type: 'visualization',
        content: 'I can help you create visualizations. What would you like to see?',
        confidence: 0.7
      };
    }

    try {
      // Simulate RAG processing with external data integration
      switch (intent.type) {
        case 'visualization':
          return await generateVisualizationResponse(intent, query, data);
        case 'analysis':
          return await generateAnalysisResponse(intent, query, data);
        case 'comparison':
          return await generateComparisonResponse(intent, query, data);
        case 'prediction':
          return await generatePredictionResponse(intent, query, data);
        case 'enrichment':
          return await generateEnrichmentResponse(intent, query, data);
        case 'insights':
          return await generateInsightsResponse(intent, query, data);
        default:
          return await generateGenericResponse(intent, query, data);
      }
    } catch (error) {
      console.error('RAG Response Generation Error:', error);
      return {
        type: 'insights',
        content: 'I encountered an error processing your request. Please try again.',
        confidence: 0.1
      };
    }
  }, [enableRAG]);

  // Process user message with RAG intelligence
  const processUserMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: RAGMessage = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Understand query intent using RAG
      const intent = await understandRAGQuery(content);

      // Generate intelligent response
      const response = await generateRAGResponse(intent, content, data);

      // Create AI response message
      const aiMessage: RAGMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.content,
        timestamp: new Date(),
        visualizations: response.visualizations,
        insights: response.insights,
        externalData: response.externalContext,
        businessContext: response.businessImpact,
        actionItems: response.actionItems
      };

      setMessages(prev => [...prev, aiMessage]);

      // Trigger callbacks
      if (response.visualizations && response.visualizations.length > 0) {
        onVisualizationGenerated(response.visualizations[0]);
      }

      if (response.insights && response.insights.length > 0) {
        onInsightsGenerated(response.insights);
      }

      // Update RAG context for conversation continuity
      setRagContext(prev => ({
        ...prev,
        lastIntent: intent,
        lastResponse: response,
        conversationHistory: [...(prev.conversationHistory || []), { query: content, intent, response }]
      }));

    } catch (error) {
      console.error('Message Processing Error:', error);

      // Error response
      const errorMessage: RAGMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'I apologize, but I encountered an error processing your request. Could you please rephrase or try again?',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [data, understandRAGQuery, generateRAGResponse, onVisualizationGenerated, onInsightsGenerated]);

  // Voice command processing
  const processVoiceCommand = useCallback(async () => {
    if (!enableVoice) return;

    setIsListening(true);

    try {
      // Simulate voice recognition - in production, use Web Speech API
      const mockVoiceCommands = [
        'Show me sales trends over the last quarter',
        'Analyze customer churn patterns',
        'Compare our performance against competitors',
        'Predict revenue growth for next year',
        'What are the key insights from this data?'
      ];

      setTimeout(() => {
        const randomCommand = mockVoiceCommands[Math.floor(Math.random() * mockVoiceCommands.length)];
        setInputValue(randomCommand);
        setIsListening(false);

        // Auto-process voice command
        setTimeout(() => processUserMessage(randomCommand), 500);
      }, 2000);

    } catch (error) {
      console.error('Voice Processing Error:', error);
      setIsListening(false);
    }
  }, [enableVoice, processUserMessage]);

  // Generate intelligent query suggestions
  const generateQuerySuggestions = useCallback(() => {
    if (!data || data.length === 0) return;

    const suggestions = [
      'What are the main trends in this data?',
      'Show me performance over time',
      'Compare different categories',
      'Identify anomalies and outliers',
      'Predict future values',
      'Enrich this data with market context',
      'What insights can you generate?',
      'How does this compare to industry benchmarks?',
      'What are the key drivers of performance?',
      'Generate actionable recommendations'
    ];

    setQuerySuggestions(suggestions.sort(() => Math.random() - 0.5).slice(5));
  }, [data]);

  // Initialize with welcome message and suggestions
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: RAGMessage = {
        id: '1',
        type: 'ai',
        content: `🧠 Welcome to QueryFlux RAG Analytics! I can help you visualize data, generate insights, predict trends, and enrich your analysis with external context. What would you like to explore?`,
        timestamp: new Date()
      };

      setMessages([welcomeMessage]);
      generateQuerySuggestions();
    }
  }, [messages.length, generateQuerySuggestions]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // RAG Response Generation Functions
  async function generateVisualizationResponse(
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> {

    // RAG-enhanced visualization generation
    const visualizationType = determineOptimalVisualization(query, data);
    const businessContext = analyzeBusinessContext(query, data);

    return {
      type: 'visualization',
      content: `I'll create a ${visualizationType} visualization showing ${intent.primaryGoal}. Based on your business context, I've optimized the chart for maximum impact.`,
      confidence: 0.92,
      visualizations: [{
        type: visualizationType,
        title: generateVisualizationTitle(query),
        businessContext: businessContext,
        optimization: generateVisualizationOptimization(query, data),
        aiInsights: generateVisualizationInsights(data, query)
      }],
      externalContext: await fetchExternalBusinessData(businessContext),
      businessImpact: {
        level: intent.businessImpact,
        roi: 'High - Data visualization improves decision making speed by 60%',
        stakeholders: intent.stakeholders || ['Business Team']
      },
      actionItems: [
        'Review visualization for key insights',
        'Share with relevant stakeholders',
        'Monitor for changes over time'
      ]
    };
  }

  async function generateAnalysisResponse(
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> {

    // RAG-powered analysis with external data
    const analysis = await performRAGAnalysis(data, query);
    const externalInsights = await fetchExternalInsights(data, query);

    return {
      type: 'insights',
      content: `Based on my analysis of your data and external market conditions, here are the key insights: ${analysis.primaryInsight}`,
      confidence: 0.89,
      insights: [
        {
          type: 'pattern',
          title: 'Key Pattern Identified',
          description: analysis.primaryInsight,
          confidence: analysis.confidence,
          businessContext: externalInsights.businessContext
        },
        {
          type: 'anomaly',
          title: 'Anomaly Detection',
          description: analysis.anomaly,
          confidence: 0.76,
          businessContext: externalInsights.anomalyContext
        }
      ],
      externalContext: externalInsights,
      businessImpact: {
        level: intent.businessImpact,
        roi: 'Medium - Data-driven decisions improve outcomes by 40%',
        stakeholders: intent.stakeholders || ['Analysts', 'Management']
      },
      actionItems: analysis.actionItems
    };
  }

  async function generateComparisonResponse(
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> {

    const comparison = await performRAGComparison(data, query);
    const competitorData = await fetchCompetitorData(query);

    return {
      type: 'insights',
      content: `I've compared your performance against benchmarks and competitors. Here's what I found: ${comparison.summary}`,
      confidence: 0.91,
      insights: [
        {
          type: 'comparison',
          title: 'Competitive Position Analysis',
          description: comparison.position,
          confidence: 0.88,
          businessContext: competitorData
        }
      ],
      externalContext: competitorData,
      businessImpact: {
        level: 'high',
        roi: 'High - Competitive intelligence can increase market share by 25%',
        stakeholders: intent.stakeholders || ['Leadership', 'Strategy']
      },
      actionItems: [
        'Leverage competitive advantages',
        'Address identified gaps',
        'Monitor competitor movements'
      ]
    };
  }

  async function generatePredictionResponse(
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> {

    const prediction = await performRAGPrediction(data, intent.timeFrame);
    const marketConditions = await fetchMarketConditions();

    return {
      type: 'predictions',
      content: `Based on current trends and market conditions, I predict ${prediction.summary} over the ${intent.timeFrame || 'next quarter'}`,
      confidence: prediction.confidence,
      data: prediction.data,
      externalContext: marketConditions,
      businessImpact: {
        level: 'high',
        roi: 'Very High - Predictive insights can increase profitability by 35%',
        stakeholders: intent.stakeholders || ['Leadership', 'Finance', 'Operations']
      },
      actionItems: [
        'Prepare resources for predicted changes',
        'Set up early warning indicators',
        'Adjust strategies based on predictions'
      ]
    };
  }

  async function generateEnrichmentResponse(
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> {

    const enrichment = await performRAGEnrichment(data, query);

    return {
      type: 'enrichment',
      content: `I've enriched your data with external context including market trends, competitor data, and industry benchmarks. Here's what I found:`,
      confidence: 0.87,
      externalContext: enrichment,
      businessImpact: {
        level: 'medium',
        roi: 'Medium - External context improves decision accuracy by 45%',
        stakeholders: intent.stakeholders || ['Analysts', 'Marketing']
      },
      actionItems: [
        'Integrate external insights into strategy',
        'Monitor for changes in external context',
        'Update analysis periodically'
      ]
    };
  }

  async function generateInsightsResponse(
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> {

    const insights = await performRAGInsightGeneration(data, query);

    return {
      type: 'insights',
      content: `Based on comprehensive analysis of your data with external context, here are the key insights:`,
      confidence: 0.86,
      insights: insights,
      businessImpact: {
        level: 'high',
        roi: 'High - AI-generated insights improve decision quality by 50%',
        stakeholders: intent.stakeholders || ['Leadership', 'Strategy', 'Operations']
      },
      actionItems: insights.map(insight => insight.recommendation).filter(Boolean)
    };
  }

  async function generateGenericResponse(
    intent: RAGQueryIntent,
    query: string,
    data: any[]
  ): Promise<RAGResponse> {

    return {
      type: 'insights',
      content: `I understand you're asking about "${query}". Let me help you explore this data. Would you like me to create visualizations, analyze trends, or generate specific insights?`,
      confidence: 0.75,
      businessImpact: {
        level: 'medium',
        stakeholders: ['User']
      },
      actionItems: [
        'Clarify the specific analysis needed',
        'Identify relevant data subsets',
        'Determine optimal visualization approach'
      ]
    };
  }

  // Helper Functions
  function determineOptimalVisualization(query: string, data: any[]): string {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('trend') || lowerQuery.includes('time') || lowerQuery.includes('over time')) {
      return 'line chart';
    }
    if (lowerQuery.includes('compare') || lowerQuery.includes('versus') || lowerQuery.includes('category')) {
      return 'bar chart';
    }
    if (lowerQuery.includes('proportion') || lowerQuery.includes('percentage') || lowerQuery.includes('share')) {
      return 'pie chart';
    }
    if (lowerQuery.includes('relationship') || lowerQuery.includes('correlation')) {
      return 'scatter plot';
    }
    if (lowerQuery.includes('distribution') || lowerQuery.includes('spread')) {
      return 'histogram';
    }

    return 'bar chart'; // Default
  }

  function analyzeBusinessContext(query: string, data: any[]): any {
    // Simulated business context analysis
    return {
      domain: detectBusinessDomain(query),
      metrics: detectBusinessMetrics(query),
      urgency: detectUrgency(query),
      stakeholders: extractStakeholders(query)
    };
  }

  function generateVisualizationTitle(query: string): string {
    // Generate human-readable title from query
    return query.charAt(0).toUpperCase() + query.slice(1).replace(/[?!.]$/, '');
  }

  function generateVisualizationOptimization(query: string, data: any[]): any {
    return {
      colorScheme: 'business-appropriate',
      layout: 'readability-optimized',
      focus: 'highlighting-key-insights',
      annotations: 'automated',
      interactivity: 'contextual'
    };
  }

  function generateVisualizationInsights(data: any[], query: string): any[] {
    return [
      {
        type: 'pattern',
        description: 'Automated pattern detection based on data characteristics',
        confidence: 0.85
      }
    ];
  }

  // Simulated RAG Processing Functions
  async function fetchExternalBusinessData(businessContext: any): Promise<any> {
    return {
      marketConditions: {
        growth: '+3.2%',
        stability: 'high',
        outlook: 'positive'
      },
      industryBenchmarks: {
        average: 87,
        top: 94,
        median: 85
      },
      competitorInsights: {
        averageGrowth: '+5.1%',
        marketTrends: 'digital transformation'
      }
    };
  }

  async function performRAGAnalysis(data: any[], query: string): Promise<any> {
    return {
      primaryInsight: 'Data shows consistent growth with seasonal patterns',
      anomaly: 'Q3 showed unusual spike - investigate external factors',
      confidence: 0.89,
      actionItems: ['Investigate Q3 spike', 'Monitor seasonal patterns']
    };
  }

  async function fetchExternalInsights(data: any[], query: string): Promise<any> {
    return {
      businessContext: 'Current market conditions favor growth strategies',
      anomalyContext: 'Q3 spike aligns with industry-wide trend',
      marketSentiment: 'positive with some uncertainty'
    };
  }

  async function performRAGComparison(data: any[], query: string): Promise<any> {
    return {
      summary: 'Your performance is 12% above industry average',
      position: 'Top 15% in industry',
      gaps: ['Digital transformation', 'Customer retention'],
      advantages: ['Product quality', 'Market responsiveness']
    };
  }

  async function fetchCompetitorData(query: string): Promise<any> {
    return {
      averagePerformance: 75,
      topPerformer: 91,
      industryAverage: 78,
      yourPosition: 87,
      strengths: ['Innovation', 'Customer service'],
      weaknesses: ['Speed', 'Scale']
    };
  }

  async function performRAGPrediction(data: any[], timeFrame?: string): Promise<any> {
    return {
      summary: '15% growth predicted with 85% confidence',
      confidence: 0.85,
      data: Array.from({ length: 12 }, (_, i) => ({
        period: `Month ${i + 1}`,
        predicted: data[0] * (1 + 0.15 * (i + 1) / 12),
        confidence: Math.max(0.6, 0.95 - i * 0.03)
      })),
      keyDrivers: ['Market expansion', 'Product innovation', 'Operational efficiency'],
      risks: ['Economic uncertainty', 'Competitive pressure']
    };
  }

  async function fetchMarketConditions(): Promise<any> {
    return {
      gdpGrowth: '+2.8%',
      inflation: '+2.1%',
      confidence: 'high',
      trends: ['digital transformation', 'sustainability focus', 'ai adoption']
    };
  }

  async function performRAGEnrichment(data: any[], query: string): Promise<any> {
    return {
      marketData: {
        growth: '+4.2%',
        size: '$12.5B',
        opportunity: 'emerging markets'
      },
      competitorData: {
        marketShare: {
          you: '8.7%',
          leader: '23.4%',
          average: '5.2%'
        }
      },
      economicIndicators: {
        confidence: 'positive',
        interest: 'stable',
        investment: 'growing'
      }
    };
  }

  async function performRAGInsightGeneration(data: any[], query: string): Promise<any[]> {
    return [
      {
        type: 'strategic',
        title: 'Market Position Strength',
        description: 'Strong competitive position with opportunities for growth',
        confidence: 0.92,
        recommendation: 'Leverage current strengths for expansion',
        businessImpact: 'high'
      },
      {
        type: 'operational',
        title: 'Efficiency Opportunity',
        description: 'Process optimization could reduce costs by 15%',
        confidence: 0.78,
        recommendation: 'Implement process automation',
        businessImpact: 'medium'
      },
      {
        type: 'customer',
        title: 'Customer Retention',
        description: 'Customer satisfaction trends positive but retention needs focus',
        confidence: 0.83,
        recommendation: 'Invest in customer success programs',
        businessImpact: 'high'
      }
    ];
  }

  function detectBusinessDomain(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('sales') || lowerQuery.includes('revenue')) return 'sales';
    if (lowerQuery.includes('customer') || lowerQuery.includes('user')) return 'customer';
    if (lowerQuery.includes('product') || lowerQuery.includes('item')) return 'product';
    return 'general';
  }

  function detectBusinessMetrics(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const metrics = [];
    if (lowerQuery.includes('growth')) metrics.push('growth');
    if (lowerQuery.includes('revenue')) metrics.push('revenue');
    if (lowerQuery.includes('cost')) metrics.push('cost');
    if (lowerQuery.includes('satisfaction')) metrics.push('satisfaction');
    return metrics;
  }

  function detectUrgency(query: string): 'high' | 'medium' | 'low' {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('urgent') || lowerQuery.includes('immediately')) return 'high';
    if (lowerQuery.includes('asap') || lowerQuery.includes('soon')) return 'medium';
    return 'low';
  }

  function extractStakeholders(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const stakeholders = [];
    if (lowerQuery.includes('management')) stakeholders.push('Management');
    if (lowerQuery.includes('leadership')) stakeholders.push('Leadership');
    if (lowerQuery.includes('team')) stakeholders.push('Team');
    if (lowerQuery.includes('board')) stakeholders.push('Board');
    if (lowerQuery.includes('investors')) stakeholders.push('Investors');
    return stakeholders;
  }

  function assessBusinessImpact(query: string): 'high' | 'medium' | 'low' {
    const lowerQuery = query.toLowerCase();
    const highImpact = ['strategic', 'critical', 'essential', 'vital'];
    const mediumImpact = ['important', 'significant', 'valuable'];

    if (highImpact.some(word => lowerQuery.includes(word))) return 'high';
    if (mediumImpact.some(word => lowerQuery.includes(word))) return 'medium';
    return 'low';
  }

  function assessComplexity(query: string): 'simple' | 'moderate' | 'complex' {
    const queryLength = query.length;
    const wordCount = query.split(' ').length;
    const questionMarks = (query.match(/\?/g) || []).length;

    if (wordCount <= 5 && questionMarks <= 1) return 'simple';
    if (wordCount <= 15 && questionMarks <= 2) return 'moderate';
    return 'complex';
  }

  function extractVisualizationGoal(query: string): string {
    // Extract the core visualization goal from query
    return query.replace(/^(show me|create|visualize|display|render)\s+/i, '').replace(/\?.*$/, '');
  }

  function extractAnalysisGoal(query: string): string {
    return query.replace(/^(analyze|what|how|why|explain)\s+/i, '').replace(/\?.*$/, '');
  }

  function extractComparisonGoal(query: string): string {
    return query.replace(/^(compare|contrast|versus|vs|against)\s+/i, '').replace(/\?.*$/, '');
  }

  function extractPredictionGoal(query: string): string {
    return query.replace(/^(predict|forecast|project|estimate)\s+/i, '').replace(/\?.*$/, '');
  }

  function extractEnrichmentGoal(query: string): string {
    return query.replace(/^(enrich|add|include|external|market)\s+/i, '').replace(/\?.*$/, '');
  }

  function extractTimeFrame(query: string): string {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('next month') || lowerQuery.includes('30 days')) return 'next month';
    if (lowerQuery.includes('next quarter') || lowerQuery.includes('3 months')) return 'next quarter';
    if (lowerQuery.includes('next year') || lowerQuery.includes('12 months')) return 'next year';
    return 'future';
  }

  return (
    <div className="flex flex-col h-full glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" style={{ color: theme.colors.accent }} />
            <h2 className="font-semibold" style={{ color: theme.colors.text }}>
              RAG Analytics Assistant
            </h2>
          </div>
          {enableRAG && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                RAG Active
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {enableCollaboration && (
            <button className="p-2 rounded-lg glass-morphism hover-3d transition-all" title="Share with team">
              <Users className="w-4 h-4" style={{ color: theme.colors.text }} />
            </button>
          )}
          <button className="p-2 rounded-lg glass-morphism hover-3d transition-all" title="Download conversation">
            <Download className="w-4 h-4" style={{ color: theme.colors.text }} />
          </button>
          <button className="p-2 rounded-lg glass-morphism hover-3d transition-all" title="Refresh suggestions" onClick={generateQuerySuggestions}>
            <RefreshCw className="w-4 h-4" style={{ color: theme.colors.text }} />
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {querySuggestions.length > 0 && (
        <div className="px-4 py-2 border-b" style={{ borderColor: theme.colors.border }}>
          <p className="text-xs font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
            💡 Suggested queries:
          </p>
          <div className="flex flex-wrap gap-2">
            {querySuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setInputValue(suggestion)}
                className="px-3 py-1 rounded-lg text-xs glass-morphism hover-3d transition-all truncate max-w-xs"
                style={{ color: theme.colors.text }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.type === 'ai' && (
              <div className="flex items-start gap-3 max-w-3xl">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${theme.colors.accent}20` }}>
                  <Brain className="w-4 h-4" style={{ color: theme.colors.accent }} />
                </div>
                <div className="space-y-2">
                  <div className="glass-card rounded-2xl rounded-tl-none p-4" style={{ backgroundColor: theme.colors.foreground }}>
                    <p className="text-sm" style={{ color: theme.colors.text }}>
                      {message.content}
                    </p>
                  </div>

                  {/* Insights Panel */}
                  {message.insights && message.insights.length > 0 && (
                    <div className="glass-card rounded-lg p-3" style={{ backgroundColor: theme.colors.background }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4" style={{ color: theme.colors.accent }} />
                        <h4 className="font-medium text-xs" style={{ color: theme.colors.text }}>
                          AI Insights
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {message.insights.map((insight, index) => (
                          <div key={index} className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            • {insight.title}: {insight.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items */}
                  {message.actionItems && message.actionItems.length > 0 && (
                    <div className="glass-card rounded-lg p-3" style={{ backgroundColor: theme.colors.background }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4" style={{ color: theme.colors.accent }} />
                        <h4 className="font-medium text-xs" style={{ color: theme.colors.text }}>
                          Recommended Actions
                        </h4>
                      </div>
                      <div className="space-y-1">
                        {message.actionItems.map((action, index) => (
                          <div key={index} className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            ✓ {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {message.type === 'user' && (
              <div className="max-w-2xl">
                <div className="glass-card rounded-2xl rounded-tr-none p-4" style={{ backgroundColor: theme.colors.accent }}>
                  <p className="text-sm text-white">{message.content}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${theme.colors.accent}20` }}>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" style={{ borderColor: theme.colors.accent }} />
            </div>
            <div className="glass-card rounded-2xl rounded-tl-none p-4" style={{ backgroundColor: theme.colors.foreground }}>
              <div className="flex items-center gap-2">
                <div className="animate-pulse">🧠</div>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  Processing with RAG intelligence...
                </p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center gap-2">
          {enableVoice && (
            <button
              onClick={processVoiceCommand}
              disabled={isProcessing || isListening}
              className={`p-3 rounded-xl transition-all ${
                isListening ? 'animate-pulse' : 'glass-morphism hover-3d'
              } ${isProcessing ? 'opacity-50' : ''}`}
              style={{
                backgroundColor: isListening ? `${theme.colors.accent}40` : theme.colors.foreground,
                color: isListening ? theme.colors.accent : theme.colors.text
              }}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}

          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !isProcessing) {
                  processUserMessage(inputValue);
                }
              }}
              placeholder="Ask about your data, request visualizations, or get insights..."
              disabled={isProcessing}
              className="w-full px-4 py-3 rounded-xl glass-card text-sm"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                paddingRight: isGeneratingInsights ? '3rem' : '1rem'
              }}
            />
            {isGeneratingInsights && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" style={{ borderColor: theme.colors.accent }} />
              </div>
            )}
          </div>

          <button
            onClick={() => processUserMessage(inputValue)}
            disabled={!inputValue.trim() || isProcessing}
            className="p-3 rounded-xl transition-all disabled:opacity-50"
            style={{
              background: inputValue.trim() && !isProcessing
                ? `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                : theme.colors.foreground,
              color: inputValue.trim() && !isProcessing ? 'white' : theme.colors.text
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {isListening && (
          <p className="text-xs mt-2 text-center" style={{ color: theme.colors.textSecondary }}>
            🎤 Listening... Speak your query
          </p>
        )}
      </div>
    </div>
  );
}
