import type { NextApiRequest, NextApiResponse } from 'next';
import { generateLlmsTxt } from '../../lib/llms-txt';
import type { LlmsTxtConfig } from '../../lib/types';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const config = req.body as LlmsTxtConfig;

  if (!config.title || !config.description || !Array.isArray(config.sections)) {
    return res.status(400).json({ error: 'Invalid llms.txt configuration' });
  }

  for (const section of config.sections) {
    if (!section.heading || !Array.isArray(section.links)) {
      return res.status(400).json({ error: 'Each section needs a heading and links array' });
    }
    for (const link of section.links) {
      if (!link.title || !link.url || !link.description) {
        return res.status(400).json({ error: 'Each link needs title, url, and description' });
      }
    }
  }

  const output = generateLlmsTxt(config);
  return res.status(200).json({ output });
}
