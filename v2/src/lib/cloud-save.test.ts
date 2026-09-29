import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';
const payload = { v: 1, wallets: [{ id: 'cash', name: 'Tiền mặt', opening: 10, openingDate: '2026-01-01' }], debts: [], tx: {}, recv: [{ name: 'Giữ nguyên' }], plan: { living: 55 }, fund: { saved: 25 }, updatedAt: 1 };
const session = { access_token: 'token', user: { id: 'u' } };
const reply = (x: unknown) => new Response(JSON.stringify(x));
const entry = { type: 'expense' as const, wallet: 'cash', amount: 5, date: '2026-01-02', note: 'Kiểm thử' };
it('PATCH có điều kiện revision, giữ nguyên toàn bộ trường không hiển thị', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(session)).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockImplementationOnce(async (_url, options) => reply([{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-01-02T00:00:00Z' }]));
  const cloud = createCloudClient('https://test.supabase.co', 'key', request);
  await cloud.signIn('a', 'b'); await cloud.load(); await cloud.addCashEntry(entry);
  const backup = JSON.parse(cloud.exportBackup());
  expect(backup.app).toBe('so-tra-no'); expect(backup.data.recv).toEqual(payload.recv);
  expect(backup.data.tx['2026-01']).toHaveLength(1);
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
  expect(request.mock.calls[2][1]?.method).toBe('PATCH');
  const saved = JSON.parse(String(request.mock.calls[2][1]?.body)).payload;
  expect(saved.plan).toEqual(payload.plan); expect(saved.recv).toEqual(payload.recv); expect(saved.fund).toEqual(payload.fund);
  expect(saved.tx['2026-01']).toHaveLength(1); expect(cloud.canSave()).toBe(true);
});
it('xung đột khoá ghi cho đến khi tải lại, không tự retry', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(session)).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockResolvedValueOnce(reply([]));
  const cloud = createCloudClient('https://test.supabase.co', 'key', request);
  await cloud.signIn('a', 'b'); await cloud.load(); await expect(cloud.addCashEntry(entry)).rejects.toThrow('đã thay đổi');
  expect(cloud.canSave()).toBe(false); await expect(cloud.addCashEntry(entry)).rejects.toThrow('tải lại'); expect(request).toHaveBeenCalledTimes(3);
});
it('mất mạng khi lưu khoá ghi, ngày trước mốc bị chặn trước request', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(session)).mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockRejectedValueOnce(new Error('offline'));
  const cloud = createCloudClient('https://test.supabase.co', 'key', request);
  await cloud.signIn('a', 'b'); await cloud.load(); await expect(cloud.addCashEntry({ ...entry, date: '2025-12-31' })).rejects.toThrow('đầu kỳ');
  expect(request).toHaveBeenCalledTimes(2); await expect(cloud.addCashEntry(entry)).rejects.toThrow('Kiểm tra mạng'); expect(cloud.canSave()).toBe(false);
  expect(() => cloud.exportBackup()).toThrow('tải lại');
});
it('đóng kết nối trong khi đăng nhập không phục hồi phiên từ response cũ', async () => {
  let finish!: (value: Response) => void;
  const request = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const cloud = createCloudClient('https://test.supabase.co', 'key', request);
  const login = cloud.signIn('a', 'b'); cloud.disconnect(); finish(reply(session));
  await expect(login).rejects.toThrow('huỷ'); await expect(cloud.load()).rejects.toThrow('đăng nhập');
});
it('trigger không tăng timestamp thì khoá lần ghi tiếp theo', async () => {
  const row = { payload, updated_at: '2026-01-01T00:00:00Z' };
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(session)).mockResolvedValueOnce(reply([row])).mockResolvedValueOnce(reply([row]));
  const cloud = createCloudClient('https://test.supabase.co', 'key', request);
  await cloud.signIn('a', 'b'); await cloud.load(); await cloud.addCashEntry(entry);
  expect(cloud.canSave()).toBe(false);
});
it('response 401 cũ không xoá phiên đăng nhập mới', async () => {
  let finish!: (value: Response) => void;
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(reply(session))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(reply(session))
    .mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }]));
  const cloud = createCloudClient('https://test.supabase.co', 'key', request);
  await cloud.signIn('a', 'b');
  const oldLoad = cloud.load();
  cloud.disconnect(); await cloud.signIn('a', 'b');
  finish(new Response('{}', { status: 401 }));
  await expect(oldLoad).rejects.toThrow('Phiên đăng nhập');
  await cloud.load(); expect(cloud.canSave()).toBe(true);
});
it('kết quả tải cũ không thay thế bản chụp từ lần tải mới nhất', async () => {
  let finish!: (value: Response) => void;
  const request = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(reply(session))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-02T00:00:00Z' }]));
  const cloud = createCloudClient('https://test.supabase.co', 'key', request);
  await cloud.signIn('a', 'b');
  const oldLoad = cloud.load(); await cloud.load(); finish(reply([]));
  await expect(oldLoad).rejects.toThrow('huỷ');
  expect(cloud.canSave()).toBe(true); expect(JSON.parse(cloud.exportBackup()).data).toEqual(payload);
});