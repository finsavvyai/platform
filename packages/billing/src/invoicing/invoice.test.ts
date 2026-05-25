import { describe, expect, it } from "vitest";
import {
  InvoiceLineItemInvalidError,
  InvoiceTotalsMismatchError,
} from "../errors.js";
import type { CustomerId } from "../types.js";
import {
  assertTotalsConsistent,
  buildInvoice,
  computeTotals,
  lineTotal,
} from "./invoice.js";
import { money } from "./money.js";
import type { InvoiceInput, LineItem } from "./types.js";

const customerId = "cust_1" as CustomerId;

function baseInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    invoiceNumber: "INV-1",
    customerId,
    issueDate: 1_700_000_000,
    dueDate: 1_702_000_000,
    taxRate: 0,
    lineItems: [
      { description: "Pro plan", quantity: 1, unitPrice: money(2900, "USD") },
    ],
    ...overrides,
  };
}

describe("lineTotal", () => {
  it("computes quantity * unit price", () => {
    const item: LineItem = {
      description: "API calls",
      quantity: 10,
      unitPrice: money(50, "USD"),
    };
    expect(lineTotal(item).amountMinor).toBe(500);
  });
});

describe("computeTotals", () => {
  it("sums single line with no tax", () => {
    const totals = computeTotals(baseInput());
    expect(totals.subtotal.amountMinor).toBe(2900);
    expect(totals.taxAmount.amountMinor).toBe(0);
    expect(totals.total.amountMinor).toBe(2900);
  });

  it("sums multiple lines and applies tax", () => {
    const totals = computeTotals(
      baseInput({
        taxRate: 0.17,
        lineItems: [
          { description: "Seat 1", quantity: 2, unitPrice: money(2900, "USD") },
          { description: "Add-on", quantity: 1, unitPrice: money(500, "USD") },
        ],
      }),
    );
    // subtotal = 2*2900 + 500 = 6300
    expect(totals.subtotal.amountMinor).toBe(6300);
    // tax = 6300 * 0.17 = 1071
    expect(totals.taxAmount.amountMinor).toBe(1071);
    expect(totals.total.amountMinor).toBe(7371);
  });

  it("rejects empty line items", () => {
    expect(() =>
      computeTotals(baseInput({ lineItems: [] })),
    ).toThrow(InvoiceLineItemInvalidError);
  });

  it("rejects line with empty description", () => {
    expect(() =>
      computeTotals(
        baseInput({
          lineItems: [
            { description: "  ", quantity: 1, unitPrice: money(100, "USD") },
          ],
        }),
      ),
    ).toThrow(InvoiceLineItemInvalidError);
  });

  it("rejects non-positive quantity", () => {
    expect(() =>
      computeTotals(
        baseInput({
          lineItems: [
            { description: "Bad", quantity: 0, unitPrice: money(100, "USD") },
          ],
        }),
      ),
    ).toThrow(InvoiceLineItemInvalidError);
  });

  it("rejects fractional quantity", () => {
    expect(() =>
      computeTotals(
        baseInput({
          lineItems: [
            { description: "Bad", quantity: 1.5, unitPrice: money(100, "USD") },
          ],
        }),
      ),
    ).toThrow(InvoiceLineItemInvalidError);
  });

  it("rejects negative unit price", () => {
    expect(() =>
      computeTotals(
        baseInput({
          lineItems: [
            { description: "Bad", quantity: 1, unitPrice: { amountMinor: -1, currency: "USD" } },
          ],
        }),
      ),
    ).toThrow(InvoiceLineItemInvalidError);
  });

  it("rejects mixed currencies across lines", () => {
    expect(() =>
      computeTotals(
        baseInput({
          lineItems: [
            { description: "USD line", quantity: 1, unitPrice: money(100, "USD") },
            { description: "EUR line", quantity: 1, unitPrice: money(100, "EUR") },
          ],
        }),
      ),
    ).toThrow(InvoiceLineItemInvalidError);
  });
});

describe("buildInvoice", () => {
  it("returns draft invoice with totals", () => {
    const inv = buildInvoice(baseInput({ taxRate: 0.1 }));
    expect(inv.status).toBe("draft");
    expect(inv.subtotal.amountMinor).toBe(2900);
    expect(inv.taxAmount.amountMinor).toBe(290);
    expect(inv.total.amountMinor).toBe(3190);
    expect(inv.invoiceNumber).toBe("INV-1");
  });
});

describe("assertTotalsConsistent", () => {
  it("passes when totals match", () => {
    const inv = buildInvoice(baseInput({ taxRate: 0.17 }));
    expect(() => assertTotalsConsistent(inv)).not.toThrow();
  });

  it("throws when totals tampered", () => {
    const inv = buildInvoice(baseInput({ taxRate: 0 }));
    const tampered = { ...inv, total: money(9999, "USD") };
    expect(() => assertTotalsConsistent(tampered)).toThrow(
      InvoiceTotalsMismatchError,
    );
  });

  it("throws when subtotal tampered", () => {
    const inv = buildInvoice(baseInput({ taxRate: 0 }));
    const tampered = { ...inv, subtotal: money(1, "USD") };
    expect(() => assertTotalsConsistent(tampered)).toThrow(
      InvoiceTotalsMismatchError,
    );
  });

  it("throws when taxAmount tampered", () => {
    const inv = buildInvoice(baseInput({ taxRate: 0.17 }));
    const tampered = { ...inv, taxAmount: money(9999, "USD") };
    expect(() => assertTotalsConsistent(tampered)).toThrow(
      InvoiceTotalsMismatchError,
    );
  });
});
