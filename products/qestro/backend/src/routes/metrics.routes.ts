/**
 * Prometheus metrics endpoint — powered by @finsavvyai/monitor
 */

import express from 'express';
import { getPrometheusOutput } from '@finsavvyai/monitor';

const router = express.Router();

router.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(getPrometheusOutput());
});

export default router;
