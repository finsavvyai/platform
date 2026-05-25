import { describe, expect, it } from "vitest";
import {
  addMoney,
  applyTaxRate,
  bankersRound,
  equalsMoney,
  money,
  multiplyByQuantity,
  subtractMoney,
  sumMoney,
  zero,
} from "./money.js";
import { CurrencyMismatchError } from "../errors.js";

describe("money helpers", () => {
  it("money() constructs minor units", () => {
    expect(money(2900, "USD")).toEqual({ amountMinor: 2900, currency: "USD" });
  });

  it("money() rejects non-integer amounts", () => {
    expect(() => money(29.5, "USD")).toThrow(TypeError);
  });

  it("zero() returns zero in the given currency", () => {
    expect(zero("EUR")).toEqual({ amountMinor: 0, currency: "EUR" });
  });

  it("addMoney adds within same currency", () => {
    expect(addMoney(money(100, "USD"), money(250, "USD")).amountMinor).toBe(350);
  });

  it("addMoney rejects mismatched currency", () => {
    expect(() => addMoney(money(100, "USD"), money(100, "EUR"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("subtractMoney subtracts within same currency", () => {
    expect(subtractMoney(money(500, "USD"), money(150, "USD")).amountMinor).toBe(
      350,
    );
  });

  it("subtractMoney rejects mismatched currency", () => {
    expect(() => subtractMoney(money(100, "USD"), money(100, "EUR"))).toThrow(
      CurrencyMismatchError,
    );
  });

  it("multiplyByQuantity scales correctly", () => {
    expect(multiplyByQuantity(money(2900, "USD"), 3).amountMinor).toBe(8700);
  });

  it("multiplyByQuantity allows zero quantity", () => {
    expect(multiplyByQuantity(money(2900, "USD"), 0).amountMinor).toBe(0);
  });

  it("multiplyByQuantity rejects negative qty", () => {
    expect(() => multiplyByQuantity(money(100, "USD"), -1)).toThrow(TypeError);
  });

  it("multiplyByQuantity rejects fractional qty", () => {
    expect(() => multiplyByQuantity(money(100, "USD"), 1.5)).toThrow(TypeError);
  });

  it("applyTaxRate at 17% of 10000 = 1700", () => {
    expect(applyTaxRate(money(10000, "USD"), 0.17).amountMinor).toBe(1700);
  });

  it("applyTaxRate at 0 returns 0", () => {
    expect(applyTaxRate(money(10000, "USD"), 0).amountMinor).toBe(0);
  });

  it("applyTaxRate rounds half-to-even", () => {
    // 12345 * 0.085 = 1049.325 → 1049
    expect(applyTaxRate(money(12345, "USD"), 0.085).amountMinor).toBe(1049);
    // 100 * 0.005 = 0.5 → 0 (even)
    expect(applyTaxRate(money(100, "USD"), 0.005).amountMinor).toBe(0);
    // 300 * 0.005 = 1.5 → 2 (even)
    expect(applyTaxRate(money(300, "USD"), 0.005).amountMinor).toBe(2);
  });

  it("applyTaxRate rejects negative rate", () => {
    expect(() => applyTaxRate(money(100, "USD"), -0.1)).toThrow(TypeError);
  });

  it("applyTaxRate rejects non-finite rate", () => {
    expect(() => applyTaxRate(money(100, "USD"), Number.NaN)).toThrow(TypeError);
    expect(() => applyTaxRate(money(100, "USD"), Number.POSITIVE_INFINITY)).toThrow(
      TypeError,
    );
  });

  it("sumMoney sums same currency", () => {
    const total = sumMoney(
      [money(100, "USD"), money(200, "USD"), money(300, "USD")],
      "USD",
    );
    expect(total.amountMinor).toBe(600);
  });

  it("sumMoney of empty list is zero", () => {
    expect(sumMoney([], "ILS").amountMinor).toBe(0);
  });

  it("sumMoney rejects mismatched currency item", () => {
    expect(() =>
      sumMoney([money(100, "USD"), money(100, "EUR")], "USD"),
    ).toThrow(CurrencyMismatchError);
  });

  it("equalsMoney compares amount + currency", () => {
    expect(equalsMoney(money(100, "USD"), money(100, "USD"))).toBe(true);
    expect(equalsMoney(money(100, "USD"), money(101, "USD"))).toBe(false);
    expect(equalsMoney(money(100, "USD"), money(100, "EUR"))).toBe(false);
  });

  it("bankersRound rounds toward even on exact halves", () => {
    expect(bankersRound(0.5)).toBe(0);
    expect(bankersRound(1.5)).toBe(2);
    expect(bankersRound(2.5)).toBe(2);
    expect(bankersRound(3.5)).toBe(4);
  });

  it("bankersRound rounds normally otherwise", () => {
    expect(bankersRound(1.4)).toBe(1);
    expect(bankersRound(1.6)).toBe(2);
    expect(bankersRound(0)).toBe(0);
    // bankersRound is documented for non-negative; this is the consistent
    // behaviour for -0.5 given Math.floor(-0.5) = -1 (odd), so returns 0.
    expect(bankersRound(-0.5)).toBe(0);
  });
});
