// Jenkins Remote API client — basic-auth bridge; mirrors status + triggers
// builds during migrations. Bridge fetch-time SSRF guard: bridge-fetch-guard.
import { assertSafeBaseUrl } from "./bridge-fetch-guard";

export interface JenkinsAuth {
  user: string;
  apiToken: string;
}

const guard = (baseUrl: string): void => assertSafeBaseUrl(baseUrl, "jenkins");

export interface JenkinsCrumb {
  crumb: string;
  field: string;
}

export interface JenkinsJobInfo {
  name: string;
  url: string;
  color?: string;
  buildable?: boolean;
  lastBuild?: { number: number; url: string } | null;
  lastSuccessfulBuild?: { number: number; url: string } | null;
  lastFailedBuild?: { number: number; url: string } | null;
  healthReport?: Array<{ score: number; description: string }>;
}

export interface JenkinsBuildInfo {
  id: string;
  number: number;
  url: string;
  result: "SUCCESS" | "FAILURE" | "ABORTED" | "UNSTABLE" | null;
  building: boolean;
  duration: number;
  timestamp: number;
  displayName?: string;
  estimatedDuration?: number;
}

function basicAuthHeader(auth: JenkinsAuth): string {
  return "Basic " + btoa(`${auth.user}:${auth.apiToken}`);
}

function trimSlash(baseUrl: string): string { return baseUrl.replace(/\/+$/, ""); }

function buildHeaders(auth: JenkinsAuth, crumb?: JenkinsCrumb, contentType?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: basicAuthHeader(auth),
    Accept: "application/json",
  };
  if (crumb) headers[crumb.field] = crumb.crumb;
  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

async function expectOk(res: Response, context: string): Promise<void> {
  if (res.ok) return;
  const body = await safeText(res);
  throw new Error(`jenkins ${context} failed: ${res.status} ${body.slice(0, 200)}`);
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ""; }
}

/** GET /crumbIssuer/api/json — fetch CSRF crumb for state-changing calls. */
export async function getCrumb(baseUrl: string, auth: JenkinsAuth): Promise<JenkinsCrumb | null> {
  guard(baseUrl);
  const url = `${trimSlash(baseUrl)}/crumbIssuer/api/json`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  if (res.status === 404) return null; // CSRF disabled
  if (!res.ok) return null;
  const body = (await res.json()) as { crumb?: string; crumbRequestField?: string };
  if (!body.crumb || !body.crumbRequestField) return null;
  return { crumb: body.crumb, field: body.crumbRequestField };
}

/** GET /job/:job/api/json?depth=1 — fetch job configuration + recent builds. */
export async function getJob(
  baseUrl: string,
  job: string,
  auth: JenkinsAuth
): Promise<JenkinsJobInfo> {
  guard(baseUrl);
  const url = `${trimSlash(baseUrl)}/job/${encodeURIComponent(job)}/api/json?depth=1`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, `getJob(${job})`);
  return (await res.json()) as JenkinsJobInfo;
}

/** GET /job/:job/api/json — list top-level jobs on the instance (folder-aware). */
export async function listJobs(
  baseUrl: string,
  auth: JenkinsAuth
): Promise<Array<{ name: string; url: string; color?: string }>> {
  guard(baseUrl);
  const url = `${trimSlash(baseUrl)}/api/json?tree=jobs[name,url,color]`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, "listJobs");
  const body = (await res.json()) as { jobs?: Array<{ name: string; url: string; color?: string }> };
  return body.jobs ?? [];
}

/** GET /job/:job/:buildId/api/json — fetch a specific build record. */
export async function getBuild(
  baseUrl: string,
  job: string,
  buildId: number | string,
  auth: JenkinsAuth
): Promise<JenkinsBuildInfo> {
  guard(baseUrl);
  const url = `${trimSlash(baseUrl)}/job/${encodeURIComponent(job)}/${buildId}/api/json`;
  const res = await fetch(url, { headers: buildHeaders(auth) });
  await expectOk(res, `getBuild(${job}#${buildId})`);
  return (await res.json()) as JenkinsBuildInfo;
}

/** POST /job/:job/buildWithParameters — trigger a parameterized build. */
export async function triggerBuild(
  baseUrl: string,
  job: string,
  params: Record<string, string>,
  auth: JenkinsAuth,
  crumb?: JenkinsCrumb
): Promise<{ ok: true; queueUrl: string | null }> {
  guard(baseUrl);
  const url = `${trimSlash(baseUrl)}/job/${encodeURIComponent(job)}/buildWithParameters`;
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) form.set(k, v);
  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(auth, crumb, "application/x-www-form-urlencoded"),
    body: form.toString(),
  });
  if (res.status !== 201 && res.status !== 200) {
    await expectOk(res, `triggerBuild(${job})`);
  }
  return { ok: true, queueUrl: res.headers.get("location") };
}

/** GET /job/:job/:buildId/consoleText — fetch the raw console log. */
export async function getConsoleText(
  baseUrl: string,
  job: string,
  buildId: number | string,
  auth: JenkinsAuth
): Promise<string> {
  guard(baseUrl);
  const url = `${trimSlash(baseUrl)}/job/${encodeURIComponent(job)}/${buildId}/consoleText`;
  const res = await fetch(url, {
    headers: { Authorization: basicAuthHeader(auth), Accept: "text/plain" },
  });
  await expectOk(res, `getConsoleText(${job}#${buildId})`);
  return await res.text();
}

/** GET /job/:job/config.xml — fetch the job's XML config (contains Jenkinsfile for pipeline jobs). */
export async function getConfigXml(
  baseUrl: string,
  job: string,
  auth: JenkinsAuth
): Promise<string> {
  guard(baseUrl);
  const url = `${trimSlash(baseUrl)}/job/${encodeURIComponent(job)}/config.xml`;
  const res = await fetch(url, {
    headers: { Authorization: basicAuthHeader(auth), Accept: "application/xml" },
  });
  await expectOk(res, `getConfigXml(${job})`);
  return await res.text();
}

/** Extract inline pipeline <script> from config.xml. "" when SCM-backed. */
export function extractScriptFromConfigXml(xml: string): string {
  const match = xml.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) return "";
  return decodeXmlEntities(match[1]);
}

function decodeXmlEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Normalize a Jenkins "color" status field into PushCI run status-ish values. */
export function jenkinsColorToStatus(
  color?: string
): "passed" | "failed" | "running" | "unstable" | "aborted" | "unknown" {
  if (!color) return "unknown";
  if (color.endsWith("_anime")) return "running";
  if (color === "blue") return "passed";
  if (color === "red") return "failed";
  if (color === "yellow") return "unstable";
  if (color === "aborted") return "aborted";
  return "unknown";
}
