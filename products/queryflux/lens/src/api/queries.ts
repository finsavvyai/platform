// API: analyze, optimize, explain
import { Router, Request, Response } from 'express';
import { SQLParser } from '../services/sql-parser';
import { QueryAnalyzer } from '../services/query-analyzer';
import { QueryOptimizer } from '../services/optimizer';
import { ExplainVisualizer } from '../services/explain-visualizer';

const router = Router();
const parser = new SQLParser();
const analyzer = new QueryAnalyzer();
const optimizer = new QueryOptimizer();
const visualizer = new ExplainVisualizer();

interface AnalyzeRequest {
  query: string;
  tables?: Record<string, string[]>;
}

interface OptimizeRequest {
  query: string;
}

interface ExplainRequest {
  query: string;
  explainOutput: string[];
  format: 'text' | 'json' | 'html';
}

// Parse query
router.post('/parse', (req: Request, res: Response) => {
  try {
    const { query } = req.body as { query: string };

    if (!query) {
      res.status(400).json({ error: 'Missing query' });
      return;
    }

    const parsed = parser.parse(query);
    const complexity = parser.getQueryComplexity(parsed);

    res.json({ ...parsed, complexity });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Parse failed',
    });
  }
});

// Analyze query
router.post('/analyze', (req: Request, res: Response) => {
  try {
    const { query, tables } = req.body as AnalyzeRequest;

    if (!query) {
      res.status(400).json({ error: 'Missing query' });
      return;
    }

    const analysis = analyzer.analyzeQuery(query, tables);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

// Optimize query
router.post('/optimize', (req: Request, res: Response) => {
  try {
    const { query } = req.body as OptimizeRequest;

    if (!query) {
      res.status(400).json({ error: 'Missing query' });
      return;
    }

    const suggestions = optimizer.optimizeQuery(query);
    const optimized = optimizer.rewriteForPerformance(query);

    res.json({
      suggestions,
      optimizedQuery: optimized,
      count: suggestions.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Optimization failed',
    });
  }
});

// Analyze EXPLAIN plan
router.post('/explain', (req: Request, res: Response) => {
  try {
    const { query, explainOutput, format } = req.body as ExplainRequest;

    if (!query || !explainOutput) {
      res.status(400).json({ error: 'Missing query or explainOutput' });
      return;
    }

    const plan = visualizer.parseExplainPlan(query, explainOutput);
    const bottlenecks = visualizer.identifyBottlenecks(plan.id);

    let visualization: string | object | null = null;
    if (format === 'text') {
      visualization = visualizer.visualizeAsText(plan.id);
    } else if (format === 'json') {
      visualization = visualizer.visualizeAsJSON(plan.id);
    } else if (format === 'html') {
      visualization = visualizer.visualizeAsHTML(plan.id);
    }

    res.json({
      planId: plan.id,
      totalCost: plan.totalCost,
      bottlenecks,
      visualization: format === 'html' ? undefined : visualization,
      visualizationUrl: `/queries/explain/${plan.id}?format=${format}`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Explanation failed',
    });
  }
});

// Get visualization
router.get('/explain/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const formatStr = format as string;

    if (formatStr === 'text') {
      const text = visualizer.visualizeAsText(id);
      res.type('text/plain').send(text);
    } else if (formatStr === 'html') {
      const html = visualizer.visualizeAsHTML(id);
      res.type('text/html').send(html);
    } else {
      const json = visualizer.visualizeAsJSON(id);
      res.json(json);
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Compare queries
router.post('/compare', (req: Request, res: Response) => {
  try {
    const { query1, query2 } = req.body as { query1: string; query2: string };

    if (!query1 || !query2) {
      res.status(400).json({ error: 'Missing query1 or query2' });
      return;
    }

    const comparison = analyzer.compareQueries(query1, query2);

    res.json({
      faster: comparison.faster,
      improvementPercentage: comparison.improvement,
      recommendation: `Query ${comparison.faster} is faster`,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Comparison failed',
    });
  }
});

export default router;
export { parser, analyzer, optimizer, visualizer };
