import { describe, expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';

const session = { access_token: 'test-token', user: { id: 'user-1', email: 'test@example.com' } };
const payload = { v: 1, wallets: [], tx: {}, debts: [] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
describe('Supabase chỉ đọc', () => {
  it('đăng nhập và chỉ GET đúng tài khoản, không ghi payload', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response([{ payload }]));
    const cloud = createCloudClient('https://test.supabase.co/', 'public-key', fetcher);
    expect(await cloud.signIn('test@example.com', 'password')).toBe('test@example.com');
    expect(await cloud.load()).toEqual({ wallets: [], tx: {}, debts: [] });
    expect(fetcher.mock.calls[1][0]).toContain('user_id=eq.user-1');
    expect(fetcher.mock.calls[1][1]?.method).toBe('GET');
    expect(fetcher.mock.calls[1][1]?.body).toBeUndefined();
    expect(fetcher.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer test-token' });
    cloud.disconnect(); await expect(cloud.load()).rejects.toThrow('đăng nhập');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('không tạo dữ liệu khi tài khoản trống', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response([]));
    const cloud = createCloudClient('https://test.supabase.co', 'key', fetcher);
    await cloud.signIn('a', 'b'); expect(await cloud.load()).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('báo lỗi đăng nhập mà không lộ phản hồi nhạy cảm', async () => {
    const cloud = createCloudClient('https://test.supabase.co', 'key', vi.fn<typeof fetch>().mockResolvedValue(response({ error: 'private detail' }, 400)));
    await expect(cloud.signIn('a', 'b')).rejects.toThrow('Kiểm tra email');
    await expect(cloud.load()).rejects.toThrow('đăng nhập');
  });
  it('hết phiên thì chặn lần đọc tiếp theo', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response({}, 401));
    const cloud = createCloudClient('https://test.supabase.co', 'key', fetcher);
    await cloud.signIn('a', 'b'); await expect(cloud.load()).rejects.toThrow('Phiên đăng nhập');
    await expect(cloud.load()).rejects.toThrow('Hãy đăng nhập'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('lỗi mạng cho phép thử lại trong cùng phiên', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(session)).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response([]));
    const cloud = createCloudClient('https://test.supabase.co', 'key', fetcher);
    await cloud.signIn('a', 'b'); await expect(cloud.load()).rejects.toThrow('Kiểm tra mạng'); expect(await cloud.load()).toBeNull();
  });
  it('không nhận kết quả cũ sau khi đóng kết nối', async () => {
    let finish!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(session)).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const cloud = createCloudClient('https://test.supabase.co', 'key', fetcher);
    await cloud.signIn('a', 'b'); const loading = cloud.load(); cloud.disconnect(); finish(response([{ payload }]));
    await expect(loading).rejects.toThrow('huỷ');
  });
  it('từ chối payload hỏng', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response([{ payload: {} }]));
    const cloud = createCloudClient('https://test.supabase.co', 'key', fetcher);
    await cloud.signIn('a', 'b'); await expect(cloud.load()).rejects.toThrow('bản sao lưu');
  });
});