import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import { parseSnapshot } from './snapshot';
import { simulatePlan } from './plan';

const today = new Date(2026, 8, 28);
const debt = { id: 'h', name: 'HSBC', mode: 'formula', balance: 22000000, rate: 30, payment: 2500000, months: 12, dueDay: 12, stmtDay: 0, dueMode: 'day', grace: 0, prepay: 0, paid: {} };
const recv = { id: 'r', name: 'Lan', amount: 3000000, got: 0, kind: 'once', due: '2026-10-20', startK: '', day: 1, per: 0, inc: true, note: '', log: [] };
const plan = { cash: [{ id: 'c', name: 'TK', a: 12000000 }], living: 8000000, buffer: 1000000, incomePending: false, loans: [{ id: 'l', name: 'Vay', amount: 100000000, rate: 17.99, months: 24, k: '2026-10', fee: 2000000, payoff: ['h'] }], buys: [{ id: 'b', name: 'Laptop', a: 15000000, k: '2026-11' }] };
const raw = { v: 1, wallets: [], tx: {}, debts: [debt], recv: [recv], plan, income: 18000000 };
it('đọc đầy đủ phần kế hoạch và lương, nhưng không cộng giao dịch ví', () => {
  const data = parseSnapshot(JSON.stringify({ ...raw, tx: { '2026-09': [{ id: 'x', date: '2026-09-28', type: 'income', amount: 3000000, wallet: 'w' }] }, wallets: [{ id: 'w', name: 'Ví', opening: 0 }] }));
  expect(data.plan).toEqual(plan);
  expect(data.income).toBe(18000000);
  expect(simulatePlan(data, today).cash0).toBe(12000000);
});
it('đối chiếu planSim v1.3 cho nhiều kịch bản, không sửa snapshot', () => {
  const ctx = createContext({ __TODAY__: '2026-09-28T00:00:00' });
  for (const file of ['util.js', 'loan.js', 'model.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  for (const changed of [raw, { ...raw, plan: { ...plan, incomePending: true, loans: [], buys: [] } }, { ...raw, debts: [{ ...debt, mode: 'custom', balance: 6000000, payment: 3000000, principal: 5500000, sched: [{ k: '2026-08', a: 3000000, p: 0 }, { k: '2026-11', a: 3000000, p: 0 }] }] }, { ...raw, debts: [{ ...debt, paid: { '2026-09': '2026-09-01' } }] }]) {
    const json = JSON.stringify(changed);
    runInContext(`S=${json}`, ctx);
    const legacy = JSON.parse(JSON.stringify(runInContext('planSim(12)', ctx))) as { cash0: number; recvTotal: number; months: { inn: number; out: number; debt: number; bal: number; ev: { s: number; t: string; a: number }[] }[] };
    const data = parseSnapshot(json);
    const before = JSON.stringify(data);
    const result = simulatePlan(data, today);
    expect(result.cash0).toBe(legacy.cash0);
    expect(result.recvTotal).toBe(legacy.recvTotal);
    result.months.forEach((m, i) => { const old = legacy.months[i]; expect({ inn: m.inn, out: m.out, debt: m.debt, bal: m.bal, ev: m.ev }).toEqual({ inn: old.inn, out: old.out, debt: old.debt, bal: old.bal, ev: old.ev }); });
    expect(JSON.stringify(data)).toBe(before);
  }
});
it('không dự phóng khi kế hoạch hoặc lãi vay không hợp lệ', () => {
  expect(() => simulatePlan({ wallets: [], tx: {}, debts: [] }, today)).toThrow();
  expect(() => simulatePlan(parseSnapshot(JSON.stringify({ ...raw, plan: { ...plan, loans: [{ ...plan.loans[0], months: 0 }] } })), today)).toThrow();
  expect(() => simulatePlan(parseSnapshot(JSON.stringify({ ...raw, debts: [{ ...debt, rate: 'sai' }] })), today)).toThrow();
});