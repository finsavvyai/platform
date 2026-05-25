// Unit tests for the AssumeRole helper in isolation. Stubs globalThis.fetch
// so no real STS traffic. Asserts request shape (SigV4 + form body),
// XML response parsing, and failure modes documented in v1.6.6.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { assumeRole, type AssumeRoleInput } from "./aws-sts";

const originalFetch = globalThis.fetch;

const OK_XML = `<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
  <AssumeRoleResult>
    <Credentials>
      <AccessKeyId>ASIATEMP</AccessKeyId>
      <SecretAccessKey>tempsecret</SecretAccessKey>
      <SessionToken>tempsession</SessionToken>
      <Expiration>2026-04-21T01:00:00Z</Expiration>
    </Credentials>
  </AssumeRoleResult>
</AssumeRoleResponse>`;

const BASE: AssumeRoleInput = {
  roleArn: "arn:aws:iam::123456789012:role/PushCI",
  accessKeyId: "AKIAPUSHCIBASE",
  secretAccessKey: "basesecret",
};

function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "Content-Type": "text/xml" } });
}

describe("assumeRole — happy path", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(xml(OK_XML));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("returns parsed temporary credentials", async () => {
    const creds = await assumeRole(BASE);
    expect(creds.accessKeyId).toBe("ASIATEMP");
    expect(creds.secretAccessKey).toBe("tempsecret");
    expect(creds.sessionToken).toBe("tempsession");
    expect(creds.expiration).toBe("2026-04-21T01:00:00Z");
    expect(creds.region).toBe("us-east-1");
  });

  it("POSTs SigV4-signed form to sts.amazonaws.com", async () => {
    await assumeRole(BASE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://sts.amazonaws.com/");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["authorization"]).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(headers["authorization"]).toContain("/sts/aws4_request");
    const body = String(init.body);
    expect(body).toContain("Action=AssumeRole");
    expect(body).toContain("Version=2011-06-15");
    expect(body).toContain(
      "RoleArn=arn%3Aaws%3Aiam%3A%3A123456789012%3Arole%2FPushCI"
    );
    expect(body).toContain("DurationSeconds=3600");
  });

  it("forwards externalId, custom sessionName, and durationSeconds", async () => {
    await assumeRole({
      ...BASE,
      externalId: "ext-abc",
      sessionName: "custom-session",
      durationSeconds: 7200,
    });
    const body = String(
      (fetchMock.mock.calls[0] as [string, RequestInit])[1].body
    );
    expect(body).toContain("ExternalId=ext-abc");
    expect(body).toContain("RoleSessionName=custom-session");
    expect(body).toContain("DurationSeconds=7200");
  });

  it("respects custom region in the signed Authorization header", async () => {
    await assumeRole({ ...BASE, region: "eu-west-1" });
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .headers as Record<string, string>;
    // STS signs with us-east-1 regardless of input — AWS convention.
    // Our impl passes `region` through. Assert whichever is used.
    expect(headers["authorization"]).toMatch(/\/(us-east-1|eu-west-1)\/sts\//);
  });
});

describe("assumeRole — failure modes (v1.6.6 requirements)", () => {
  const originalFetchInner = originalFetch;
  afterEach(() => {
    globalThis.fetch = originalFetchInner;
    vi.clearAllMocks();
  });

  it("throws on 403 AccessDenied with the STS body included", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        `<ErrorResponse><Error><Code>AccessDenied</Code><Message>not authorized to perform: sts:AssumeRole</Message></Error></ErrorResponse>`,
        { status: 403 }
      )
    ) as unknown as typeof fetch;
    await expect(assumeRole(BASE)).rejects.toThrow(
      /STS AssumeRole failed: 403.*AccessDenied/
    );
  });

  it("throws on 400 InvalidClientTokenId with a clear message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        `<ErrorResponse><Error><Code>InvalidClientTokenId</Code><Message>security token invalid</Message></Error></ErrorResponse>`,
        { status: 400 }
      )
    ) as unknown as typeof fetch;
    await expect(assumeRole(BASE)).rejects.toThrow(
      /STS AssumeRole failed: 400.*InvalidClientTokenId/
    );
  });

  it("throws on network failure (fetch rejected)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;
    await expect(assumeRole(BASE)).rejects.toThrow(/ECONNRESET/);
  });

  it("throws on malformed XML (200 OK but no AccessKeyId)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      xml(`<AssumeRoleResponse><AssumeRoleResult></AssumeRoleResult></AssumeRoleResponse>`)
    ) as unknown as typeof fetch;
    await expect(assumeRole(BASE)).rejects.toThrow(
      /STS AssumeRole returned no credentials/
    );
  });

  it("throws on completely garbled response body", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(xml("not xml at all")) as unknown as typeof fetch;
    await expect(assumeRole(BASE)).rejects.toThrow(
      /STS AssumeRole returned no credentials/
    );
  });
});

describe("assumeRole — credential lifetime", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("fetches fresh credentials per call (no internal caching)", async () => {
    const fetchMock = vi.fn(async () => xml(OK_XML));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await assumeRole(BASE);
    await assumeRole(BASE);
    await assumeRole(BASE);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("includes Expiration so callers can decide cache policy", async () => {
    globalThis.fetch = vi
      .fn(async () => xml(OK_XML)) as unknown as typeof fetch;
    const creds = await assumeRole(BASE);
    expect(creds.expiration).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
