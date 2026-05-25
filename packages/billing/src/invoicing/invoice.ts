import {
  InvoiceLineItemInvalidError,
  InvoiceTotalsMismatchError,
} from "../errors.js";
import type { Currency, Money } from "../types.js";
import {
  addMoney,
  applyTaxRate,
  multiplyByQuantity,
  sumMoney,
} from "./money.js";
import type {
  Invoice,
  InvoiceInput,
  InvoiceTotals,
  LineItem,
} from "./types.js";

/**
 * Pure invoice math. No I/O. Reproducible for a given input.
 *
 * Computes line totals, subtotal, tax amount, and grand total. All values
 * stay in integer minor units of the single invoice currency. Mixed
 * currencies on the same invoice are rejected.
 */

function validateLineItem(item: LineItem, expected: Currency, idx: number): void {
  if (!item.description || item.description.trim().length === 0) {
    throw new InvoiceLineItemInvalidError(`item ${idx}: empty description`);
  }
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new InvoiceLineItemInvalidError(
      `item ${idx}: quantity must be a positive integer`,
    );
  }
  if (item.unitPrice.amountMinor < 0) {
    throw new InvoiceLineItemInvalidError(
      `item ${idx}: unitPrice must be >= 0`,
    );
  }
  if (item.unitPrice.currency !== expected) {
    throw new InvoiceLineItemInvalidError(
      `item ${idx}: currency ${item.unitPrice.currency} differs from invoice ${expected}`,
    );
  }
}

export function lineTotal(item: LineItem): Money {
  return multiplyByQuantity(item.unitPrice, item.quantity);
}

export function computeTotals(input: InvoiceInput): InvoiceTotals {
  if (input.lineItems.length === 0) {
    throw new InvoiceLineItemInvalidError("at least one line item required");
  }
  const currency = input.lineItems[0]!.unitPrice.currency;
  input.lineItems.forEach((it, i) => validateLineItem(it, currency, i));

  const lineTotals = input.lineItems.map(lineTotal);
  const subtotal = sumMoney(lineTotals, currency);
  const taxAmount = applyTaxRate(subtotal, input.taxRate);
  const total = addMoney(subtotal, taxAmount);
  return { subtotal, taxAmount, total };
}

export function buildInvoice(input: InvoiceInput): Invoice {
  const totals = computeTotals(input);
  return { ...input, ...totals, status: "draft" };
}

/**
 * Assert a declared invoice's stored totals match a fresh computation.
 * Use this as a defense-in-depth check before charging or issuing.
 */
export function assertTotalsConsistent(invoice: Invoice): void {
  const recomputed = computeTotals(invoice);
  if (
    recomputed.subtotal.amountMinor !== invoice.subtotal.amountMinor ||
    recomputed.taxAmount.amountMinor !== invoice.taxAmount.amountMinor ||
    recomputed.total.amountMinor !== invoice.total.amountMinor
  ) {
    throw new InvoiceTotalsMismatchError();
  }
}
