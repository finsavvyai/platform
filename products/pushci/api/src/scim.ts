// SCIM 2.0 provisioning for PushCI. Mounted at /scim/v2.
// Auth: `Authorization: Bearer <scimToken>`. Tenant via `?tenant=<slug>`.

import { Hono } from "hono";
import type { Env } from "./types";
import { verifyJwt } from "./auth";
import { SCHEMA_LIST, SCHEMA_SPC } from "./scim-types";
import { scimError, scimJson, checkScimAuth } from "./scim-helpers";
import { scimUsersRoutes } from "./scim-users";

export const scimRoutes = new Hono<{ Bindings: Env }>();

scimRoutes.get("/ServiceProviderConfig", () =>
  scimJson({
    schemas: [SCHEMA_SPC],
    documentationUri: "https://pushci.dev/docs/scim",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      { type: "oauthbearertoken", name: "OAuth Bearer Token", description: "Per-tenant PushCI SCIM token." },
    ],
  })
);

scimRoutes.route("/Users", scimUsersRoutes);

scimRoutes.get("/Groups", async (c) => {
  const session = await checkScimAuth(c);
  if (!session) return scimError(401, "unauthorized");
  return scimJson({
    schemas: [SCHEMA_LIST],
    totalResults: 0,
    startIndex: 1,
    itemsPerPage: 0,
    Resources: [],
  });
});

scimRoutes.post("/token/:tenant", async (c) => {
  const jwt = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = jwt ? await verifyJwt(jwt, c.env.JWT_SECRET) : null;
  if (!user) return scimError(401, "unauthorized");
  const tenant = c.req.param("tenant");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await c.env.RUNNERS.put(`scim:token:${tenant}`, token);
  return scimJson({ tenant, token });
});
