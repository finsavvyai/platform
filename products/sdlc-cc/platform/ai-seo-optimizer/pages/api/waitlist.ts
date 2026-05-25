import type { NextApiRequest, NextApiResponse } from 'next';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // In production: store to D1/KV, send confirmation email
  return res.status(200).json({
    success: true,
    message: 'Successfully joined the waitlist.',
  });
}
