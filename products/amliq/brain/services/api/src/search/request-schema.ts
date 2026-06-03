import { z } from "zod";
import type { SearchRequest } from "./types.js";

const searchBodySchema = z.object({
  q: z.string().trim().optional(),
  tenant_id: z.string().trim().optional(),
  top_k: z.unknown().optional(),
}).passthrough();

export type ParsedSearchRequest = Partial<SearchRequest>;

export const parseSearchRequest = (
  body: unknown,
): ParsedSearchRequest | null => {
  const parsed = searchBodySchema.safeParse(body);
  if (!parsed.success) return null;
  const data = parsed.data;
  return {
    ...(data.q !== undefined ? { q: data.q } : {}),
    ...(data.tenant_id !== undefined ? { tenant_id: data.tenant_id } : {}),
    ...(typeof data.top_k === "number" ? { top_k: data.top_k } : {}),
  };
};
