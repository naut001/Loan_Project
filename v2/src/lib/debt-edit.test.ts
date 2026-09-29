import { expect, it, vi } from 'vitest';
import { editDebt } from './debt-edit';
import { createCloudClient } from './cloud';
import { parseSnapshot } from './snapshot';

const values = { name: 'Thẻ', dueDay: 10, stmtDay: 24, dueMode: 'day' as const, grace: 0 };
const payload = { v: 1, updatedAt: 1, wallets: [], tx: {}, recv: [{ extra: 42 }], debts: [{ id: 'd', mode: 'custom', balance: 0, payment: 0, sched: [], extension: { keep: true }, ...values }] };
it('tạo, sửa, xoá khoản trống giữ dữ liệu khác', () => {
  const draft = structuredClone(payload);
  editDebt(draft, { ...values, name: ' Mới ' });
  const added = parseSnapshot(JSON.stringify(draft)).debts[1];
  expect(added).toMatchObject({ name: 'Mới', balance: 0, sched: [], mode: 'custom' });
  expect(added.id).not.toBe('d');
  editDebt(draft, { ...values, name: 'Tên mới' }, 'd');
  expect(draft.debts[0]).toMatchObject({ name: 'Tên mới', extension: { keep: true } });
  editDebt(draft, undefined, added.id);
  expect(draft.debts).toHaveLength(1);
  expect(draft.tx).toEqual(payload.tx); expect(draft.wallets).toEqual(payload.wallets); expect(draft.recv).toEqual(payload.recv);
});
it.each([{ balance: 1 }, { payment: 1 }, { paid: { '2026-09': 'old' } }, { sched: [{ id: 'r', k: '2026-09', a: 10, p: 'old', extra: 42 }] }])('bảo vệ lịch sử %j', change => {
  const draft = structuredClone(payload); Object.assign(draft.debts[0], change);
  const before = structuredClone(draft);
  expect(() => editDebt(draft, undefined, 'd')).toThrow();
  expect(() => editDebt(draft, { ...values, dueDay: 11 }, 'd')).toThrow();
  expect(draft).toEqual(before);
  editDebt(draft, { ...values, name: 'Đổi tên' }, 'd');
  expect(draft.debts[0]).toEqual({ ...before.debts[0], name: 'Đổi tên' });
});
it.each([{ name: '' }, { dueDay: 32 }, { stmtDay: -1 }, { grace: 61 }, { dueDay: 1.5 }])('từ chối đầu vào sai %j', change => {
  const draft = structuredClone(payload);
  expect(() => editDebt(draft, { ...values, ...change })).toThrow(); expect(draft).toEqual(payload);
});
it('chặn mã không tồn tại và trùng mã', () => {
  const draft = structuredClone(payload);
  expect(() => editDebt(draft, values, 'missing')).toThrow();
  draft.debts.push(structuredClone(draft.debts[0]));
  expect(() => editDebt(draft, values, 'd')).toThrow();
});
it('giữ giao dịch liên kết mồ côi, không xoá hoặc dời hạn nợ', () => {
  const draft = { ...structuredClone(payload), tx: { '2026-01': [{ id: 't', type: 'credit', wallet: '', amount: 10, date: '2026-01-01', debt: 'd', row: 'missing', extension: 42 }] } };
  const before = structuredClone(draft);
  expect(() => editDebt(draft, undefined, 'd')).toThrow();
  expect(() => editDebt(draft, { ...values, dueDay: 11 }, 'd')).toThrow();
  expect(draft).toEqual(before);
  editDebt(draft, { ...values, name: 'Đổi tên' }, 'd');
  expect(draft.tx).toEqual(before.tx);
});
it.each(['ok', 'conflict', 'network'])('ghi có điều kiện %s', async outcome => {
  const reply = (value: unknown) => new Response(JSON.stringify(value));
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 't', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01' }])).mockImplementationOnce(async (_url, options) => {
    if (outcome === 'network') throw new Error('offline');
    return reply(outcome === 'conflict' ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-02' }]);
  });
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  await expect(client.saveDebt({ ...values, dueDay: 0 })).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(client.exportBackup()).data).toEqual(payload);
  if (outcome === 'ok') expect((await client.saveDebt(values)).debts).toHaveLength(2);
  else {
    await expect(client.saveDebt(values)).rejects.toThrow();
    expect(client.canSave()).toBe(false);
    await expect(client.saveDebt(values)).rejects.toThrow();
  }
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  expect(request.mock.calls[2][0]).toContain('user_id=eq.u&updated_at=eq.');
});