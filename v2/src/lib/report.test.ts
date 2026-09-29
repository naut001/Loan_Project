import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import { monthReport, shiftMonth } from './report';
import type { Snapshot, Transaction } from './snapshot';

const rows: Transaction[] = ['income', 'expense', 'credit', 'repayment', 'transfer'].map((type, i) => ({ id: String(i), type: type as Transaction['type'], date: '2026-09-12', amount: (i + 1) * 100, wallet: type === 'credit' ? '' : 'cash', to: type === 'transfer' ? 'bank' : '', category: 'Ăn uống', interest: 12, fee: 3 }));
const data: Snapshot = { wallets: [], debts: [], tx: { '2026-09': [...rows, { ...rows[1], id: 'future', date: '2026-09-30', amount: 70 }] } };
it('đối chiếu báo cáo từng loại giao dịch, cả tháng và đến hôm nay với v1.3', () => {
  const context = createContext({});
  for (const file of ['util.js', 'loan.js', 'model.js', 'spend.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), context);
  for (const through of ['2026-09-12', '9999-12-31']) {
    const old = runInContext(`spendSummary('2026-09', ${JSON.stringify(data)}, '${through}')`, context);
    expect(monthReport(data, '2026-09', through)).toEqual(JSON.parse(JSON.stringify(old)));
  }
  expect(monthReport(data, '2026-10').expense).toBe(0);
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
});