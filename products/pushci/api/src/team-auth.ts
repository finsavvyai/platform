// Shared auth helper for team routes.

import { verifyJwt } from "./auth";
import type { Env, JwtPayload } from "./types";

export async function getAuthUser(
  c: { req: { header: (n: string) => string | undefined }; env: Env },
): Promise<JwtPayload | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}
