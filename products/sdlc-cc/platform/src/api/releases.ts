// API: create release, promote, rollback
import { Router, Request, Response } from 'express';
import { ReleaseManager } from '../services/release';

const router = Router();
const releaseManager = new ReleaseManager();

interface CreateReleaseRequest {
  version: string;
  description: string;
}

interface AddChangeLogRequest {
  entry: string;
}

interface RollbackRequest {
  previousVersion: string;
}

// Create release
router.post('/releases', (req: Request, res: Response) => {
  try {
    const { version, description } = req.body as CreateReleaseRequest;

    if (!version || !description) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const release = releaseManager.createRelease(version, description);
    res.status(201).json(release);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request';
    res.status(message.includes('already exists') ? 409 : 400).json({ error: message });
  }
});

// Get release
router.get('/releases/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const release = releaseManager.getRelease(id);

    if (!release) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    res.json(release);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Add changelog entry
router.post('/releases/:id/changelog', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { entry } = req.body as AddChangeLogRequest;

    if (!entry) {
      res.status(400).json({ error: 'Missing changelog entry' });
      return;
    }

    const release = releaseManager.addChangeLogEntry(id, entry);

    if (!release) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    res.json(release);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Publish release
router.post('/releases/:id/publish', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const release = releaseManager.publishRelease(id);

    if (!release) {
      res.status(404).json({ error: 'Release not found' });
      return;
    }

    res.json(release);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Cannot publish release',
    });
  }
});

// Rollback release
router.post('/releases/:id/rollback', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { previousVersion } = req.body as RollbackRequest;

    if (!previousVersion) {
      res.status(400).json({ error: 'Missing previousVersion' });
      return;
    }

    const release = releaseManager.rollbackRelease(id, previousVersion);

    if (!release) {
      res.status(404).json({ error: 'Release not found or not released' });
      return;
    }

    res.json(release);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// List releases
router.get('/releases', (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const releases = releaseManager.listReleases(
      status as 'draft' | 'released' | 'rolled-back' | undefined
    );
    res.json(releases);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Get latest version
router.get('/releases/version/latest', (_req: Request, res: Response) => {
  try {
    const version = releaseManager.getLatestVersion();
    res.json({ version });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
export { releaseManager };
