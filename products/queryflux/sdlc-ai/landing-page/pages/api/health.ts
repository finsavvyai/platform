import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now(),
      message: 'OpenSyber landing page API is working'
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Internal server error'
    });
  }
}

export const runtime = 'edge';
