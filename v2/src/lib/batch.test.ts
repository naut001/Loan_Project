import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';
import { summarize } from './snapshot';
const entry = { type: 'expense' as const, date: '2026-01-02', wallet: 'cash', amount: 10, note: ' Chi ', category: 'Khác' };
const payload = { v: 1, updatedAt: 1, debts: [{ id: 'd', name: 'Thẻ', mode: 'custom', balance: 0, payment: 0, dueDay: 10, stmtDay: 24, dueMode: 'day', grace: 0, sched: [], extra: 42 }], wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 100, openingDate: '2026-01-01' }], tx: {}, recv: [{ id: 'r' }] };
const credit = { type: 'credit' as const, debt: 'd', date: entry.date, amount: 20, category: 'Khác', note: 'Mua' };
const reply = (v: unknown) => new Response(JSON.stringify(v));
async function setup(conflict = false) {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockImplementationOnce(async (_url, options) => reply(conflict ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-03T00:00:00Z' }]));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  return { client, request };
}
it('lưu cả lô bằng một PATCH, ID riêng và giữ dữ liệu ngoài màn hình', async () => {
  const { client, request } = await setup();
  const data = await client.addCashBatch([entry, { ...entry, amount: 20 }]);
  expect(data.tx['2026-01']).toHaveLength(2);
  expect(new Set(data.tx['2026-01'].map(t => t.id)).size).toBe(2);
  expect(data.tx['2026-01'][0].note).toBe('Chi');
  expect(JSON.parse(client.exportBackup()).data.recv).toEqual(payload.recv);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
});
it('dòng sau sai không lưu dòng trước và không làm đổi baseline', async () => {
  const { client, request } = await setup();
  for (const change of [{ amount: -1 }, { date: '2025-12-31' }, { wallet: 'missing' }, { category: '__proto__' }, { date: '2026-02-30' }]) await expect(client.addCashBatch([entry, { ...entry, ...change }])).rejects.toThrow('Dòng 2');
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(client.exportBackup()).data).toEqual(payload);
});
it('chặn lô rỗng, quá lớn và chuyển tiền', async () => {
  const { client, request } = await setup();
  await expect(client.addCashBatch([])).rejects.toThrow();
  await expect(client.addCashBatch(Array(101).fill(entry))).rejects.toThrow();
  await expect(client.addCashBatch([{ ...entry, type: 'transfer' }])).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
});
it('lô xen kẽ giữ đủ dòng, chỉ chi tiền giảm ví, một PATCH', async () => {
  const { client, request } = await setup();
  const data = await client.addCashBatch([entry, credit, entry, { ...credit, period: '2026-03' }, entry]);
  expect(data.tx['2026-01']).toHaveLength(5);
  expect(new Set(data.tx['2026-01'].map(t => t.id)).size).toBe(5);
  expect(data.debts[0]).toMatchObject({ balance: 40, extra: 42 });
  expect(data.debts[0].sched?.map(r => r.k)).toEqual(['2026-01', '2026-03']);
  expect(summarize(data, '2026-01-31')).toMatchObject({ cash: 70, expense: 70 });
  expect(JSON.parse(client.exportBackup()).data.recv).toEqual(payload.recv);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
});
it('dòng lỗi sau khoản mua không làm đổi nợ hoặc lịch sử đã tải', async () => {
  const { client, request } = await setup();
  await expect(client.addCashBatch([credit, { ...entry, amount: 0 }])).rejects.toThrow('Dòng 2');
  await expect(client.addCashBatch([entry, credit, { ...credit, debt: 'missing' }])).rejects.toThrow('Dòng 3');
  expect(JSON.parse(client.exportBackup()).data).toEqual(payload);
  expect(request).toHaveBeenCalledTimes(2);
});
it('lô hỗn hợp xung đột không tự gửi lại', async () => {
  const { client, request } = await setup(true);
  await expect(client.addCashBatch([entry, credit])).rejects.toThrow();
  await expect(client.addCashBatch([entry, credit])).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3);
});
it('xung đột không tự gửi lại lô', async () => {
  const { client, request } = await setup(true);
  await expect(client.addCashBatch([entry])).rejects.toThrow();
  await expect(client.addCashBatch([entry])).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3);
});