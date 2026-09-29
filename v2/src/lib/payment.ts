import { remaining } from './debt';
import { localDate } from './format';
import { parseSnapshot } from './snapshot';

export interface DebtPayment { debt: string; index: number; wallet: string; date: string; principal: number; interest: number; fee: number; note: string }

// Mutates only a caller-owned draft. The cloud client commits both changes together.
export function applyDebtPayment(payload: Record<string, unknown>, values: DebtPayment) {
  const data = parseSnapshot(JSON.stringify(payload));
  const debt = data.debts.find(d => d.id === values.debt);
  if (!debt || debt.mode !== 'custom') throw new Error('Chọn khoản nợ có lịch theo tháng.');
  const row = Number.isInteger(values.index) ? debt.sched?.[values.index] : undefined;
  if (!row || remaining(row) <= 0) throw new Error('Kỳ này không còn số tiền phải trả.');
  const ids = (debt.sched || []).map(r => r.id).filter(Boolean);
  if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('Mã kỳ nợ bị trùng hoặc không hợp lệ. Kiểm tra bản sao lưu.');
  if (![values.principal, values.interest, values.fee].every(n => Number.isSafeInteger(n) && n >= 0) || values.principal <= 0 || values.principal > remaining(row)) throw new Error('Số thanh toán kỳ phải lớn hơn 0 và không vượt số còn lại.');
  const total = values.principal + values.interest + values.fee;
  const wallet = data.wallets.find(w => w.id === values.wallet);
  if (!wallet || total > 1e12 || !/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !Number.isFinite(Date.parse(values.date)) || new Date(values.date).toISOString().slice(0, 10) !== values.date || values.date > localDate() || (wallet.openingDate && values.date < wallet.openingDate) || values.note.length > 200) throw new Error('Kiểm tra ví, ngày thanh toán, tổng tiền và ghi chú.');
  row.id ||= crypto.randomUUID();
  row.settled = (row.settled || 0) + values.principal;
  const unpaid = (debt.sched || []).filter(r => remaining(r) > 0).slice().sort((a, b) => a.k.localeCompare(b.k));
  Object.assign(debt, { balance: unpaid.reduce((sum, r) => sum + remaining(r), 0), payment: unpaid.filter(r => r.k === unpaid[0]?.k).reduce((sum, r) => sum + remaining(r), 0), months: unpaid.length, original: (debt.sched || []).reduce((sum, r) => sum + r.a, 0) });
  const tx = { id: crypto.randomUUID(), type: 'repayment' as const, date: values.date, wallet: values.wallet, to: '', amount: total, category: 'Trả nợ', note: values.note.trim(), debt: debt.id, row: row.id, interest: values.interest, fee: values.fee };
  (data.tx[values.date.slice(0, 7)] ||= []).push(tx);
  payload.debts = data.debts;
  payload.tx = data.tx;
}