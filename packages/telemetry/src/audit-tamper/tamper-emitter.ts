/**
 * TamperEvidentEmitter.
 *
 * Wraps the existing `AuditEmitter` contract: takes `AuditInput`, returns the
 * redacted `AuditRecord`, never throws. In addition it chains + signs every
 * record and forwards a `SignedRecord` to a separate `signedSink`.
 *
 * Chain state (last hash + sequence id) is held in-memory by default and
 * optionally persisted via the injected `ChainStateStore`.
 *
 * NB: we do not modify `audit-log.ts`. We compose with it.
 */

import {
  AuditEmitter,
  type AuditEmitterOptions,
  type AuditInput,
  type AuditRecord,
} from "../audit-log.js";
import { chainAppend } from "./chain.js";
import { signRecord } from "./sign.js";
import type {
  ChainStateStore,
  Hash,
  SignedRecord,
  Signer,
} from "./types.js";

export type TamperEmitterOptions = AuditEmitterOptions & {
  readonly signer: Signer;
  readonly signedSink: (signed: SignedRecord) => void;
  readonly state?: ChainStateStore;
  /** Called on any error inside the tamper-layer. Never re-thrown. */
  readonly onError?: (err: unknown) => void;
};

const noopErr = (_err: unknown): void => {
  /* swallow — audit never throws */
};

const inMemoryStore = (): ChainStateStore => {
  let state: { prev_hash: Hash | null; sequence_id: number } | null = null;
  return {
    load: () => state,
    save: (s) => {
      state = s;
    },
  };
};

export class TamperEvidentEmitter {
  private readonly base: AuditEmitter;
  private readonly signer: Signer;
  private readonly signedSink: (signed: SignedRecord) => void;
  private readonly state: ChainStateStore;
  private readonly onError: (err: unknown) => void;
  private prevHash: Hash | null;
  private nextSeq: number;

  constructor(opts: TamperEmitterOptions) {
    this.base = new AuditEmitter(opts);
    this.signer = opts.signer;
    this.signedSink = opts.signedSink;
    this.state = opts.state ?? inMemoryStore();
    this.onError = opts.onError ?? noopErr;

    const restored = this.safeLoad();
    this.prevHash = restored?.prev_hash ?? null;
    this.nextSeq = restored ? restored.sequence_id + 1 : 0;
  }

  /** Same contract as `AuditEmitter.emit`: returns the redacted record. */
  emit(input: AuditInput): AuditRecord {
    const record = this.base.emit(input);
    try {
      const chained = chainAppend(this.prevHash, record, this.nextSeq);
      const signed = signRecord(chained, this.signer);
      this.signedSink(signed);
      this.prevHash = chained.hash;
      this.nextSeq = chained.sequence_id + 1;
      this.safeSave({
        prev_hash: this.prevHash,
        sequence_id: chained.sequence_id,
      });
    } catch (err) {
      this.onError(err);
    }
    return record;
  }

  /** Current chain head, exposed for diagnostics & cross-process resume. */
  head(): { prev_hash: Hash | null; sequence_id: number } {
    return {
      prev_hash: this.prevHash,
      // sequence_id of the LAST emitted record (nextSeq - 1), or -1 if none.
      sequence_id: this.nextSeq - 1,
    };
  }

  private safeLoad(): { prev_hash: Hash | null; sequence_id: number } | null {
    try {
      return this.state.load();
    } catch (err) {
      this.onError(err);
      return null;
    }
  }

  private safeSave(s: {
    prev_hash: Hash | null;
    sequence_id: number;
  }): void {
    try {
      this.state.save(s);
    } catch (err) {
      this.onError(err);
    }
  }
}

export const createTamperEvidentEmitter = (
  opts: TamperEmitterOptions,
): TamperEvidentEmitter => new TamperEvidentEmitter(opts);
