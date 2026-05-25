// API: scan code, get results
import { Router, Request, Response } from 'express';
import { SecurityScanner } from '../services/scanner';
import { RuleEngine } from '../services/rule-engine';
import { ReportGenerator } from '../services/reporter';
import { AutoFixer } from '../services/fixer';

const router = Router();
const scanner = new SecurityScanner();
const ruleEngine = new RuleEngine();
const reporter = new ReportGenerator();
const fixer = new AutoFixer();

interface ScanRequest {
  code: string;
  filename: string;
  language: string;
}

interface ReportRequest {
  scanId: string;
  format: 'json' | 'sarif' | 'html' | 'markdown';
}

// Scan code
router.post('/scan', async (req: Request, res: Response) => {
  try {
    const { code, filename, language } = req.body as ScanRequest;

    if (!code || !filename) {
      res.status(400).json({ error: 'Missing code or filename' });
      return;
    }

    const result = await scanner.scanCode(code, filename, language);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Scan failed',
    });
  }
});

// Get scan result
router.get('/scan/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = scanner.getResult(id);

    if (!result) {
      res.status(404).json({ error: 'Scan result not found' });
      return;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Generate report
router.post('/report', (req: Request, res: Response) => {
  try {
    const { scanId, format } = req.body as ReportRequest;

    if (!scanId || !format) {
      res.status(400).json({ error: 'Missing scanId or format' });
      return;
    }

    const scan = scanner.getResult(scanId);
    if (!scan) {
      res.status(404).json({ error: 'Scan result not found' });
      return;
    }

    const report = reporter.createReport(scan.filename, scan.vulnerabilities, format);
    res.status(201).json({
      id: report.id,
      format: report.format,
      vulnerabilities: report.vulnerabilities,
      criticalCount: report.criticalCount,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Report generation failed',
    });
  }
});

// Get report content
router.get('/report/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const report = reporter.getReport(id);

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    if (report.format === 'html') {
      res.type('text/html').send(report.content);
    } else if (report.format === 'markdown') {
      res.type('text/markdown').send(report.content);
    } else {
      res.json(JSON.parse(report.content));
    }
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get fix suggestions
router.post('/fix', (req: Request, res: Response) => {
  try {
    const { code } = req.body as { code: string };

    if (!code) {
      res.status(400).json({ error: 'Missing code' });
      return;
    }

    const { code: fixedCode, appliedFixes } = fixer.suggestAndApplyFixes(code, [
      'xss',
      'sql-injection',
      'command-injection',
      'hardcoded-secret',
    ]);

    res.json({
      original: code,
      fixed: fixedCode,
      appliedFixes: appliedFixes.map((f) => ({
        type: f.type,
        explanation: f.explanation,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Fix generation failed',
    });
  }
});

// List scans
router.get('/scans', (req: Request, res: Response) => {
  try {
    const results = scanner.listResults();
    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
export { scanner, ruleEngine, reporter, fixer };
