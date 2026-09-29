import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';

const values = { name: 'Ngân hàng', type: 'bank', opening: 100, openingDate: '2026-01-01' };
const payload = { v: 1, updatedAt: 1, debts: [], wallets: [{ ...values, id: 'cash', extra: 'giữ nguyên' }], tx: { '2026-01': [{ id: 't', type: 'income', amount: 1, date: '2026-01-02', wallet: 'cash' }] }, recv: [{ id: 'r' }], custom: { preserved: true } };
const reply = (value: unknown) => new Response(JSON.stringify(value));
async function setup(conflict = false) {
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } }))
    .mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }]))
    .mockImplementationOnce(async (_url, options) => reply(conflict ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-03T00:00:00Z' }]));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  return { client, request };
}
it('thêm ví với ID mới, không đổi lịch sử hoặc dữ liệu ngoài màn hình', async () => {
  const { client, request } = await setup();
  const data = await client.putWallet(values);
  expect(data.wallets).toHaveLength(2);
  expect(data.wallets[1].id).not.toBe('cash');
  const saved = JSON.parse(client.exportBackup()).data;
  expect(saved.tx).toEqual(payload.tx); expect(saved.recv).toEqual(payload.recv); expect(saved.custom).toEqual(payload.custom);
  expect(saved.updatedAt).toBeGreaterThan(payload.updatedAt);
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
});
it('sửa ví giữ ID và trường mở rộng', async () => {
  const { client } = await setup();
  await client.putWallet({ ...values, name: 'Tên mới' }, 'cash');
  expect(JSON.parse(client.exportBackup()).data.wallets).toEqual([{ ...payload.wallets[0], name: 'Tên mới' }]);
});
it('chặn ngày sai, số dư sai, tài khoản mất và mốc vượt giao dịch trước request', async () => {
  const { client, request } = await setup();
  for (const change of [{ opening: -1 }, { opening: 1.5 }, { opening: 1e12 + 1 }, { name: ' ' }, { type: 'credit' }, { openingDate: '2026-02-30' }, { openingDate: '9999-01-01' }, { openingDate: '2026-01-03' }]) {
    await expect(client.putWallet({ ...values, ...change }, 'cash')).rejects.toThrow();
  }
  await expect(client.putWallet(values, 'missing')).rejects.toThrow('không còn');
  expect(request).toHaveBeenCalledTimes(2); expect(client.canSave()).toBe(true);
});
it('xung đột sửa ví khoá ghi, không tự gửi lại', async () => {
  const { client, request } = await setup(true);
  await expect(client.putWallet(values, 'cash')).rejects.toThrow('đã thay đổi');
  await expect(client.putWallet(values, 'cash')).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3); expect(client.canSave()).toBe(false);
});