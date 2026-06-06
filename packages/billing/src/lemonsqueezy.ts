const encoder = new TextEncoder();

export type LemonSqueezyWebhookVerificationInput = {
  readonly rawBody: string | Uint8Array;
  readonly secret: string;
  readonly signature: string | null | undefined;
};

const toBytes = (rawBody: string | Uint8Array): Uint8Array =>
  typeof rawBody === "string" ? encoder.encode(rawBody) : rawBody;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const timingSafeEqualStr = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

export const createLemonSqueezySignature = async (
  secret: string,
  rawBody: string | Uint8Array,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(toBytes(rawBody)),
  );
  return toHex(new Uint8Array(digest));
};

export const verifyLemonSqueezyWebhookSignature = async ({
  rawBody,
  secret,
  signature,
}: LemonSqueezyWebhookVerificationInput): Promise<boolean> => {
  if (!signature) return false;
  const expected = await createLemonSqueezySignature(secret, rawBody);
  return timingSafeEqualStr(expected, signature.trim().toLowerCase());
};

export const assertVerifiedLemonSqueezyWebhook = async (
  input: LemonSqueezyWebhookVerificationInput,
): Promise<void> => {
  const verified = await verifyLemonSqueezyWebhookSignature(input);
  if (!verified) {
    throw new Error("Invalid LemonSqueezy webhook signature");
  }
};
