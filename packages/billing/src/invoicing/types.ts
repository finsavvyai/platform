import type { CustomerId, Money } from "../types.js";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "overdue"
  | "cancelled";

export type LineItem = {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: Money;
};

export type InvoiceInput = {
  readonly invoiceNumber: string;
  readonly customerId: CustomerId;
  readonly issueDate: number;
  readonly dueDate: number;
  readonly lineItems: readonly LineItem[];
  /** Decimal fraction, e.g. 0.17 for 17% VAT. 0 if no tax. */
  readonly taxRate: number;
  readonly notes?: string;
};

export type InvoiceTotals = {
  readonly subtotal: Money;
  readonly taxAmount: Money;
  readonly total: Money;
};

export type Invoice = InvoiceInput & InvoiceTotals & {
  readonly status: InvoiceStatus;
};
