import { rowDue } from './debt';
import { recalculate } from './payment';
import { parseSnapshot } from './snapshot';

// Same amortization rounding and final-payment tolerance as v1.3.
export function convertFormula(payload: Record<string, unknown>, id: string, today = new Date()) {
  const data = parseSnapshot(JSON.stringify(payload));
  const debt = data.debts.find(d => d.id === id);
  if (!debt || debt.mode !== 'formula') throw new Error('Chọn khoản vay công thức chưa chuyển.');
  const raw = debt as unknown as Record<string, unknown>;
  const rate = raw.rate ?? 0;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || !Number.isSafeInteger(debt.balance) || !Number.isSafeInteger(debt.payment) || debt.balance <= 0 || debt.payment <= 0) throw new Error('Cần số dư, lãi suất và số trả hợp lệ.');
  if (!Number.isFinite(today.getTime())) throw new Error('Ngày chuyển lịch không hợp lệ.');
  if (Object.values(data.tx).flat().some(t => t.debt === id) || (raw.sched !== undefined && (!Array.isArray(raw.sched) || raw.sched.length > 0))) throw new Error('Khoản vay đã có lịch hoặc giao dịch liên kết. Kiểm tra sao lưu trước khi chuyển.');
  const paid = raw.paid;
  if (paid !== undefined && (!paid || typeof paid !== 'object' || Array.isArray(paid))) throw new Error('Lịch sử đã trả không hợp lệ.');
  const key = (offset: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  let start = (paid as Record<string, unknown> | undefined)?.[key(0)] ? 1 : 0;
  const target = today.getFullYear() * 12 + today.getMonth() + start;
  if (debt.stmtDay) for (let offset = 0; offset >= -2; offset--) {
    const due = rowDue(debt, key(start + offset));
    if (due.getFullYear() * 12 + due.getMonth() === target) { start += offset; break; }
  }
  const rows = [];
  let balance = debt.balance;
  for (let k = 1; k <= 600 && balance > 0.5; k++) {
    const interest = Math.round(balance * (rate / 100 / 12));
    let pay = debt.payment, principal = pay - interest;
    if (principal >= balance - 100 || k === 600) { principal = balance; pay = balance + interest; }
    if (principal <= 0 || !Number.isSafeInteger(pay) || pay <= 0 || pay > 1e12) throw new Error('Số trả không đủ trả lãi hoặc lịch vượt giới hạn an toàn.');
    balance -= principal;
    rows.push({ id: crypto.randomUUID(), k: key(start + k - 1), a: pay, p: 0 as const });
  }
  if (!rows.length) throw new Error('Không có kỳ còn lại để chuyển.');
  Object.assign(debt, { mode: 'custom', sched: rows, principal: 0, rate: 0, rateImplied: false });
  recalculate(debt);
  parseSnapshot(JSON.stringify({ ...payload, debts: data.debts }));
  payload.debts = data.debts;
}