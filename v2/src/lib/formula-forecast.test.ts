import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import { formulaForecast } from './formula-forecast';
import type { Debt } from './debt';

it('đối chiếu 12 kỳ công thức với schedule/statusOf/dueOn của 1.3', () => {
  const ctx = createContext({ __TODAY__: '2026-09-29' });
  for (const file of ['util.js', 'loan.js', 'model.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  for (const rate of [0, 12, 25]) for (const paid of [{}, { '2026-09': '2026-09-01' }]) for (const stmtDay of [0, 27]) {
    const debt = { id: 'd', name: 'Vay', mode: 'formula', balance: 1000000, payment: 120000, rate, paid, stmtDay, dueDay: 10, dueMode: 'day', grace: 0 } as Debt;
    const before = JSON.stringify(debt);
    const rows = formulaForecast(debt, new Date(2026, 8, 29));
    const old = runInContext(`({ rows: remainingOf(${before}).rows.map(r=>r.pay), start: statusOf(${before}).paid ? 1 : 0 })`, ctx) as { rows: number[]; start: number };
    expect(rows.map(r => r.pay)).toEqual(Array.from(old.rows));
    rows.forEach((row, i) => {
      const month = new Date(2026, 8 + old.start + i, 1);
      expect(row.due.getTime()).toBe(runInContext(`dueOn(${before}, ${month.getFullYear()}, ${month.getMonth()}).getTime()`, ctx));
    });
    expect(JSON.stringify(debt)).toBe(before);
  }
});

it('không tạo dự phóng khi lãi không đủ trả hoặc sai kiểu; thiếu rate theo v1.3 là 0%', () => {
  const base = { id: 'd', name: 'Vay', mode: 'formula', balance: 1000000, payment: 100, rate: 12, dueDay: 10, stmtDay: 0, dueMode: 'day', grace: 0 } as Debt;
  expect(() => formulaForecast(base)).toThrow('Không thể dự phóng');
  expect(formulaForecast({ ...base, payment: 120000, rate: undefined }).map(r => r.pay)).toEqual(formulaForecast({ ...base, payment: 120000, rate: 0 }).map(r => r.pay));
  expect(() => formulaForecast({ ...base, payment: 120000, rate: '12' } as unknown as Debt)).toThrow('Không thể dự phóng');
});

it('hạn công thức theo ân hạn đối chiếu qua tháng ngắn và giao năm', () => {
  const ctx = createContext({});
  for (const file of ['util.js', 'loan.js', 'model.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  for (const today of [new Date(2024, 1, 29), new Date(2026, 11, 31)]) for (const stmtDay of [1, 27, 31]) for (const grace of [0, 5, 25, 60]) {
    const debt = { id: 'd', name: 'Vay', mode: 'formula', balance: 1000000, payment: 120000, rate: 17.99, stmtDay, dueDay: 31, dueMode: 'after', grace } as Debt;
    formulaForecast(debt, today).forEach((row, i) => {
      const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
      expect(row.due.getTime()).toBe(runInContext(`dueOn(${JSON.stringify(debt)}, ${month.getFullYear()}, ${month.getMonth()}).getTime()`, ctx));
    });
  }
});