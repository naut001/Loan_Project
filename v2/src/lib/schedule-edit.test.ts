import { expect, it, vi } from 'vitest';
import { editSchedule } from './schedule-edit';
import { createCloudClient } from './cloud';

const payload = { v: 1, updatedAt: 1, wallets: [], tx: {}, recv: [{ keep: true }], debts: [{ id: 'd', name: 'Nợ', mode: 'custom', balance: 10, payment: 10, dueDay: 1, stmtDay: 0, dueMode: 'day', grace: 0, extra: 42, sched: [{ id: 'r', k: '2026-01', a: 10, extra: 'keep' }] }] };
const entry = { debt: 'd', values: { month: '2026-01', amount: 20 } };
it('thêm cùng tháng, sửa, xoá giữ mã và trường mở rộng; không đổi tiền', () => {
  const draft = structuredClone(payload);
  editSchedule(draft, entry);
  expect(draft.debts[0]).toMatchObject({ balance: 30, payment: 30, extra: 42 });
  expect(draft.debts[0].sched[1].id).not.toBe('r');
  editSchedule(draft, { ...entry, index: 0, values: { month: '2026-02', amount: 40 } });
  expect(draft.debts[0].sched[0]).toEqual({ id: 'r', k: '2026-02', a: 40, extra: 'keep' });
  expect(draft.debts[0]).toMatchObject({ balance: 60, payment: 20 });
  editSchedule(draft, { debt: 'd', index: 1 });
  expect(draft.debts[0]).toMatchObject({ balance: 40, payment: 40 });
  expect(draft.tx).toEqual(payload.tx); expect(draft.wallets).toEqual(payload.wallets); expect(draft.recv).toEqual(payload.recv);
});
it.each([{ p: 'legacy' }, { settled: 1 }])('bảo vệ kỳ đã trả %j', change => {
  const draft = structuredClone(payload); Object.assign(draft.debts[0].sched[0], change);
  const before = structuredClone(draft);
  expect(() => editSchedule(draft, { ...entry, index: 0 })).toThrow();
  expect(() => editSchedule(draft, { debt: 'd', index: 0 })).toThrow();
  expect(draft).toEqual(before);
  editSchedule(draft, entry);
  expect(draft.debts[0].sched[0]).toEqual(before.debts[0].sched[0]);
});
it.each(['r', 'missing'])('bảo vệ giao dịch liên kết %s', row => {
  const draft = { ...structuredClone(payload), tx: { '2026-01': [{ id: 't', type: 'credit', wallet: '', date: '2026-01-01', amount: 10, debt: 'd', row }] } };
  const before = structuredClone(draft);
  expect(() => editSchedule(draft, { ...entry, index: 0 })).toThrow();
  expect(() => editSchedule(draft, { debt: 'd', index: 0 })).toThrow();
  expect(draft).toEqual(before);
});
it.each([{ month: '2026-13', amount: 10 }, { month: '2026-01', amount: 0 }, { month: '2026-01', amount: 1.5 }, { month: '2026-01', amount: 1e12 + 1 }])('từ chối đầu vào sai %j', values => {
  const draft = structuredClone(payload);
  expect(() => editSchedule(draft, { ...entry, values })).toThrow(); expect(draft).toEqual(payload);
});
it('chặn index sai, mã trùng và khoản công thức', () => {
  const draft = structuredClone(payload);
  for (const index of [-1, 0.5, 4]) expect(() => editSchedule(draft, { ...entry, index })).toThrow();
  draft.debts[0].mode = 'formula'; expect(() => editSchedule(draft, entry)).toThrow();
  draft.debts[0].mode = 'custom'; draft.debts[0].sched.push({ ...draft.debts[0].sched[0] });
  expect(() => editSchedule(draft, entry)).toThrow();
});
it.each(['ok', 'conflict', 'network'])('lưu nguyên tử %s', async outcome => {
  const reply = (value: unknown) => new Response(JSON.stringify(value));
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 't', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01' }])).mockImplementationOnce(async (_url, options) => {
    if (outcome === 'network') throw new Error('offline');
    return reply(outcome === 'conflict' ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-02' }]);
  });
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  await expect(client.saveSchedule({ ...entry, index: -1 })).rejects.toThrow();
  expect(JSON.parse(client.exportBackup()).data).toEqual(payload);
  expect(request).toHaveBeenCalledTimes(2);
  if (outcome === 'ok') expect((await client.saveSchedule(entry)).debts[0].balance).toBe(30);
  else {
    await expect(client.saveSchedule(entry)).rejects.toThrow(); expect(client.canSave()).toBe(false);
    await expect(client.saveSchedule(entry)).rejects.toThrow();
  }
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  expect(request.mock.calls[2][0]).toContain('user_id=eq.u&updated_at=eq.');
});