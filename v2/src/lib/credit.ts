import type { Debt } from './debt';
import { categories } from './budget';
import { localDate } from './format';
import { recalculate } from './payment';
import { parseSnapshot } from './snapshot';

export interface CreditPurchase { debt: string; date: string; amount: number; period?: string; category: string; note: string }

export function creditPeriod(debt: Debt, date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const cutoff = debt.stmtDay ? Math.min(debt.stmtDay, new Date(year, month, 0).getDate()) : debt.dueDay || 1;
  if (day <= cutoff) return date.slice(0, 7);
  return `${String(month === 12 ? year + 1 : year).padStart(4, '0')}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`;
}

export function applyCreditPurchase(payload: Record<string, unknown>, values: CreditPurchase) {
  const data = parseSnapshot(JSON.stringify(payload));
  const debt = data.debts.find(d => d.id === values.debt);
  if (!debt || debt.mode !== 'custom') throw new Error('Chọn khoản nợ có lịch theo tháng.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date) || !Number.isFinite(Date.parse(values.date)) || new Date(values.date).toISOString().slice(0, 10) !== values.date || values.date > localDate()) throw new Error('Chọn ngày mua hợp lệ, không ở tương lai.');
  if (!Number.isSafeInteger(values.amount) || values.amount <= 0 || values.amount > 1e12 || !categories.includes(values.category) || values.note.length > 200) throw new Error('Kiểm tra số tiền, danh mục và ghi chú.');
  const period = values.period || creditPeriod(debt, values.date);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period < values.date.slice(0, 7)) throw new Error('Kỳ trả không được trước tháng mua.');
  const row = { id: crypto.randomUUID(), k: period, a: values.amount, p: 0 as const };
  debt.sched!.push(row);
  recalculate(debt);
  (data.tx[values.date.slice(0, 7)] ||= []).push({ id: crypto.randomUUID(), date: values.date, type: 'credit', amount: values.amount, wallet: '', to: '', debt: debt.id, row: row.id, category: values.category, note: values.note.trim() });
  payload.debts = data.debts;
  payload.tx = data.tx;
}

export function undoCreditPurchase(payload: Record<string, unknown>, id: string) {
  const data = parseSnapshot(JSON.stringify(payload));
  const all = Object.values(data.tx).flat();
  const tx = all.find(t => t.id === id);
  if (!tx || tx.type !== 'credit') throw new Error('Không tìm thấy khoản mua tín dụng.');
  const debt = data.debts.find(d => d.id === tx.debt);
  const rows = debt?.sched?.filter(r => typeof tx.row === 'string' && tx.row.length > 0 && r.id === tx.row) || [];
  if (!debt || debt.mode !== 'custom' || rows.length !== 1 || rows[0].a !== tx.amount || rows[0].p || rows[0].settled || all.some(t => t.id !== id && t.debt === tx.debt && t.row === tx.row)) throw new Error('Hoàn tác thanh toán của khoản mua trước; không xoá kỳ đã trả hoặc liên kết không hợp lệ.');
  debt.sched = debt.sched!.filter(r => r !== rows[0]);
  recalculate(debt);
  for (const month of Object.keys(data.tx)) {
    data.tx[month] = data.tx[month].filter(t => t.id !== id);
    if (!data.tx[month].length) delete data.tx[month];
  }
  payload.debts = data.debts;
  payload.tx = data.tx;
}