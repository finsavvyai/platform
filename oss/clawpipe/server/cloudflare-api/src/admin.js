/** Admin key management endpoints. */

import { json } from "./middleware.js";
import { TIER_LIMITS } from "./auth.js";

export async function handleAdmin(request, url, env, cors) {
  const adminKey = request.headers.get("X-Admin-Key") || "";
  if (!adminKey || adminKey !== env.ADMIN_SECRET) {
    return json({ error: "Unauthorized" }, 401, cors);
  }

  const path = url.pathname;

  // POST /admin/keys — Create key
  if (path === "/admin/keys" && request.method === "POST") {
    const body = await request.json();
    const name = body.name || "unnamed";
    const tier = body.tier || "free";
    if (!TIER_LIMITS[tier]) {
      return json(
        { error: "Invalid tier", valid_tiers: Object.keys(TIER_LIMITS) },
        400,
        cors,
      );
    }
    const newKey = "fsa_" + crypto.randomUUID().replace(/-/g, "");
    const keyData = {
      name,
      tier,
      created: new Date().toISOString(),
      active: true,
    };
    await env.API_KEYS.put(newKey, JSON.stringify(keyData));
    return json({ key: newKey, ...keyData }, 201, cors);
  }

  // GET /admin/keys — List keys
  if (path === "/admin/keys" && request.method === "GET") {
    const list = await env.API_KEYS.list();
    const keys = [];
    for (const k of list.keys) {
      if (k.name.startsWith("__")) continue;
      const data = await env.API_KEYS.get(k.name, { type: "json" });
      keys.push({ key: k.name, ...data });
    }
    return json({ keys, count: keys.length }, 200, cors);
  }

  // GET /admin/keys/:key — Get key info
  if (path.startsWith("/admin/keys/") && request.method === "GET") {
    const key = path.slice("/admin/keys/".length);
    const data = await env.API_KEYS.get(key, { type: "json" });
    if (!data) return json({ error: "Key not found" }, 404, cors);
    return json({ key, ...data }, 200, cors);
  }

  // DELETE /admin/keys/:key — Deactivate key
  if (path.startsWith("/admin/keys/") && request.method === "DELETE") {
    const key = path.slice("/admin/keys/".length);
    const data = await env.API_KEYS.get(key, { type: "json" });
    if (!data) return json({ error: "Key not found" }, 404, cors);
    data.active = false;
    await env.API_KEYS.put(key, JSON.stringify(data));
    return json({ message: "Key deactivated", key }, 200, cors);
  }

  return json({ error: "Admin endpoint not found" }, 404, cors);
}
