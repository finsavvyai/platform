export type WebAuthnConfig = {
  readonly rpId: string;
  readonly rpName: string;
  readonly origins: readonly string[];
  readonly challengeTtlSeconds: number;
};

export const DEFAULT_CHALLENGE_TTL_SECONDS = 300;

export const buildWebAuthnConfig = (input: {
  readonly rpId: string;
  readonly rpName: string;
  readonly origins: readonly string[];
  readonly challengeTtlSeconds?: number;
}): WebAuthnConfig => ({
  rpId: input.rpId,
  rpName: input.rpName,
  origins: input.origins,
  challengeTtlSeconds: input.challengeTtlSeconds ?? DEFAULT_CHALLENGE_TTL_SECONDS,
});

export const isOriginAllowed = (
  config: WebAuthnConfig,
  origin: string,
): boolean => config.origins.includes(origin);
