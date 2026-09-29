import { describe, expect, it } from 'vitest';
import { parseSnapshot, summarize } from './snapshot';

const base = { v: 1, wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 1000 }, { id: 'bank', name: 'Ngân hàng', opening: 0 }], debts: [], tx: {} };
describe('Bản chụp chỉ đọc', () => {
  it('không thay đổi dữ liệu nguồn', () => {
    const raw = JSON.stringify(base); const data = parseSnapshot(raw);
    summarize(data, '2026-09-29'); expect(JSON.stringify(data)).toBe(JSON.stringify({ wallets: base.wallets, tx: {}, debts: [] }));
  });
  it('không tính mua tín dụng vào tiền mặt hoặc đếm lại gốc trả nợ', () => {
    const data = parseSnapshot(JSON.stringify({ ...base, tx: { '2026-09': [
      { id: '1', date: '2026-09-01', type: 'credit', amount: 500, wallet: '' },
      { id: '2', date: '2026-09-02', type: 'repayment', amount: 220, interest: 20, wallet: 'cash' },
      { id: '3', date: '2026-09-03', type: 'transfer', amount: 100, wallet: 'cash', to: 'bank' },
    ] } }));
    const result = summarize(data, '2026-09-29');
    expect(result.cash).toBe(780); expect(result.expense).toBe(520); expect(result.balances.map(w => w.balance)).toEqual([680, 100]);
  });
  it('không cộng giao dịch tương lai', () => {
    const data = parseSnapshot(JSON.stringify({ ...base, tx: { '2026-10': [{ id: '1', date: '2026-10-01', type: 'income', amount: 100, wallet: 'cash' }] } }));
    expect(summarize(data, '2026-09-29').cash).toBe(1000);
  });
  it.each(['{', '{}', JSON.stringify({ ...base, wallets: [{ id: 'x', name: 'X', opening: -1 }] }), JSON.stringify({ ...base, tx: { '2026-02': [{ id: '1', date: '2026-02-30', type: 'expense', amount: 5, wallet: 'cash' }] } })])('từ chối nguồn dữ liệu lỗi', raw => {
    expect(() => parseSnapshot(raw)).toThrow();
  });
});