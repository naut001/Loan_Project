import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { applyCreditPurchase, creditPeriod, undoCreditPurchase, type CreditPurchase } from './credit';
import { applyDebtPayment, undoDebtPayment } from './payment';
import { createCloudClient } from './cloud';
import { parseSnapshot, summarize } from './snapshot';

const payload = { v: 1, updatedAt: 1, extension: { keep: true }, wallets: [{ id: 'cash', name: 'Tiền', opening: 1000 }], tx: {}, debts: [{ id: 'd', name: 'Thẻ', mode: 'custom' as const, balance: 100, payment: 100, dueDay: 10, stmtDay: 24, dueMode: 'day' as const, grace: 0, extension: 42, sched: [{ id: 'old', k: '2026-01', a: 100 }] }] };
const values: CreditPurchase = { debt: 'd', date: '2026-01-25', amount: 500, category: 'Khác', note: ' Mua ' };
function draft() { return { ...structuredClone(payload), ...parseSnapshot(JSON.stringify(payload)) }; }
function legacy() {
  const ctx = createContext({ crypto, localStorage: { getItem: () => null } });
  for (const file of ['util.js', 'loan.js', 'model.js', 'state.js', 'spend.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  return ctx;
}
it.each([[24, '2026-01-24'], [24, '2026-01-25'], [31, '2024-02-29'], [31, '2025-02-28'], [24, '2025-12-25'], [0, '2026-01-10'], [0, '2026-01-11']])('kỳ sao kê khớp 1.3: %s %s', (stmtDay, date) => {
  const debt = { ...payload.debts[0], stmtDay };
  expect(creditPeriod(debt, date)).toBe(runInContext(`creditPeriod(${JSON.stringify(debt)},${JSON.stringify(date)})`, legacy()));
});
it('mua và hoàn tác khớp 1.3, không trừ tiền, giữ dữ liệu mở rộng', () => {
  const data = draft();
  applyCreditPurchase(data, values);
  const old = JSON.parse(runInContext(`JSON.stringify((()=>{const s=${JSON.stringify(payload)};recordCreditPurchase(${JSON.stringify(values)},s);return s;})())`, legacy()));
  expect(data.debts[0]).toMatchObject({ balance: old.debts[0].balance, payment: old.debts[0].payment, extension: 42 });
  expect(data.debts[0].sched![1]).toMatchObject({ k: '2026-02', a: 500 });
  expect(summarize(data, '2026-01-31')).toMatchObject({ cash: 1000, expense: 500 });
  const id = data.tx['2026-01'][0].id;
  const undone = JSON.parse(runInContext(`JSON.stringify((()=>{const s=${JSON.stringify(data)};removeTransaction(${JSON.stringify(id)},s);return s;})())`, legacy()));
  undoCreditPurchase(data, id);
  expect(data).toEqual(undone);
  expect(data.extension).toEqual({ keep: true });
  expect(data.debts[0].sched).toEqual(payload.debts[0].sched);
  expect(summarize(data, '2026-01-31')).toMatchObject({ cash: 1000, expense: 0 });
  expect(() => undoCreditPurchase(data, id)).toThrow();
});
it('chọn kỳ thủ công và yêu cầu hoàn tác thanh toán trước khoản mua', () => {
  const data = draft();
  applyCreditPurchase(data, { ...values, period: '2026-03' });
  expect(data.debts[0].sched![1].k).toBe('2026-03');
  const id = data.tx['2026-01'][0].id;
  applyDebtPayment(data, { debt: 'd', index: 1, date: '2026-01-26', wallet: 'cash', principal: 50, interest: 0, fee: 0, note: '' });
  const before = structuredClone(data);
  expect(() => undoCreditPurchase(data, id)).toThrow();
  expect(data).toEqual(before);
  undoDebtPayment(data, data.tx['2026-01'][1].id);
  undoCreditPurchase(data, id);
  expect(data.debts[0].balance).toBe(100);
});
it.each([{ amount: 0 }, { amount: 1.5 }, { amount: 1e12 + 1 }, { date: '2026-02-30' }, { date: '9999-12-31' }, { period: '2025-12' }, { period: '2026-13' }, { debt: 'missing' }, { category: 'invalid' }])('đầu vào lỗi không đổi dữ liệu: %j', change => {
  const data = draft();
  expect(() => applyCreditPurchase(data, { ...values, ...change })).toThrow();
  expect(data).toEqual(draft());
});
it.each(['paid', 'duplicate', 'amount', 'missing', 'linked'])('chặn hoàn tác kỳ không an toàn: %s', fault => {
  const data = draft(); applyCreditPurchase(data, values);
  const row = data.debts[0].sched![1], tx = data.tx['2026-01'][0];
  if (fault === 'paid') row.p = '2026-01-26';
  if (fault === 'duplicate') data.debts[0].sched!.push({ ...row });
  if (fault === 'amount') row.a++;
  if (fault === 'missing') delete tx.row;
  if (fault === 'linked') data.tx['2026-01'].push({ ...tx, id: 'other' });
  const before = structuredClone(data);
  expect(() => undoCreditPurchase(data, tx.id)).toThrow();
  expect(data).toEqual(before);
});
it.each(['success', 'conflict', 'network'])('cloud ghi và hoàn tác nguyên tử: %s', async outcome => {
  const reply = (v: unknown) => new Response(JSON.stringify(v));
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockImplementation(async (_url, options) => {
    if (outcome === 'network') throw new Error('offline');
    return reply(outcome === 'conflict' ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-03T00:00:00Z' }]);
  });
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  if (outcome === 'success') {
    const data = await client.saveCredit(values);
    expect(data.debts[0].balance).toBe(600);
    const result = await client.saveCredit(data.tx['2026-01'][0].id);
    expect(result.debts[0].balance).toBe(100);
    expect(result.tx).toEqual({});
    expect(request).toHaveBeenCalledTimes(4);
  } else {
    await expect(client.saveCredit(values)).rejects.toThrow();
    await expect(client.saveCredit(values)).rejects.toThrow('tải lại');
    expect(request).toHaveBeenCalledTimes(3);
  }
  expect(request.mock.calls[2][0]).toContain('user_id=eq.u&updated_at=eq.');
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  expect(JSON.parse(String(request.mock.calls[2][1]?.body)).payload.extension).toEqual(payload.extension);
});