// API: generate, preview, export
import { Router, Request, Response } from 'express';
import { CodeGenerator, Framework } from '../services/generator';
import { TemplateEngine } from '../services/template-engine';
import { PreviewService } from '../services/preview';

const router = Router();
const generator = new CodeGenerator();
const templateEngine = new TemplateEngine();
const previewService = new PreviewService();

interface GenerateRequest {
  prompt: string;
  framework: Framework;
}

interface RenderTemplateRequest {
  templateId: string;
  variables: Record<string, string>;
}

interface PreviewRequest {
  code: string;
  framework: string;
}

// Generate code from prompt
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, framework } = req.body as GenerateRequest;

    if (!prompt || !framework) {
      res.status(400).json({ error: 'Missing prompt or framework' });
      return;
    }

    const generated = await generator.generate(prompt, framework);
    res.status(201).json(generated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Generation failed',
    });
  }
});

// Get generated code
router.get('/generate/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const generated = generator.getGenerated(id);

    if (!generated) {
      res.status(404).json({ error: 'Generated code not found' });
      return;
    }

    res.json(generated);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// List all templates
router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = templateEngine.listTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Render template
router.post('/templates/render', (req: Request, res: Response) => {
  try {
    const { templateId, variables } = req.body as RenderTemplateRequest;

    if (!templateId || !variables) {
      res.status(400).json({ error: 'Missing templateId or variables' });
      return;
    }

    const missing = templateEngine.validateVariables(templateId, variables);
    if (missing.length > 0) {
      res.status(400).json({ error: 'Missing variables', missing });
      return;
    }

    const rendered = templateEngine.render(templateId, variables);

    if (!rendered) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({ rendered });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Create preview
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { code, framework } = req.body as PreviewRequest;

    if (!code || !framework) {
      res.status(400).json({ error: 'Missing code or framework' });
      return;
    }

    const preview = await previewService.createPreview(code, framework);
    res.status(201).json(preview);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Preview creation failed',
    });
  }
});

// Run preview
router.post('/preview/:id/run', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await previewService.runPreview(id);

    if (!session) {
      res.status(404).json({ error: 'Preview session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Run failed',
    });
  }
});

// Update preview code
router.put('/preview/:id/code', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code } = req.body as { code: string };

    if (!code) {
      res.status(400).json({ error: 'Missing code' });
      return;
    }

    const session = previewService.updateCode(id, code);

    if (!session) {
      res.status(404).json({ error: 'Preview session not found' });
      return;
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Update failed',
    });
  }
});

// Stop preview
router.post('/preview/:id/stop', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stopped = previewService.stopPreview(id);

    if (!stopped) {
      res.status(404).json({ error: 'Preview session not found' });
      return;
    }

    res.json({ message: 'Preview stopped' });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Stop failed',
    });
  }
});

export default router;
export { generator, templateEngine, previewService };
