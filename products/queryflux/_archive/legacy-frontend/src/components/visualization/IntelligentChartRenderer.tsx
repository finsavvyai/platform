import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Brain, TrendingUp, BarChart3, PieChart, Scatter, Activity, Lightbulb, AlertTriangle, Target, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface IntelligentChartRendererProps {
  data: any[];
  chartType: string;
  width?: number;
  height?: number;
  onChartCreated?: (chart: any) => void;
  enableRAG?: boolean;
  enablePredictions?: boolean;
  enableAnomalies?: boolean;
  businessContext?: any;
}

interface ChartInsight {
  type: 'prediction' | 'anomaly' | 'pattern' | 'business';
  title: string;
  description: string;
  confidence: number;
  actionability: 'high' | 'medium' | 'low';
  data?: any;
  recommendations?: string[];
}

interface ExternalContext {
  marketTrends?: any;
  competitorData?: any;
  industryBenchmarks?: any;
  economicIndicators?: any;
}

export function IntelligentChartRenderer({
  data,
  chartType,
  width = 600,
  height = 400,
  onChartCreated,
  enableRAG = true,
  enablePredictions = true,
  enableAnomalies = true,
  businessContext
}: IntelligentChartRendererProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [chartInsights, setChartInsights] = useState<ChartInsight[]>([]);
  const [externalContext, setExternalContext] = useState<ExternalContext>({});
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [predictedData, setPredictedData] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);

  // RAG-Powered Chart Analysis
  const performRAGChartAnalysis = useCallback(async (data: any[], chartType: string) => {
    if (!enableRAG) return;

    setIsGeneratingInsights(true);

    try {
      // Simulate RAG analysis with external data integration
      const insights = await generateChartInsights(data, chartType, businessContext);
      const externalData = await fetchExternalContext(data, chartType);
      const predictions = enablePredictions ? await generatePredictions(data, chartType) : [];
      const detectedAnomalies = enableAnomalies ? await detectAnomalies(data, chartType) : [];

      setChartInsights(insights);
      setExternalContext(externalData);
      setPredictedData(predictions);
      setAnomalies(detectedAnomalies);

    } catch (error) {
      console.error('RAG Chart Analysis Error:', error);
    } finally {
      setIsGeneratingInsights(false);
    }
  }, [enableRAG, enablePredictions, enableAnomalies, businessContext]);

  // Intelligent Chart Rendering
  const renderIntelligentChart = useCallback(() => {
    if (!canvasRef.current || !data || data.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Chart rendering based on type
    switch (chartType) {
      case 'bar':
        renderIntelligentBarChart(ctx, data, width, height);
        break;
      case 'line':
        renderIntelligentLineChart(ctx, data, width, height);
        break;
      case 'pie':
        renderIntelligentPieChart(ctx, data, width, height);
        break;
      case 'scatter':
        renderIntelligentScatterPlot(ctx, data, width, height);
        break;
      case 'heatmap':
        renderIntelligentHeatmap(ctx, data, width, height);
        break;
      default:
        renderIntelligentBarChart(ctx, data, width, height);
    }

    // Overlay RAG insights
    if (enableRAG) {
      renderInsightsOverlay(ctx, chartInsights);
    }

    // Overlay predictions
    if (enablePredictions && predictedData.length > 0) {
      renderPredictionsOverlay(ctx, predictedData);
    }

    // Overlay anomalies
    if (enableAnomalies && anomalies.length > 0) {
      renderAnomaliesOverlay(ctx, anomalies);
    }
  }, [data, chartType, width, height, enableRAG, enablePredictions, enableAnomalies, chartInsights, predictedData, anomalies]);

  // Bar Chart with RAG Intelligence
  const renderIntelligentBarChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (!data || data.length === 0) return;

    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Calculate dimensions
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;

    // Find max value
    const maxValue = Math.max(...data.map(d => d.value || 0));
    const scale = chartHeight / maxValue;

    // Draw bars with intelligence
    data.forEach((item, index) => {
      const value = item.value || 0;
      const barHeight = value * scale;
      const x = padding + index * (barWidth + barSpacing);
      const y = height - padding - barHeight;

      // Intelligent color based on performance vs external data
      const performanceColor = getPerformanceColor(value, externalContext);

      // Draw bar
      ctx.fillStyle = performanceColor;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Add gradient overlay for visual appeal
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, 'rgba(255,255,255,0.2)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw value label
      ctx.fillStyle = theme.colors.text;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value.toFixed(1), x + barWidth / 2, y - 5);

      // Draw category label
      ctx.save();
      ctx.translate(x + barWidth / 2, height - padding + 20);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(item.label || `Item ${index + 1}`, 0, 0);
      ctx.restore();
    });

    // Draw axes
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw title with RAG insights
    ctx.fillStyle = theme.colors.text;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const title = enableRAG ? '🧠 RAG-Enhanced Performance Analysis' : 'Performance Analysis';
    ctx.fillText(title, width / 2, 30);
  };

  // Line Chart with Predictive Intelligence
  const renderIntelligentLineChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (!data || data.length === 0) return;

    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxValue = Math.max(...data.map(d => d.value || 0));
    const scale = chartHeight / maxValue;
    const xStep = chartWidth / (data.length - 1);

    // Draw area under line with gradient
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);

    data.forEach((item, index) => {
      const value = item.value || 0;
      const x = padding + index * xStep;
      const y = height - padding - (value * scale);

      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth curve
        const prevX = padding + (index - 1) * xStep;
        const prevY = height - padding - ((data[index - 1].value || 0) * scale);
        const cp1x = prevX + xStep / 3;
        const cp1y = prevY;
        const cp2x = x - xStep / 3;
        const cp2y = y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      }
    });

    // Complete the area
    ctx.lineTo(padding + (data.length - 1) * xStep, height - padding);
    ctx.closePath();

    // Fill with intelligent gradient
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, `${theme.colors.accent}40`);
    gradient.addColorStop(1, `${theme.colors.accent}10`);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw the line
    ctx.beginPath();
    ctx.strokeStyle = theme.colors.accent;
    ctx.lineWidth = 3;

    data.forEach((item, index) => {
      const value = item.value || 0;
      const x = padding + index * xStep;
      const y = height - padding - (value * scale);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = padding + (index - 1) * xStep;
        const prevY = height - padding - ((data[index - 1].value || 0) * scale);
        const cp1x = prevX + xStep / 3;
        const cp1y = prevY;
        const cp2x = x - xStep / 3;
        const cp2y = y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      }
    });

    ctx.stroke();

    // Draw data points
    data.forEach((item, index) => {
      const value = item.value || 0;
      const x = padding + index * xStep;
      const y = height - padding - (value * scale);

      // Point with hover detection
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = theme.colors.accent;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw axes
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw title with predictive insights
    ctx.fillStyle = theme.colors.text;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const title = enablePredictions ? '🔮 Predictive Trend Analysis' : 'Trend Analysis';
    ctx.fillText(title, width / 2, 30);
  };

  // Pie Chart with Business Context
  const renderIntelligentPieChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (!data || data.length === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    // Calculate total and percentages
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    let currentAngle = -Math.PI / 2;

    // Color palette with business context
    const colors = [
      theme.colors.accent,
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#14b8a6'
    ];

    data.forEach((item, index) => {
      const value = item.value || 0;
      const percentage = value / total;
      const angle = percentage * Math.PI * 2;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
      ctx.closePath();

      // Apply business context coloring
      const color = getBusinessContextColor(item, externalContext, colors[index % colors.length]);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw percentage label
      const labelAngle = currentAngle + angle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${(percentage * 100).toFixed(1)}%`, labelX, labelY);

      currentAngle += angle;
    });

    // Draw legend with insights
    let legendY = 40;
    data.forEach((item, index) => {
      const value = item.value || 0;
      const percentage = (value / total * 100).toFixed(1);
      const color = colors[index % colors.length];

      // Color box
      ctx.fillStyle = color;
      ctx.fillRect(width - 150, legendY, 15, 15);

      // Label
      ctx.fillStyle = theme.colors.text;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${item.label}: ${percentage}%`, width - 130, legendY + 12);

      legendY += 25;
    });

    // Draw title
    ctx.fillStyle = theme.colors.text;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const title = enableRAG ? '📊 Business Context Analysis' : 'Distribution Analysis';
    ctx.fillText(title, width / 2, 30);
  };

  // Scatter Plot with Correlation Intelligence
  const renderIntelligentScatterPlot = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (!data || data.length === 0) return;

    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find min/max values
    const xValues = data.map(d => d.x || 0);
    const yValues = data.map(d => d.y || 0);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xScale = chartWidth / (xMax - xMin);
    const yScale = chartHeight / (yMax - yMin);

    // Draw correlation line if RAG is enabled
    if (enableRAG) {
      const correlation = calculateCorrelation(xValues, yValues);
      drawCorrelationLine(ctx, correlation, padding, chartWidth, chartHeight, xMin, xMax, yMin, yMax, xScale, yScale);
    }

    // Draw points with intelligence
    data.forEach((item, index) => {
      const x = padding + ((item.x || 0) - xMin) * xScale;
      const y = height - padding - ((item.y || 0) - yMin) * yScale;

      // Color based on outlier detection
      const isOutlier = enableAnomalies && isOutlierPoint(item, data);

      ctx.beginPath();
      ctx.arc(x, y, isOutlier ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isOutlier ? '#ef4444' : theme.colors.accent;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Highlight outliers
      if (isOutlier) {
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw axes
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw title
    ctx.fillStyle = theme.colors.text;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const title = enableRAG ? '🔗 Correlation Analysis' : 'Scatter Analysis';
    ctx.fillText(title, width / 2, 30);
  };

  // Overlay Functions
  const renderInsightsOverlay = (ctx: CanvasRenderingContext2D, insights: ChartInsight[]) => {
    insights.forEach((insight, index) => {
      const x = 10;
      const y = 60 + index * 80;

      // Background panel
      ctx.fillStyle = `${theme.colors.foreground}cc`;
      ctx.fillRect(x, y, 200, 70);

      // Icon based on type
      const icon = getInsightIcon(insight.type);

      // Title
      ctx.fillStyle = theme.colors.text;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(insight.title, x + 10, y + 20);

      // Description
      ctx.fillStyle = theme.colors.textSecondary;
      ctx.font = '10px sans-serif';
      const lines = wrapText(insight.description, 180);
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, x + 10, y + 35 + lineIndex * 12);
      });

      // Confidence indicator
      ctx.fillStyle = getConfidenceColor(insight.confidence);
      ctx.fillRect(x + 10, y + 55, insight.confidence * 180, 5);
    });
  };

  const renderPredictionsOverlay = (ctx: CanvasRenderingContext2D, predictions: any[]) => {
    // Render predicted data points/lines with different style
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    predictions.forEach((point, index) => {
      const x = 60 + index * 20;
      const y = 400 - point.value * 3;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      // Draw prediction point
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.stroke();
    ctx.setLineDash([]);
  };

  const renderAnomaliesOverlay = (ctx: CanvasRenderingContext2D, anomalies: any[]) => {
    anomalies.forEach(anomaly => {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(anomaly.x, anomaly.y, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Exclamation mark
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', anomaly.x, anomaly.y + 5);
    });
  };

  // Helper Functions
  function getPerformanceColor(value: number, context: ExternalContext): string {
    const industryAverage = context.industryBenchmarks?.average || 100;
    if (value > industryAverage * 1.2) return '#10b981'; // Green - excellent
    if (value > industryAverage) return '#3b82f6'; // Blue - good
    if (value > industryAverage * 0.8) return '#f59e0b'; // Yellow - average
    return '#ef4444'; // Red - below average
  }

  function getBusinessContextColor(item: any, context: ExternalContext, defaultColor: string): string {
    // Modify color based on business context
    const performance = externalContext.competitorData?.yourPosition || 'average';
    if (performance === 'Top 15%') return defaultColor;
    if (performance === 'Top 50%') return adjustColor(defaultColor, 0.8);
    return adjustColor(defaultColor, 0.6);
  }

  function adjustColor(color: string, factor: number): string {
    // Simple color adjustment for business context
    return color; // Simplified - would implement actual color adjustment
  }

  function calculateCorrelation(xValues: number[], yValues: number[]): number {
    const n = xValues.length;
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((total, x, i) => total + x * yValues[i], 0);
    const sumXX = xValues.reduce((total, x) => total + x * x, 0);
    const sumYY = yValues.reduce((total, y) => total + y * y, 0);

    const correlation = (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return correlation;
  }

  function drawCorrelationLine(ctx: CanvasRenderingContext2D, correlation: number, padding: number, chartWidth: number, chartHeight: number, xMin: number, xMax: number, yMin: number, yMax: number, xScale: number, yScale: number) {
    const slope = correlation * 0.5; // Simplified slope calculation
    const intercept = (yMin + yMax) / 2;

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);

    ctx.beginPath();
    ctx.moveTo(padding, height - padding - (intercept + xMin * slope) * yScale);
    ctx.lineTo(padding + chartWidth, height - padding - (intercept + xMax * slope) * yScale);
    ctx.stroke();

    ctx.setLineDash([]);
  }

  function isOutlierPoint(point: any, data: any[]): boolean {
    // Simplified outlier detection
    const xValues = data.map(d => d.x || 0);
    const yValues = data.map(d => d.y || 0);

    const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
    const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;

    const xStdDev = Math.sqrt(xValues.reduce((sum, x) => sum + Math.pow(x - xMean, 2), 0) / xValues.length);
    const yStdDev = Math.sqrt(yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0) / yValues.length);

    const xZScore = Math.abs((point.x - xMean) / xStdDev);
    const yZScore = Math.abs((point.y - yMean) / yStdDev);

    return xZScore > 2 || yZScore > 2;
  }

  function getInsightIcon(type: string) {
    switch (type) {
      case 'prediction': return <Zap className="w-4 h-4" />;
      case 'anomaly': return <AlertTriangle className="w-4 h-4" />;
      case 'pattern': return <TrendingUp className="w-4 h-4" />;
      case 'business': return <Target className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  }

  function getConfidenceColor(confidence: number): string {
    if (confidence > 0.8) return '#10b981';
    if (confidence > 0.6) return '#f59e0b';
    return '#ef4444';
  }

  function wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (testLine.length > maxWidth / 6) { // Rough estimation
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  // RAG Processing Functions (simulated)
  async function generateChartInsights(data: any[], chartType: string, businessContext?: any): Promise<ChartInsight[]> {
    return [
      {
        type: 'pattern',
        title: 'Growth Pattern Identified',
        description: 'Chart shows consistent growth pattern with seasonal variations',
        confidence: 0.87,
        actionability: 'high',
        recommendations: [
          'Consider doubling marketing efforts',
          'Prepare inventory for expected growth'
        ]
      },
      {
        type: 'business',
        title: 'Market Outperformance',
        description: 'Performance exceeds industry average by 23%',
        confidence: 0.92,
        actionability: 'medium',
        recommendations: [
          'Leverage outperformance in investor communications',
          'Analyze what drives superior performance'
        ]
      }
    ];
  }

  async function fetchExternalContext(data: any[], chartType: string): Promise<ExternalContext> {
    return {
      marketTrends: {
        direction: 'positive',
        strength: 0.73,
        timeframe: 'quarterly'
      },
      competitorData: {
        averagePerformance: 85,
        topPerformer: 94,
        yourPosition: 89
      },
      industryBenchmarks: {
        average: 82,
        top: 95,
        median: 84
      },
      economicIndicators: {
        gdpGrowth: '+2.3%',
        inflation: '+1.8%',
        confidence: 'high'
      }
    };
  }

  async function generatePredictions(data: any[], chartType: string): Promise<any[]> {
    // Simplified prediction based on trend
    const lastValue = data[data.length - 1]?.value || 0;
    const trend = data.length > 1 ? (data[data.length - 1].value - data[0].value) / data.length : 0;

    return Array.from({ length: 6 }, (_, i) => ({
      x: data.length + i,
      value: lastValue + trend * (i + 1),
      confidence: Math.max(0.5, 0.9 - i * 0.1)
    }));
  }

  async function detectAnomalies(data: any[], chartType: string): Promise<any[]> {
    // Simplified anomaly detection
    return data.filter((item, index) => {
      if (index === 0 || index === data.length - 1) return false;
      const prev = data[index - 1].value || 0;
      const next = data[index + 1].value || 0;
      const current = item.value || 0;
      const avgNeighbor = (prev + next) / 2;
      return Math.abs(current - avgNeighbor) > avgNeighbor * 0.5;
    }).map(item => ({ x: item.x || 0, y: item.y || 0, value: item.value }));
  }

  // Initialize chart analysis
  useEffect(() => {
    if (data && data.length > 0) {
      performRAGChartAnalysis(data, chartType);
    }
  }, [data, chartType, performRAGChartAnalysis]);

  // Render chart
  useEffect(() => {
    renderIntelligentChart();
  }, [renderIntelligentChart]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Handle hover interactions
          }
        }}
      />

      {/* RAG Insights Panel */}
      {enableRAG && chartInsights.length > 0 && (
        <div className="absolute top-4 right-4 w-80 max-h-96 overflow-y-auto">
          <div className="glass-card rounded-lg p-4" style={{ backgroundColor: theme.colors.foreground }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4" style={{ color: theme.colors.accent }} />
              <h3 className="font-semibold text-sm" style={{ color: theme.colors.text }}>
                RAG Insights
              </h3>
              {isGeneratingInsights && (
                <div className="animate-spin rounded-full h-3 w-3 border border-blue-500 border-t-transparent" style={{ borderColor: theme.colors.accent }} />
              )}
            </div>

            <div className="space-y-3">
              {chartInsights.map((insight, index) => (
                <div key={index} className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
                  <div className="flex items-center gap-2 mb-2">
                    {getInsightIcon(insight.type)}
                    <h4 className="font-medium text-xs" style={{ color: theme.colors.text }}>
                      {insight.title}
                    </h4>
                    <span className="text-xs px-2 py-1 rounded-full" style={{
                      backgroundColor: getConfidenceColor(insight.confidence) + '20',
                      color: getConfidenceColor(insight.confidence)
                    }}>
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                    {insight.description}
                  </p>
                  {insight.actionability === 'high' && (
                    <div className="text-xs font-medium" style={{ color: theme.colors.accent }}>
                      💡 High Impact Opportunity
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
