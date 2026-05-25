/**
 * Test fixtures for token-counter-flush tests. Kept here to keep individual
 * test files under the 200-line cap. Not included in dist (`_` prefix +
 * vitest config excludes test patterns).
 */

import type {
  AuditEmitterPort,
  TokenCounterPort,
  TokenCounterSnapshotLike,
} from "../types.js";

export const makeCounter = (
  snap: TokenCounterSnapshotLike,
): TokenCounterPort & { readonly resets: number } => {
  let resets = 0;
  return {
    snapshot: () => snap,
    reset: () => {
      resets += 1;
    },
    get resets() {
      return resets;
    },
  };
};

export type EmitterFixture = {
  readonly emitter: AuditEmitterPort;
  readonly emits: Array<Parameters<AuditEmitterPort["emit"]>[0]>;
};

export const makeEmitter = (): EmitterFixture => {
  const emits: Array<Parameters<AuditEmitterPort["emit"]>[0]> = [];
  const emitter: AuditEmitterPort = {
    emit: (input) => {
      emits.push(input);
      return undefined;
    },
  };
  return { emitter, emits };
};
