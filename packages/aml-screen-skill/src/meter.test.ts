import { describe, expect, it } from "vitest";
import type { CustomerId } from "@finsavvyai/billing";
import { InMemoryUsageMeter } from "./meter.js";

const A = "cust_a" as CustomerId;
const B = "cust_b" as CustomerId;
const KEY = "aml.screen";

describe("InMemoryUsageMeter", () => {
  it("starts at zero for an unseen customer/key", async () => {
    const m = new InMemoryUsageMeter();
    expect(await m.used(A, KEY)).toBe(0);
  });

  it("increments on record", async () => {
    const m = new InMemoryUsageMeter();
    await m.record(A, KEY);
    await m.record(A, KEY);
    expect(await m.used(A, KEY)).toBe(2);
  });

  it("isolates by customer and by key", async () => {
    const m = new InMemoryUsageMeter();
    await m.record(A, KEY);
    expect(await m.used(B, KEY)).toBe(0);
    expect(await m.used(A, "other.key")).toBe(0);
  });
});
