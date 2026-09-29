import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';
const entry = { type: 'expense' as const, date: '2026-01-02', wallet: 'cash', amount: 10, note: ' Chi ', category: 'Khác' };
const payload = { v: 1, updatedAt: 1, debts: [], wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 100, openingDate: '2026-01-01' }], tx: {}, recv: [{ id: 'r' }] };
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
it('chặn lô rỗng, quá lớn và mua tín dụng', async () => {
  const { client, request } = await setup();
  await expect(client.addCashBatch([])).rejects.toThrow();
  await expect(client.addCashBatch(Array(101).fill(entry))).rejects.toThrow();
  await expect(client.addCashBatch([{ ...entry, type: 'transfer' }])).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
});
it('xung đột không tự gửi lại lô', async () => {
  const { client, request } = await setup(true);
  await expect(client.addCashBatch([entry])).rejects.toThrow();
  await expect(client.addCashBatch([entry])).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3);
});