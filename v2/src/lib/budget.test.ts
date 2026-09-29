import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';
import { categoryExpense } from './budget';
import { parseSnapshot } from './snapshot';

const payload = { v: 1, updatedAt: 1, wallets: [], debts: [], tx: {}, budgets: { '2026-01': { 'Ăn uống': 100, 'Khác': 50 }, '2026-02': { 'Khác': 30 } }, recv: [{ id: 'r' }] };
const reply = (value: unknown) => new Response(JSON.stringify(value));
async function setup(conflict = false) {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockImplementationOnce(async (_url, options) => reply(conflict ? [] : [{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-02T00:00:00Z' }]));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  return { client, request };
}
it('chỉ thay hạn mức đã chọn, giữ các tháng và dữ liệu khác', async () => {
  const { client, request } = await setup();
  const result = await client.putBudget('2026-01', 'Ăn uống', 200);
  expect(result.budgets).toEqual({ ...payload.budgets, '2026-01': { 'Ăn uống': 200, 'Khác': 50 } });
  expect(JSON.parse(client.exportBackup()).data.recv).toEqual(payload.recv);
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
});
it('hạn mức 0 bỏ danh mục và tháng rỗng', async () => {
  const { client } = await setup();
  const result = await client.putBudget('2026-02', 'Khác', 0);
  expect(result.budgets).toEqual({ '2026-01': payload.budgets['2026-01'] });
});
it('chặn đầu vào sai trước request và không đổi bản gốc', async () => {
  const { client, request } = await setup();
  for (const amount of [-1, 0.1, NaN, Infinity, 1e12 + 1]) await expect(client.putBudget('2026-01', 'Khác', amount)).rejects.toThrow();
  await expect(client.putBudget('2026-13', 'Khác', 10)).rejects.toThrow();
  await expect(client.putBudget('2026-01', '__proto__', 10)).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
  expect(JSON.parse(client.exportBackup()).data).toEqual(payload);
});
it('xung đột ngân sách khoá ghi', async () => {
  const { client, request } = await setup(true);
  await expect(client.putBudget('2026-01', 'Khác', 10)).rejects.toThrow('đã thay đổi');
  await expect(client.putBudget('2026-01', 'Khác', 10)).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3);
});
it('chi theo danh mục không đếm gốc trả nợ, thu nhập hoặc chuyển ví', () => {
  const rows = (['expense', 'credit', 'income', 'transfer', 'repayment'] as const).map((type, i) => ({ id: String(i), type, wallet: '', amount: 100, date: '2026-01-01', category: 'Khác', interest: 10, fee: 5 }));
  expect(categoryExpense(rows, 'Khác')).toBe(200);
  expect(categoryExpense(rows, 'Trả nợ')).toBe(15);
  expect(categoryExpense(rows, 'Ăn uống')).toBe(0);
});
it('từ chối ngân sách hỏng thay vì âm thầm ghi đè', () => {
  for (const budgets of [null, [], { '2026-13': {} }, { '2026-01': { 'Khác': -1 } }]) expect(() => parseSnapshot(JSON.stringify({ ...payload, budgets }))).toThrow('Ngân sách');
});