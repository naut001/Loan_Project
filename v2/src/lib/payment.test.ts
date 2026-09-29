import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { applyDebtPayment, type DebtPayment } from './payment';
import { createCloudClient } from './cloud';
import { parseSnapshot, summarize } from './snapshot';
const values: DebtPayment = { debt: 'd', index: 0, wallet: 'cash', date: '2026-01-02', principal: 40, interest: 5, fee: 2, note: ' Trả ' };
const payload = { v: 1, updatedAt: 1, wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 1000, openingDate: '2026-01-01' }], tx: {}, recv: [{ id: 'r' }], debts: [{ id: 'd', name: 'Nợ', mode: 'custom', balance: 150, payment: 150, dueDay: 10, stmtDay: 0, grace: 0, dueMode: 'day', extra: 42, sched: [{ k: '2026-01', a: 100 }, { k: '2026-01', a: 50 }] }] };
it('số dư, kỳ nợ và báo cáo khớp nghiệp vụ 1.3', () => {
  const ctx = createContext({ crypto, localStorage: { getItem: () => null } });
  for (const file of ['util.js', 'loan.js', 'model.js', 'state.js', 'spend.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  const draft = structuredClone(payload);
  applyDebtPayment(draft, values);
  const old = JSON.parse(runInContext(`JSON.stringify((()=>{const s=${JSON.stringify(payload)}; recordDebtPayment(${JSON.stringify(values)},s); return s;})())`, ctx));
  for (const key of ['balance', 'payment', 'months', 'original']) expect((draft.debts[0] as unknown as Record<string, unknown>)[key]).toBe(old.debts[0][key]);
  expect(parseSnapshot(JSON.stringify(draft)).debts[0].sched?.[0].settled).toBe(old.debts[0].sched[0].settled);
  expect(summarize(parseSnapshot(JSON.stringify(draft)), '2026-01-31')).toMatchObject({ cash: runInContext(`walletBalance('cash',${JSON.stringify(old)},'2026-01-31')`, ctx), expense: runInContext(`spendSummary('2026-01',${JSON.stringify(old)}).expense`, ctx) });
});
it('trả một phần, giữ dữ liệu mở rộng và không đếm gốc vào chi tiêu', () => {
  const draft = structuredClone(payload);
  applyDebtPayment(draft, values);
  const data = parseSnapshot(JSON.stringify(draft));
  expect(data.debts[0]).toMatchObject({ balance: 110, payment: 110, months: 2, original: 150, extra: 42 });
  expect(data.debts[0].sched?.[0].settled).toBe(40);
  expect(data.tx['2026-01'][0]).toMatchObject({ type: 'repayment', amount: 47, interest: 5, fee: 2, row: data.debts[0].sched?.[0].id });
  expect(summarize(data, '2026-01-31')).toMatchObject({ cash: 953, expense: 7 });
  expect(draft.recv).toEqual(payload.recv);
});
it('nhiều lần trả giữ cùng ID kỳ và chặn vượt phần còn lại', () => {
  const draft = structuredClone(payload);
  applyDebtPayment(draft, values);
  applyDebtPayment(draft, { ...values, principal: 60 });
  const data = parseSnapshot(JSON.stringify(draft));
  expect(data.tx['2026-01'][0].row).toBe(data.tx['2026-01'][1].row);
  expect(data.debts[0].balance).toBe(50);
  expect(() => applyDebtPayment(draft, values)).toThrow('không còn');
});
it('đầu vào sai không thay đổi bản nháp', () => {
  for (const change of [{ principal: 101 }, { principal: 0 }, { fee: -1 }, { interest: 0.5 }, { date: '2025-12-31' }, { date: '2026-02-30' }, { wallet: 'missing' }, { index: -1 }]) {
    const draft = structuredClone(payload);
    expect(() => applyDebtPayment(draft, { ...values, ...change })).toThrow();
    expect(draft).toEqual(payload);
  }
});
it('chặn mã kỳ trùng và dấu đã trả cũ', () => {
  const draft = structuredClone(payload);
  draft.debts[0].sched.forEach(r => Object.assign(r, { id: 'same' }));
  expect(() => applyDebtPayment(draft, values)).toThrow('trùng');
  const paid = structuredClone(payload);
  Object.assign(paid.debts[0].sched[0], { p: '2026-01-01' });
  expect(() => applyDebtPayment(paid, values)).toThrow('không còn');
});
it.each([false, true])('cloud lưu nguyên tử; xung đột=%s', async conflict => {
  const reply = (v: unknown) => new Response(JSON.stringify(v));
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockImplementationOnce(async (_url, options) => reply(conflict ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-03T00:00:00Z' }]));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  if (conflict) {
    await expect(client.payDebt(values)).rejects.toThrow();
    await expect(client.payDebt(values)).rejects.toThrow('tải lại');
  } else {
    const data = await client.payDebt(values);
    expect(data.debts[0].balance).toBe(110);
    expect(data.tx['2026-01']).toHaveLength(1);
  }
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
});