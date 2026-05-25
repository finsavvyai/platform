import { api } from './client';

export interface Transaction {
  id: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
  submitted_at: string;
}

export interface TxnAlert {
  id: string;
  transaction_id: string;
  rule: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

interface TxnAlertListResponse {
  alerts: TxnAlert[];
  total: number;
}

interface TxnAlertSummary {
  total: number;
  by_severity: Record<string, number>;
}

export const transactionsApi = {
  submit: (txn: Omit<Transaction, 'id' | 'submitted_at'>) =>
    api.post<Transaction>('/transactions', txn),
  listAlerts: () =>
    api.get<TxnAlertListResponse>('/transactions/alerts'),
  alertSummary: () =>
    api.get<TxnAlertSummary>('/transactions/alerts/summary'),
};
