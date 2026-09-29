import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import type { Debt } from './debt';
import { calculateLoan } from './loan';
import { compareConsolidation } from './consolidation';

const today = new Date(2026, 8, 29);
const input = { amount: 10000000, rate: 12, months: 12, upfront: 100000, prepay: 4, payoffAt: 6 };
const custom = { id: 'c', name: 'Nhập tay', mode: 'custom' as const, balance: 2400000, payment: 1200000, dueDay: 10, stmtDay: 20, dueMode: 'day' as const, grace: 0, principal: 2000000, prepay: 2, sched: [{ k: '2026-08', a: 1200000 }, { k: '2026-09', a: 1200000 }] };
const formula = { id: 'f', name: 'Công thức', mode: 'formula' as const, balance: 3000000, payment: 500000, rate: 18, dueDay: 10, stmtDay: 0, dueMode: 'day' as const, grace: 0, prepay: 3 };

it('đối chiếu tất toán, trả tháng, chi phí và phí nợ cũ với v1.3, không sửa dữ liệu', () => {
  const debts = [custom, formula];
  const before = structuredClone(debts);
  const ctx = createContext({ today: () => today, daysIn: (y: number, m: number) => new Date(y, m + 1, 0).getDate(), dueDate: (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate())) });
  for (const file of ['loan', 'model']) runInContext(readFileSync(new URL(`../../../js/${file}.js`, import.meta.url), 'utf8'), ctx);
  runInContext(`var debts = ${JSON.stringify(debts)}`, ctx);
  const r = compareConsolidation(input, debts, today);
  expect(r.payoff).toBe(runInContext('debts.reduce((s,d)=>s+payoffOf(d),0)', ctx));
  expect(r.oldMonthly).toBe(runInContext('debts.reduce((s,d)=>s+monthlyOf(d),0)', ctx));
  expect(r.oldCost).toBe(runInContext('debts.reduce((s,d)=>s+remainingOf(d).totalInterest,0)', ctx));
  expect(r.oldFee).toBe(runInContext('debts.reduce((s,d)=>s+payoffOf(d)*(d.prepay||0)/100,0)', ctx));
  expect(r.newCost).toBe(calculateLoan(input).fullCost + r.oldFee);
  expect(r.saving).toBe(r.oldCost! - r.newCost);
  expect(debts).toEqual(before);
});
it('không kết luận tiết kiệm nếu thiếu gốc nhập tay hoặc vay ròng không đủ', () => {
  const unknown = compareConsolidation(input, [{ ...custom, principal: undefined }], today);
  expect(unknown.oldCost).toBeNull();
  expect(unknown.saving).toBeNull();
  const short = compareConsolidation({ ...input, amount: 1000000 }, [custom], today);
  expect(short.shortfall).toBe(1140000);
  expect(short.saving).toBeNull();
});
it('từ chối phí, gốc, lịch sai, nợ trùng và khoản công thức không trả đủ lãi', () => {
  for (const debt of [{ ...custom, prepay: NaN }, { ...custom, principal: 2500000 }, { ...custom, balance: 1 }, { ...custom, sched: undefined }, { ...formula, rate: '18' }, { ...formula, payment: 1 }]) {
    expect(() => compareConsolidation(input, [debt as unknown as Debt], today)).toThrow();
  }
  expect(() => compareConsolidation(input, [custom, custom], today)).toThrow();
  expect(() => compareConsolidation({ ...input, amount: NaN }, [custom], today)).toThrow();
});
it('giữ ngữ nghĩa trả tháng của v1.3 cho kỳ đã trả và tháng không có kỳ', () => {
  const debt = { ...custom, balance: 1200000, sched: [{ k: '2026-08', a: 1200000, p: '2026-09-10' }, { k: '2026-09', a: 1200000 }], principal: 1000000 };
  expect(compareConsolidation(input, [debt], today).oldMonthly).toBe(1200000);
  expect(compareConsolidation(input, [debt], new Date(2026, 11, 1)).oldMonthly).toBe(debt.payment);
});