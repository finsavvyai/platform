/**
 * POST /api/score — accepts an attack submission and returns the verdict.
 *
 * Body: { challengeId: string, attempt: string, objectiveAchieved?: boolean }
 *
 * `objectiveAchieved` is set by the host LLM grader (a separate model run
 * that judges whether the model's output satisfied the objective). For the
 * MVP the client passes through whatever the player self-attests; a server-
 * side grader hooks in once the host model is wired.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import challengesJson from '../../../../data/challenges.json';
import { scoreRemote } from '../../lib/guard';
import { judge, type Challenge } from '../../lib/scoring';

const challenges = challengesJson as Challenge[];

interface ScoreRequest {
  challengeId?: string;
  attempt?: string;
  objectiveAchieved?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as ScoreRequest;
  if (!body.challengeId || typeof body.attempt !== 'string') {
    res.status(400).json({ error: 'challengeId and attempt are required' });
    return;
  }

  const challenge = challenges.find((c) => c.id === body.challengeId);
  if (!challenge) {
    res.status(404).json({ error: 'unknown challenge' });
    return;
  }

  const guard = await scoreRemote(body.attempt);
  const verdict = judge(guard, challenge, Boolean(body.objectiveAchieved));

  res.status(200).json({
    challengeId: body.challengeId,
    guard,
    verdict,
  });
}
