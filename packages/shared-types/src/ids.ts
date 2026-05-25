/**
 * Branded identifier types used across FinsavvyAI products.
 *
 * Branding prevents accidental cross-assignment between id kinds without any
 * runtime cost. Construct with the `as` helpers; do not cast raw strings.
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type SubjectId = Brand<string, "SubjectId">;
export type CaseId = Brand<string, "CaseId">;
export type ActorId = Brand<string, "ActorId">;
export type AuditId = Brand<string, "AuditId">;
export type EngineVersion = Brand<string, "EngineVersion">;

const nonEmpty = (raw: string, kind: string): string => {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error(`invalid ${kind}: must be non-empty string`);
  }
  return raw;
};

export const asSubjectId = (raw: string): SubjectId =>
  nonEmpty(raw, "SubjectId") as SubjectId;

export const asCaseId = (raw: string): CaseId =>
  nonEmpty(raw, "CaseId") as CaseId;

export const asActorId = (raw: string): ActorId =>
  nonEmpty(raw, "ActorId") as ActorId;

export const asAuditId = (raw: string): AuditId =>
  nonEmpty(raw, "AuditId") as AuditId;

export const asEngineVersion = (raw: string): EngineVersion =>
  nonEmpty(raw, "EngineVersion") as EngineVersion;
