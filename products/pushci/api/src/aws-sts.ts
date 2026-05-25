// AWS STS AssumeRole client — obtains temporary credentials for a
// customer's AWS account via cross-account role assumption. Avoids
// storing long-lived access keys; customers grant us a role ARN
// with a trust policy limited to our account + external ID.
//
// confused-deputy protection:
// The customer's trust policy MUST require sts:ExternalId equal to a
// unique-per-tenant value. We forward `input.externalId` on every
// AssumeRole call as the `ExternalId` form parameter — AWS rejects
// the call if the value doesn't match the trust-policy condition.
// Without this, any other PushCI customer who learns the role ARN
// could potentially assume it (same PushCI AWS account boundary does
// not protect cross-customer).
//
// Reference:
// https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html

import { signRequest } from "./aws-sigv4";
import type { CodePipelineCreds } from "./aws-codepipeline";

export interface AssumeRoleInput {
  roleArn: string;
  externalId?: string;
  sessionName?: string;
  durationSeconds?: number;
  // Base credentials used to call STS (PushCI's IAM user).
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
}

interface AssumeRoleXmlCreds {
  AccessKeyId: string;
  SecretAccessKey: string;
  SessionToken: string;
  Expiration: string;
}

function xmlField(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
  return m ? m[1] : "";
}

function parseAssumeRoleResponse(xml: string): AssumeRoleXmlCreds {
  return {
    AccessKeyId: xmlField(xml, "AccessKeyId"),
    SecretAccessKey: xmlField(xml, "SecretAccessKey"),
    SessionToken: xmlField(xml, "SessionToken"),
    Expiration: xmlField(xml, "Expiration"),
  };
}

// assumeRole calls sts.amazonaws.com AssumeRole and returns
// temporary credentials usable with any AWS service (including
// CodePipeline). Duration defaults to 1 hour; max 12h depending
// on the target role's MaxSessionDuration.
export async function assumeRole(
  input: AssumeRoleInput
): Promise<CodePipelineCreds & { expiration: string }> {
  const region = input.region || "us-east-1";
  const url = "https://sts.amazonaws.com/";
  const params = new URLSearchParams({
    Action: "AssumeRole",
    Version: "2011-06-15",
    RoleArn: input.roleArn,
    RoleSessionName: input.sessionName || `pushci-${Date.now()}`,
    DurationSeconds: String(input.durationSeconds ?? 3600),
  });
  if (input.externalId) params.set("ExternalId", input.externalId);
  const body = params.toString();
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  const signed = await signRequest("POST", url, headers, body, {
    region,
    service: "sts",
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey,
  });

  const res = await fetch(url, { method: "POST", headers: signed, body });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`STS AssumeRole failed: ${res.status} ${text.slice(0, 500)}`);
  }
  const creds = parseAssumeRoleResponse(text);
  if (!creds.AccessKeyId) {
    throw new Error(`STS AssumeRole returned no credentials: ${text.slice(0, 500)}`);
  }
  return {
    region: input.region || "us-east-1",
    accessKeyId: creds.AccessKeyId,
    secretAccessKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken,
    expiration: creds.Expiration,
  };
}
