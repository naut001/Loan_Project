import type { Debt } from './debt';
export interface Wallet { id: string; name: string; opening: number; openingDate?: string; type?: string }
export interface Transaction {
  id: string; date: string; type: 'income' | 'expense' | 'transfer' | 'credit' | 'repayment';
  amount: number; wallet: string; to?: string; note?: string; category?: string;
  interest?: number; fee?: number;
  debt?: string; row?: string;
}
export interface Snapshot { wallets: Wallet[]; tx: Record<string, Transaction[]>; debts: Debt[]; budgets?: Record<string, Record<string, number>> }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string';

export function isCashEditable(t: Transaction): boolean {
  return ['income', 'expense', 'transfer'].includes(t.type) && !t.debt && !t.row;
}

export function parseSnapshot(raw: string): Snapshot {
  const parsed: unknown = JSON.parse(raw);
  const data = object(parsed) && parsed.app === 'so-tra-no' ? parsed.data : parsed;
  if (!object(data) || data.v !== 1 || !Array.isArray(data.debts) || !Array.isArray(data.wallets) || !object(data.tx)) {
    throw new Error('Cần bản sao lưu JSON phiên bản 1.3 có tài khoản và giao dịch. Dữ liệu gốc không bị thay đổi.');
  }
  const wallets = data.wallets;
  const monthKey = (value: unknown) => text(value) && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  const day = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  const debtIds = new Set<string>();
  for (const debt of data.debts) {
    if (!object(debt) || !text(debt.id) || !debt.id || debtIds.has(debt.id) || !text(debt.name) || !['custom', 'formula'].includes(String(debt.mode)) || !amount(debt.balance) || !amount(debt.payment) || !day(debt.dueDay, 1, 31) || !day(debt.stmtDay, 0, 31) || !day(debt.grace, 0, 60) || !['day', 'after'].includes(String(debt.dueMode)) || (debt.kind !== undefined && !text(debt.kind))) throw new Error('Khoản nợ không hợp lệ. Hãy xuất lại bản sao lưu từ ứng dụng hiện tại.');
    debtIds.add(debt.id);
    if (debt.mode === 'custom' && (!Array.isArray(debt.sched) || !debt.sched.every(r => object(r) && monthKey(r.k) && amount(r.a) && (r.settled === undefined || (amount(r.settled) && r.settled <= r.a)) && (r.p === undefined || r.p === 0 || text(r.p))))) throw new Error('Lịch trả nợ không hợp lệ. Dữ liệu gốc được giữ nguyên.');
  }
  if (!wallets.every(w => object(w) && text(w.id) && text(w.name) && amount(w.opening)) || new Set(wallets.map(w => w.id)).size !== wallets.length) throw new Error('Danh sách tài khoản không hợp lệ.');
  const ids = new Set(wallets.map(w => w.id));
  const transactionIds = new Set<string>();
  for (const [month, rows] of Object.entries(data.tx)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Array.isArray(rows)) throw new Error('Tháng giao dịch không hợp lệ.');
    for (const t of rows) {
      if (!object(t) || !text(t.id) || transactionIds.has(t.id) || !text(t.date) || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(Date.parse(t.date)) || new Date(t.date).toISOString().slice(0, 10) !== t.date || !t.date.startsWith(month) || !amount(t.amount) || !['income', 'expense', 'transfer', 'credit', 'repayment'].includes(String(t.type)) || !text(t.wallet) || (t.type !== 'credit' && !ids.has(t.wallet)) || (t.type === 'transfer' && (!ids.has(t.to) || t.to === t.wallet)) || ['interest', 'fee'].some(k => t[k] !== undefined && !amount(t[k])) || ['note', 'category'].some(k => t[k] !== undefined && !text(t[k]))) throw new Error('Giao dịch không hợp lệ. Không hiển thị số liệu có thể sai.');
      transactionIds.add(t.id);
    }
  }
  if (data.budgets !== undefined && (!object(data.budgets) || !Object.entries(data.budgets).every(([month, values]) => monthKey(month) && object(values) && Object.values(values).every(amount)))) throw new Error('Ngân sách không hợp lệ. Dữ liệu gốc được giữ nguyên.');
  return { wallets, tx: data.tx, debts: data.debts, ...(data.budgets === undefined ? {} : { budgets: data.budgets }) } as Snapshot;
}

export function summarize(data: Snapshot, date: string) {
  const all = Object.values(data.tx).flat().filter(t => t.date <= date);
  const balances = data.wallets.map(w => ({ ...w, balance: all.reduce((sum, t) => sum + (t.type !== 'credit' && t.wallet === w.id ? (t.type === 'income' ? t.amount : -t.amount) : 0) + (t.type === 'transfer' && t.to === w.id ? t.amount : 0), w.opening) }));
  const recent = all.filter(t => t.date.startsWith(date.slice(0, 7))).sort((a, b) => b.date.localeCompare(a.date));
  const expense = recent.reduce((sum, t) => sum + (t.type === 'expense' || t.type === 'credit' ? t.amount : t.type === 'repayment' ? (t.interest || 0) + (t.fee || 0) : 0), 0);
  return { balances, recent, expense, cash: balances.reduce((sum, w) => sum + w.balance, 0), income: recent.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) };
}