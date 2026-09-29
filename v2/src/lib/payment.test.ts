import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { applyDebtPayment, undoDebtPayment, type DebtPayment } from './payment';
import { createCloudClient } from './cloud';
import { parseSnapshot, summarize } from './snapshot';
const values: DebtPayment = { debt: 'd', index: 0, wallet: 'cash', date: '2026-01-02', principal: 40, interest: 5, fee: 2, note: ' Trả ' };
const payload = { v: 1, updatedAt: 1, wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 1000, openingDate: '2026-01-01' }], tx: {}, recv: [{ id: 'r' }], debts: [{ id: 'd', name: 'Nợ', mode: 'custom', balance: 150, payment: 150, dueDay: 10, stmtDay: 0, grace: 0, dueMode: 'day', extra: 42, sched: [{ k: '2026-01', a: 100 }, { k: '2026-01', a: 50 }] }] };
function paidPayload() {
  const draft = structuredClone(payload);
  applyDebtPayment(draft, values);
  return { ...draft, ...parseSnapshot(JSON.stringify(draft)) };
}
it('hoàn tác không theo thứ tự khớp 1.3, giữ ID và dữ liệu mở rộng', () => {
  const draft = paidPayload();
  applyDebtPayment(draft, { ...values, principal: 60, date: '2026-02-02' });
  const first = draft.tx['2026-01'][0].id;
  const rowId = draft.debts[0].sched?.[0].id;
  const ctx = createContext({ crypto, localStorage: { getItem: () => null } });
  for (const file of ['util.js', 'loan.js', 'model.js', 'state.js', 'spend.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  const old = JSON.parse(runInContext(`JSON.stringify((()=>{const s=${JSON.stringify(draft)}; removeTransaction(${JSON.stringify(first)},s); return s;})())`, ctx));
  undoDebtPayment(draft, first);
  expect(draft).toEqual(old);
  expect(draft.debts[0]).toMatchObject({ balance: 90, extra: 42 });
  expect(draft.debts[0].sched?.[0]).toMatchObject({ id: rowId, settled: 60 });
  expect(summarize(draft, '2026-02-28')).toMatchObject({ cash: 933, expense: 7 });
  expect(draft.recv).toEqual(payload.recv);
  const before = structuredClone(draft);
  expect(() => undoDebtPayment(draft, first)).toThrow();
  expect(draft).toEqual(before);
  undoDebtPayment(draft, draft.tx['2026-02'][0].id);
  expect(draft.tx).toEqual({});
  expect(draft.debts[0].balance).toBe(150);
  expect(summarize(draft, '2026-02-28').cash).toBe(1000);
});
it('hoàn tác giữ dấu đã trả cũ và mọi trường mở rộng không liên quan', () => {
  const draft = paidPayload();
  Object.assign(draft.debts[0].sched![0], { p: '2026-01-03', extension: { retained: true } });
  undoDebtPayment(draft, draft.tx['2026-01'][0].id);
  expect(draft.debts[0].sched![0]).toMatchObject({ p: '2026-01-03', settled: 0, extension: { retained: true } });
  expect(draft.debts[0].balance).toBe(50);
});
it.each(['missing debt', 'missing row', 'duplicate row', 'insufficient settled', 'fees', 'ordinary', 'formula'])('chặn hoàn tác liên kết lỗi: %s', fault => {
  const draft = paidPayload();
  const tx = draft.tx['2026-01'][0];
  if (fault === 'missing debt') tx.debt = 'missing';
  if (fault === 'missing row') delete tx.row;
  if (fault === 'duplicate row') draft.debts[0].sched!.push({ ...draft.debts[0].sched![0] });
  if (fault === 'insufficient settled') draft.debts[0].sched![0].settled = 1;
  if (fault === 'fees') tx.fee = tx.amount;
  if (fault === 'ordinary') tx.type = 'expense';
  if (fault === 'formula') draft.debts[0].mode = 'formula';
  const before = structuredClone(draft);
  expect(() => undoDebtPayment(draft, tx.id)).toThrow();
  expect(draft).toEqual(before);
});
it.each(['success', 'conflict', 'network'])('cloud hoàn tác nguyên tử: %s', async outcome => {
  const draft = paidPayload();
  const id = draft.tx['2026-01'][0].id;
  const reply = (v: unknown) => new Response(JSON.stringify(v));
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload: draft, updated_at: '2026-01-01T00:00:00Z' }])).mockImplementationOnce(async (_url, options) => {
    if (outcome === 'network') throw new Error('offline');
    return reply(outcome === 'conflict' ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-03T00:00:00Z' }]);
  });
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  await expect(client.undoPayment('missing')).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
  if (outcome === 'success') {
    const result = await client.undoPayment(id);
    expect(result.debts[0].balance).toBe(150);
    expect(result.tx).toEqual({});
    await expect(client.undoPayment(id)).rejects.toThrow();
  } else {
    await expect(client.undoPayment(id)).rejects.toThrow();
    expect(client.canSave()).toBe(false);
    await expect(client.undoPayment(id)).rejects.toThrow('tải lại');
  }
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][0]).toContain('user_id=eq.u&updated_at=eq.');
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  const sent = JSON.parse(String(request.mock.calls[2][1]?.body)).payload;
  expect(sent.recv).toEqual(payload.recv);
  expect(sent.tx).toEqual({});
  expect(sent.debts[0].balance).toBe(150);
});
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