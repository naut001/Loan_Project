import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';
import { categoryExpense } from './budget';

const entry = { type: 'expense' as const, wallet: 'cash', amount: 5, date: '2026-01-02', note: 'Cũ' };
const payload = { v: 1, updatedAt: 1, wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 100 }], debts: [], tx: { '2026-01': [{ ...entry, id: 't', category: 'Ăn uống', extra: 42 }] }, recv: [{ id: 'r' }] };
const reply = (value: unknown) => new Response(JSON.stringify(value));
async function setup(type = 'expense', conflict = false, links: { debt?: string; row?: string } = {}) {
  const source = structuredClone(payload);
  Object.assign(source.tx['2026-01'][0], { type }, links);
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } }))
    .mockResolvedValueOnce(reply([{ payload: source, updated_at: '2026-01-01T00:00:00Z' }]))
    .mockImplementationOnce(async (_url, options) => reply(conflict ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-03T00:00:00Z' }]));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  return { client, request };
}
it('sửa ngày chuyển tháng, giữ ID, danh mục và trường bổ sung', async () => {
  const { client } = await setup();
  await client.addCashEntry({ ...entry, date: '2026-02-01', amount: 9 }, undefined, 't');
  const saved = JSON.parse(client.exportBackup()).data;
  expect(saved.tx['2026-01']).toBeUndefined();
  expect(saved.tx['2026-02']).toEqual([{ ...payload.tx['2026-01'][0], date: '2026-02-01', amount: 9, to: '' }]);
  expect(saved.recv).toEqual(payload.recv);
});
it('xoá giao dịch thông thường bằng PATCH có điều kiện, giữ dữ liệu khác', async () => {
  const { client, request } = await setup();
  await client.removeCashEntry('t');
  expect(JSON.parse(client.exportBackup()).data.tx).toEqual({});
  expect(JSON.parse(client.exportBackup()).data.recv).toEqual(payload.recv);
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
});
it.each(['repayment', 'credit'])('không sửa hoặc xoá giao dịch liên kết %s', async type => {
  const { client, request } = await setup(type);
  await expect(client.addCashEntry(entry, undefined, 't')).rejects.toThrow('liên kết');
  await expect(client.removeCashEntry('t')).rejects.toThrow('liên kết');
  expect(request).toHaveBeenCalledTimes(2);
});
it('ID mất và sửa sai không phát sinh ghi', async () => {
  const { client, request } = await setup();
  await expect(client.addCashEntry(entry, undefined, 'missing')).rejects.toThrow('không còn');
  await expect(client.removeCashEntry('missing')).rejects.toThrow('không còn');
  await expect(client.addCashEntry({ ...entry, amount: -1 }, undefined, 't')).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(client.exportBackup()).data.tx).toEqual(payload.tx);
});
it('xung đột xoá chặn thử lại tự động', async () => {
  const { client, request } = await setup('expense', true);
  await expect(client.removeCashEntry('t')).rejects.toThrow('đã thay đổi');
  await expect(client.removeCashEntry('t')).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3);
});
it('đổi danh mục cập nhật đúng ngân sách, giữ ID và trường bổ sung', async () => {
  const { client } = await setup();
  const data = await client.addCashEntry({ ...entry, category: 'Đi lại' }, undefined, 't');
  expect(categoryExpense(data.tx['2026-01'], 'Ăn uống')).toBe(0);
  expect(categoryExpense(data.tx['2026-01'], 'Đi lại')).toBe(5);
  expect(JSON.parse(client.exportBackup()).data.tx['2026-01'][0]).toMatchObject({ id: 't', category: 'Đi lại', extra: 42 });
});
it('thêm giao dịch với danh mục do người dùng chọn', async () => {
  const { client } = await setup();
  const data = await client.addCashEntry({ ...entry, category: 'Sức khoẻ' });
  expect(categoryExpense(data.tx['2026-01'], 'Sức khoẻ')).toBe(5);
  expect(data.tx['2026-01']).toHaveLength(2);
});
it('danh mục sai không gửi PATCH và không thay bản chụp', async () => {
  const { client, request } = await setup();
  for (const category of ['', '__proto__', 'Không tồn tại']) await expect(client.addCashEntry({ ...entry, category }, undefined, 't')).rejects.toThrow('danh mục');
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(client.exportBackup()).data.tx).toEqual(payload.tx);
});
it.each([{ debt: 'd' }, { row: 'r' }])('chặn giao dịch thông thường mang liên kết %j', async links => {
  const { client, request } = await setup('expense', false, links);
  await expect(client.addCashEntry(entry, undefined, 't')).rejects.toThrow('liên kết');
  await expect(client.removeCashEntry('t')).rejects.toThrow('liên kết');
  expect(request).toHaveBeenCalledTimes(2);
});