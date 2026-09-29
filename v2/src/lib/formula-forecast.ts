import type { Debt } from './debt';

const dayAt = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Mirrors v1.3 schedule/statusOf/dueOn; never mutates the debt or records payments.
export function formulaForecast(debt: Debt, today = new Date()): { key: string; due: Date; pay: number }[] {
  const raw = debt;
  if (debt.mode !== 'formula' || !Number.isFinite(today.getTime()) || !Number.isSafeInteger(debt.balance) || !Number.isSafeInteger(debt.payment) || debt.balance < 0 || debt.payment <= 0 || debt.balance > 1e12 || debt.payment > 1e12 || (raw.rate !== undefined && (typeof raw.rate !== 'number' || !Number.isFinite(raw.rate) || raw.rate < 0)) || (raw.paid !== undefined && (!raw.paid || typeof raw.paid !== 'object' || Array.isArray(raw.paid)))) throw new Error('Không thể dự phóng khoản nợ công thức: cần đối chiếu số dư, lãi suất và lịch đã trả.');
  if (!debt.balance) return [];
  const start = raw.paid?.[keyOf(today)] ? 1 : 0;
  const out: { key: string; due: Date; pay: number }[] = [];
  let balance = debt.balance;
  for (let i = 0; i < 600 && balance > 0.5; i++) {
    const interest = Math.round(balance * ((raw.rate ?? 0) / 100 / 12));
    let pay = debt.payment, principal = pay - interest;
    if (principal >= balance - 100 || i === 599) { principal = balance; pay = balance + interest; }
    if (principal <= 0 || !Number.isSafeInteger(pay) || pay > 1e12) throw new Error('Không thể dự phóng khoản nợ công thức: số trả không đủ lãi hoặc vượt giới hạn an toàn.');
    balance -= principal;
    const month = new Date(today.getFullYear(), today.getMonth() + start + i, 1);
    let due = dayAt(month.getFullYear(), month.getMonth(), debt.dueDay || debt.stmtDay || 1);
    if (debt.dueMode === 'after' && debt.stmtDay > 0 && debt.grace > 0) {
      const previous = dayAt(month.getFullYear(), month.getMonth() - 1, debt.stmtDay);
      const first = new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + debt.grace);
      const current = dayAt(month.getFullYear(), month.getMonth(), debt.stmtDay);
      const second = new Date(current.getFullYear(), current.getMonth(), current.getDate() + debt.grace);
      const sameMonth = (d: Date) => d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
      if (sameMonth(first)) due = first;
      else if (sameMonth(second)) due = second;
    }
    out.push({ key: keyOf(month), due, pay });
  }
  return out;
}