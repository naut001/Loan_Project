import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { debtRows, remaining, rowDue, type Debt } from './debt';
import { parseSnapshot, summarize } from './snapshot';

function legacy() {
  const context = createContext({});
  for (const file of ['util.js', 'loan.js', 'model.js', 'spend.js']) {
    runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), context);
  }
  return context;
}
const debt: Debt = { id: 'd', name: 'Thẻ', mode: 'custom', balance: 500, payment: 500, dueDay: 10, stmtDay: 24, dueMode: 'day', grace: 0, sched: [] };
describe('Đối chiếu nghiệp vụ 1.3', () => {
  it('hạn trả trùng 1.3 qua tháng ngắn, năm nhuận và giao năm', () => {
    const ctx = legacy();
    for (const key of ['2024-02', '2026-02', '2026-09', '2026-12']) {
      for (const stmtDay of [0, 24, 27, 31]) for (const dueDay of [1, 10, 31]) for (const grace of [0, 25, 60]) {
        for (const dueMode of ['day', 'after'] as const) {
          const d = { ...debt, stmtDay, dueDay, grace, dueMode };
          expect(rowDue(d, key).getTime()).toBe(runInContext(`rowDue(${JSON.stringify(d)}, '${key}').getTime()`, ctx));
        }
      }
    }
  });
  it('giữ dấu trả cũ và phần đã thanh toán, không làm đổi lịch', () => {
    const ctx = legacy();
    const d = { ...debt, sched: [{ k: '2026-08', a: 500, settled: 200 }, { k: '2026-08', a: 300, p: '2026-09-01' as const }] };
    const before = JSON.stringify(d);
    d.sched.forEach(row => expect(remaining(row)).toBe(runInContext(`rowRemaining(${JSON.stringify(row)})`, ctx)));
    const rows = debtRows(d, new Date(2026, 8, 29));
    expect(rows.map(r => r.status)).toEqual(['Quá hạn', 'Đã trả']);
    expect(JSON.stringify(d)).toBe(before);
  });
  it('thu, chi, chuyển ví, mua tín dụng và trả nợ cho cùng số liệu với 1.3', () => {
    const ctx = legacy();
    const tx = ['income', 'expense', 'transfer', 'credit', 'repayment'].map((type, i) => ({ id: String(i), type, amount: 100 + i * 10, date: '2026-09-12', wallet: type === 'credit' ? '' : 'cash', to: type === 'transfer' ? 'bank' : '', interest: type === 'repayment' ? 10 : 0, fee: 0, category: 'Khác' }));
    const data = parseSnapshot(JSON.stringify({ v: 1, debts: [], wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 1000 }, { id: 'bank', name: 'Ngân hàng', opening: 200 }], tx: { '2026-09': tx } }));
    const actual = summarize(data, '2026-09-29');
    const old = runInContext(`spendSummary('2026-09', ${JSON.stringify(data)}, '2026-09-29')`, ctx);
    expect(actual.expense).toBe(old.expense); expect(actual.income).toBe(old.income);
    actual.balances.forEach(w => expect(w.balance).toBe(runInContext(`walletBalance('${w.id}', ${JSON.stringify(data)}, '2026-09-29')`, ctx)));
  });
  it('từ chối lịch sai và khoản nợ trùng ID', () => {
    const base = { v: 1, wallets: [], tx: {}, debts: [debt, debt] };
    expect(() => parseSnapshot(JSON.stringify(base))).toThrow();
    expect(() => parseSnapshot(JSON.stringify({ ...base, debts: [{ ...debt, sched: [{ k: '2026-13', a: 50 }] }] }))).toThrow();
  });
});