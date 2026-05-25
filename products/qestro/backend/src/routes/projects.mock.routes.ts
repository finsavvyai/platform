/**
 * Projects Mock Routes
 * In-memory CRUD for projects — used by the mock backend
 */
import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

export interface MockProject {
  id: string;
  name: string;
  description: string;
  url: string;
  framework: string;
  createdAt: string;
  updatedAt: string;
}

export const projectStore: MockProject[] = [
  {
    id: 'proj-opensyber',
    name: 'OpenSyber',
    description: 'Runtime Security for AI Agents — opensyber.cloud',
    url: 'https://opensyber.cloud',
    framework: 'Next.js',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// GET /api/projects
router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: projectStore });
});

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response) => {
  const proj = projectStore.find((p) => p.id === req.params.id);
  if (!proj) return res.status(404).json({ success: false, error: 'Project not found' });
  res.json({ success: true, data: proj });
});

// POST /api/projects
router.post('/', (req: Request, res: Response) => {
  const { name, description = '', url = '', framework = '' } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Name required' });

  const proj: MockProject = {
    id: randomUUID(),
    name,
    description,
    url,
    framework,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projectStore.push(proj);
  res.status(201).json({ success: true, data: proj });
});

export default router;
