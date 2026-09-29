import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';

const payload = { v: 1, updatedAt: 1, debts: [], wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 100, extra: 42 }, { id: 'bank', name: 'Ngân hàng', opening: 200 }], tx: {}, recv: [{ id: 'r' }], budgets: { '2026-01': { 'Khác': 50 } } };
const reply = (value: unknown) => new Response(JSON.stringify(value));
async function setup(source: unknown = payload, result: 'ok' | 'conflict' | 'network' = 'ok') {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } }))
    .mockResolvedValueOnce(reply([{ payload: source, updated_at: '2026-01-01T00:00:00Z' }]))
    .mockImplementationOnce(async (_url, options) => {
      if (result === 'network') throw new Error('offline');
      return reply(result === 'conflict' ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-03T00:00:00Z' }]);
    });
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  return { client, request };
}
it('xoá ví trống, giữ nguyên ID và dữ liệu khác bằng PATCH có điều kiện', async () => {
  const { client, request } = await setup();
  const data = await client.removeWallet('bank');
  expect(data.wallets).toEqual([payload.wallets[0]]);
  const saved = JSON.parse(client.exportBackup()).data;
  expect(saved).toEqual({ ...payload, wallets: [payload.wallets[0]], updatedAt: saved.updatedAt });
  expect(saved.updatedAt).toBeGreaterThan(payload.updatedAt);
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
});
it('chặn ví cuối cùng và ID không còn tồn tại trước khi ghi', async () => {
  const source = { ...payload, wallets: [payload.wallets[0]] };
  const { client, request } = await setup(source);
  await expect(client.removeWallet('cash')).rejects.toThrow('ít nhất một');
  await expect(client.removeWallet('missing')).rejects.toThrow('không còn');
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(client.exportBackup()).data).toEqual(source);
});
it.each(['income', 'expense', 'repayment', 'credit', 'transfer-out', 'transfer-in'])('chặn lịch sử %s kể cả ở tháng cũ', async type => {
  const transfer = type.startsWith('transfer');
  const source = { ...payload, tx: { '2020-01': [{ id: 't', date: '2020-01-01', type: transfer ? 'transfer' : type, amount: 1, wallet: type === 'transfer-in' ? 'cash' : 'bank', ...(transfer ? { to: type === 'transfer-in' ? 'bank' : 'cash' } : {}) }] } };
  const { client, request } = await setup(source);
  await expect(client.removeWallet('bank')).rejects.toThrow('lịch sử');
  expect(request).toHaveBeenCalledTimes(2);
  expect(client.canSave()).toBe(true);
  expect(JSON.parse(client.exportBackup()).data).toEqual(source);
});
it.each(['conflict', 'network'] as const)('khoá ghi sau lỗi %s, không tự thử lại', async result => {
  const { client, request } = await setup(payload, result);
  await expect(client.removeWallet('bank')).rejects.toThrow();
  expect(client.canSave()).toBe(false);
  await expect(client.removeWallet('bank')).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3);
});
it('không xoá khi đã ngắt kết nối', async () => {
  const { client, request } = await setup();
  client.disconnect();
  await expect(client.removeWallet('bank')).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(2);
});