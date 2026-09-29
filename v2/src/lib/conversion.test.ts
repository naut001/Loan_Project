import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { convertFormula } from './conversion';
import { createCloudClient } from './cloud';
import { parseSnapshot } from './snapshot';

const payload = { v: 1, updatedAt: 1, tx: {}, wallets: [], recv: [{ id: 'keep' }], debts: [{ id: 'd', name: 'Vay', mode: 'formula', balance: 12000000, payment: 1000000, rate: 12, dueDay: 10, stmtDay: 0, dueMode: 'day', grace: 0, paid: {}, extra: 42 }] };
afterEach(() => vi.useRealTimers());
it.each([{ stmtDay: 0 }, { stmtDay: 27 }, { stmtDay: 27, dueMode: 'after', grace: 60 }, { paid: { '2026-09': { at: '2026-09-01' } } }, { rate: 0 }])('chuyển lịch khớp 1.3: %j', change => {
  const draft = structuredClone(payload); Object.assign(draft.debts[0], change);
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 28));
  const ctx = createContext({ Date, crypto, localStorage: { getItem: () => null } });
  for (const file of ['util.js', 'loan.js', 'model.js', 'state.js', 'spend.js']) runInContext(readFileSync(new URL(`../../../js/${file}`, import.meta.url), 'utf8'), ctx);
  const old = JSON.parse(runInContext(`JSON.stringify((()=>{const s=${JSON.stringify(draft)};convertFormulaDebt('d',s);return s;})())`, ctx));
  convertFormula(draft, 'd', new Date(2026, 8, 28));
  const data = parseSnapshot(JSON.stringify(draft));
  expect(data.debts[0].sched?.map(({ id: _id, ...row }) => row)).toEqual(old.debts[0].sched.map(({ id: _id, ...row }: { id: string }) => row));
  expect(data.debts[0]).toMatchObject({ balance: old.debts[0].balance, payment: old.debts[0].payment, extra: 42, paid: old.debts[0].paid });
  expect(draft.tx).toEqual(payload.tx); expect(draft.recv).toEqual(payload.recv);
  expect(() => convertFormula(draft, 'd')).toThrow();
});
it.each([{ payment: 1 }, { rate: -1 }, { rate: '12' }, { balance: 0 }, { paid: [] }])('chặn dữ liệu sai không đổi bản nháp: %j', change => {
  const draft = structuredClone(payload); Object.assign(draft.debts[0], change);
  const before = structuredClone(draft);
  expect(() => convertFormula(draft, 'd')).toThrow(); expect(draft).toEqual(before);
});
it.each([false, true])('lưu có điều kiện; xung đột=%s', async conflict => {
  const reply = (v: unknown) => new Response(JSON.stringify(v));
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 't', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01' }])).mockImplementationOnce(async (_url, options) => reply(conflict ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-02' }]));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  if (conflict) { await expect(client.convertDebt('d')).rejects.toThrow(); expect(client.canSave()).toBe(false); }
  else expect((await client.convertDebt('d')).debts[0].mode).toBe('custom');
  await expect(client.convertDebt('d')).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][0]).toContain('user_id=eq.u&updated_at=eq.');
});