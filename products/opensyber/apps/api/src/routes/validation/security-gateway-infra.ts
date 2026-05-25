import { z } from 'zod';

export const networkActivitySchema = z.object({
  activity: z.array(z.object({
    domain: z.string().min(1),
    method: z.string().min(1),
    path: z.string().optional(),
    statusCode: z.number().int().optional(),
    action: z.string().optional(),
    bytesTransferred: z.number().int().optional(),
  })).min(1),
});

export const fileBaselinesSchema = z.object({
  baselines: z.array(z.object({
    filePath: z.string().min(1),
    sha256: z.string().min(1),
    permissions: z.string().optional(),
    size: z.number().int().optional(),
  })).min(1),
});

export const fileEventsSchema = z.object({
  events: z.array(z.object({
    filePath: z.string().min(1),
    changeType: z.string().min(1),
    previousHash: z.string().optional(),
    currentHash: z.string().optional(),
    details: z.string().optional(),
  })).min(1),
});

export const accessLogSchema = z.object({
  entries: z.array(z.object({
    accessType: z.string().min(1),
    sourceIp: z.string().optional(),
    sourceCountry: z.string().optional(),
    action: z.string().min(1),
    details: z.string().optional(),
  })).min(1),
});
