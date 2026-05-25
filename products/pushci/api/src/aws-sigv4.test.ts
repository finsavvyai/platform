// Tests for the AWS SigV4 signer.
//
// Where possible we use the published AWS test vectors from
// https://docs.aws.amazon.com/general/latest/gr/sigv4-signed-request-examples.html
// and the signing-key derivation example from
// https://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html#signature-v4-examples-js
//
// Our signer always injects `x-amz-content-sha256` into the signed header
// set. That means we can't match AWS's "iam ListUsers" example (which signs
// only host + x-amz-date) end-to-end. Instead we:
//   1. Test the signing-key derivation against the canonical AWS vector.
//   2. Test canonical query encoding / sorting.
//   3. Test canonical header folding.
//   4. Drive a full signRequest() and assert the canonical request shape
//      and that the signature is deterministic and correctly shaped.
//   5. Assert Authorization header layout matches AWS's documented format.

import { describe, it, expect } from "vitest";
import { signRequest, _internal, type AwsCreds } from "./aws-sigv4";

const { deriveSigningKey, canonicalHeaders, canonicalQuery, canonicalUri, sha256 } = _internal;

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("aws-sigv4 primitives", () => {
  it("derives the canonical AWS signing key (iam / us-east-1 / 20120215)", async () => {
    // From AWS docs: signature-v4-examples
    // secret = wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY
    // date   = 20120215
    // region = us-east-1
    // service = iam
    // expected kSigning = f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d
    const key = await deriveSigningKey(
      "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      "20120215",
      "us-east-1",
      "iam"
    );
    expect(hex(key)).toBe(
      "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d"
    );
  });

  it("canonicalizes and sorts query parameters by key then value", () => {
    expect(canonicalQuery("?b=2&a=1")).toBe("a=1&b=2");
    expect(canonicalQuery("a=2&a=1")).toBe("a=1&a=2");
    expect(canonicalQuery("")).toBe("");
    expect(canonicalQuery("?")).toBe("");
  });

  it("URI-encodes query values per RFC3986 (spaces, slashes, reserved chars)", () => {
    // Spaces must become %20, not +.
    expect(canonicalQuery("?name=John%20Doe")).toBe("name=John%20Doe");
    // Reserved characters in values get encoded.
    expect(canonicalQuery("?key=a/b")).toBe("key=a%2Fb");
  });

  it("normalizes empty path to /", () => {
    expect(canonicalUri("")).toBe("/");
    expect(canonicalUri("/")).toBe("/");
  });

  it("URI-encodes path segments but preserves slashes", () => {
    expect(canonicalUri("/foo/bar baz")).toBe("/foo/bar%20baz");
  });

  it("folds, lowercases, sorts, and trims whitespace in headers", () => {
    const { canonical, signed } = canonicalHeaders({
      Host: "example.amazonaws.com",
      "X-Amz-Date": "20150830T123600Z",
      "X-Custom": "   many   spaces   ",
    });
    expect(signed).toBe("host;x-amz-date;x-custom");
    expect(canonical).toBe(
      "host:example.amazonaws.com\n" +
        "x-amz-date:20150830T123600Z\n" +
        "x-custom:many spaces\n"
    );
  });

  it("sha256 of empty string matches the well-known constant", async () => {
    expect(await sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});

describe("aws-sigv4 signRequest end-to-end", () => {
  const creds: AwsCreds = {
    region: "us-east-1",
    service: "codepipeline",
    accessKeyId: "AKIDEXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  };

  it("produces an AWS4-HMAC-SHA256 Authorization header with correct layout", async () => {
    const url = "https://codepipeline.us-east-1.amazonaws.com/";
    const body = JSON.stringify({ name: "demo" });
    const headers = {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "CodePipeline_20150709.StartPipelineExecution",
    };
    const signed = await signRequest("POST", url, headers, body, creds, "20150830T123600Z");

    expect(signed["x-amz-date"]).toBe("20150830T123600Z");
    // content-sha256 must match the body.
    expect(signed["x-amz-content-sha256"]).toBe(await sha256(body));
    // host must be injected.
    expect(signed["host"]).toBe("codepipeline.us-east-1.amazonaws.com");

    const auth = signed["authorization"];
    expect(auth).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(auth).toContain(
      "Credential=AKIDEXAMPLE/20150830/us-east-1/codepipeline/aws4_request"
    );
    // SignedHeaders must be alphabetically sorted and include our injected ones.
    expect(auth).toContain(
      "SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-target"
    );
    // Signature is 64 hex chars.
    const sigMatch = auth.match(/Signature=([0-9a-f]{64})$/);
    expect(sigMatch).not.toBeNull();
  });

  it("produces a deterministic signature for identical inputs", async () => {
    const url = "https://codepipeline.us-east-1.amazonaws.com/";
    const body = JSON.stringify({ name: "demo" });
    const headers = {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "CodePipeline_20150709.StartPipelineExecution",
    };
    const a = await signRequest("POST", url, headers, body, creds, "20150830T123600Z");
    const b = await signRequest("POST", url, headers, body, creds, "20150830T123600Z");
    expect(a["authorization"]).toBe(b["authorization"]);
  });

  it("changes the signature when the body changes", async () => {
    const url = "https://codepipeline.us-east-1.amazonaws.com/";
    const headers = {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": "CodePipeline_20150709.StartPipelineExecution",
    };
    const a = await signRequest("POST", url, headers, `{"name":"a"}`, creds, "20150830T123600Z");
    const b = await signRequest("POST", url, headers, `{"name":"b"}`, creds, "20150830T123600Z");
    expect(a["authorization"]).not.toBe(b["authorization"]);
    expect(a["x-amz-content-sha256"]).not.toBe(b["x-amz-content-sha256"]);
  });

  it("includes x-amz-security-token when a session token is supplied", async () => {
    const withToken: AwsCreds = { ...creds, sessionToken: "IQoJb3Jp...EXAMPLE" };
    const signed = await signRequest(
      "POST",
      "https://codepipeline.us-east-1.amazonaws.com/",
      { "content-type": "application/x-amz-json-1.1" },
      "{}",
      withToken,
      "20150830T123600Z"
    );
    expect(signed["x-amz-security-token"]).toBe("IQoJb3Jp...EXAMPLE");
    expect(signed["authorization"]).toContain("x-amz-security-token");
  });

  // L-002 regression: the amzDate formatter previously called the same
  // replace() twice. Second pass was a no-op, but dropping it must not
  // change the output format. We verify that when nowIso is NOT passed,
  // the derived amzDate is still a 16-char basic-format AWS timestamp.
  it("derives a basic-format amzDate (YYYYMMDDTHHMMSSZ) from Date.now()", async () => {
    const signed = await signRequest(
      "POST",
      "https://codepipeline.us-east-1.amazonaws.com/",
      { "content-type": "application/x-amz-json-1.1" },
      "{}",
      creds
      // no nowIso — hits the `new Date().toISOString().replace(...)` path
    );
    const amzDate = signed["x-amz-date"];
    // AWS basic format: 8-digit date, "T", 6-digit time, "Z".
    expect(amzDate).toMatch(/^\d{8}T\d{6}Z$/);
    expect(amzDate).not.toContain("-");
    expect(amzDate).not.toContain(":");
    expect(amzDate).not.toMatch(/\.\d{3}/);
  });
});
