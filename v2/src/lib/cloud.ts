import { parseSnapshot, type Snapshot } from './snapshot';
import { localDate } from './format';

export class CloudError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}
interface Session { access_token: string; user: { id: string; email?: string } }
export interface CashEntry { type: 'income' | 'expense'; wallet: string; amount: number; date: string; note: string }
const validTimestamp = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function createCloudClient(url: string, key: string, request: typeof fetch = fetch) {
  let session: Session | null = null;
  let loaded: { payload: Record<string, unknown>; revision: string } | null = null;
  let saving = false;
  let generation = 0;
  let loadAttempt = 0;
  const base = url.trim().replace(/\/$/, '');
  async function call(path: string, init: RequestInit, signal?: AbortSignal) {
    const requestGeneration = generation;
    let response: Response;
    try {
      response = await request(base + path, { ...init, signal, headers: { apikey: key.trim(), 'Content-Type': 'application/json', ...init.headers } });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new CloudError('Không kết nối được Supabase. Kiểm tra mạng rồi thử lại.');
    }
    if (!response.ok) {
      if (requestGeneration === generation && (response.status === 401 || response.status === 403)) { session = null; loaded = null; }
      const loginError = path.startsWith('/auth/') && response.status === 400;
      throw new CloudError(loginError ? 'Không đăng nhập được. Kiểm tra email, mật khẩu và xác nhận email.' : response.status === 401 || response.status === 403 ? 'Phiên đăng nhập không hợp lệ hoặc không có quyền truy cập. Hãy đăng nhập lại.' : response.status === 429 ? 'Thử quá nhiều lần. Vui lòng đợi rồi thử lại.' : `Yêu cầu dữ liệu thất bại (HTTP ${response.status}).`, response.status);
    }
    try { return await response.json(); }
    catch { throw new CloudError('Phản hồi Supabase không hợp lệ.'); }
  }
  return {
    async signIn(email: string, password: string, signal?: AbortSignal) {
      const attempt = ++generation;
      session = null; loaded = null;
      const data = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }, signal);
      if (!data || typeof data.access_token !== 'string' || typeof data.user?.id !== 'string') throw new CloudError('Phiên đăng nhập không hợp lệ.');
      if (signal?.aborted || attempt !== generation) throw new CloudError('Đã huỷ đăng nhập.');
      session = data as Session;
      return session.user.email || email.trim();
    },
    async load(signal?: AbortSignal): Promise<Snapshot | null> {
      const current = session;
      if (!current) throw new CloudError('Hãy đăng nhập để tải dữ liệu.', 401);
      if (saving) throw new CloudError('Đang lưu giao dịch. Vui lòng đợi.');
      const attempt = ++loadAttempt;
      loaded = null;
      const rows = await call(`/rest/v1/user_data?user_id=eq.${encodeURIComponent(current.user.id)}&select=payload,updated_at&limit=1`, { method: 'GET', headers: { Authorization: `Bearer ${current.access_token}` } }, signal);
      if (signal?.aborted || session !== current || attempt !== loadAttempt) throw new CloudError('Phiên tải đã bị huỷ.');
      if (!Array.isArray(rows)) throw new CloudError('Dữ liệu tài khoản không hợp lệ.');
      // Never create a cloud row when the account is empty.
      if (!rows.length) return null;
      const snapshot = parseSnapshot(JSON.stringify(rows[0].payload));
      if (validTimestamp(rows[0]?.updated_at)) {
        loaded = { payload: structuredClone(rows[0].payload), revision: rows[0].updated_at };
      }
      return snapshot;
    },
    canSave() { return !!session && !!loaded && !saving; },
    exportBackup() {
      if (!session || !loaded || saving) throw new CloudError('Hãy tải lại dữ liệu trước khi xuất sao lưu.');
      return JSON.stringify({ app: 'so-tra-no', version: '2.0.0-preview', exportedAt: new Date().toISOString(), data: loaded.payload }, null, 2);
    },
    async addCashEntry(entry: CashEntry, signal?: AbortSignal): Promise<Snapshot> {
      const current = session, baseline = loaded;
      if (!current || !baseline || saving) throw new CloudError('Hãy tải lại dữ liệu tài khoản trước khi lưu.');
      const snapshot = parseSnapshot(JSON.stringify(baseline.payload));
      const wallet = snapshot.wallets.find(w => w.id === entry.wallet);
      const today = localDate();
      if (!wallet || !['income', 'expense'].includes(entry.type) || !Number.isSafeInteger(entry.amount) || entry.amount <= 0 || entry.amount > 1e12 || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(Date.parse(entry.date)) || new Date(entry.date).toISOString().slice(0, 10) !== entry.date || entry.date > today || entry.note.length > 200) throw new CloudError('Kiểm tra số tiền, tài khoản, ngày và ghi chú (tối đa 200 ký tự).');
      const openingDate = (wallet as unknown as { openingDate?: string }).openingDate;
      if (openingDate && entry.date < openingDate) throw new CloudError('Ngày giao dịch phải từ mốc số dư đầu kỳ của tài khoản.');
      const payload = structuredClone(baseline.payload);
      const tx = payload.tx as Record<string, unknown[]>;
      const month = entry.date.slice(0, 7);
      (tx[month] ||= []).push({ ...entry, note: entry.note.trim(), id: crypto.randomUUID(), to: '', category: entry.type === 'income' ? 'Lương' : 'Khác' });
      const previousTime = Number(payload.updatedAt || 0);
      if (!Number.isSafeInteger(previousTime) || previousTime < 0 || previousTime >= Number.MAX_SAFE_INTEGER) throw new CloudError('Mốc cập nhật dữ liệu không hợp lệ. Hãy kiểm tra bản sao lưu.');
      payload.updatedAt = Math.max(Date.now(), previousTime + 1);
      parseSnapshot(JSON.stringify(payload));
      if (new TextEncoder().encode(JSON.stringify(payload)).length > 950000) throw new CloudError('Dữ liệu gần giới hạn lưu trữ. Hãy xuất sao lưu và kiểm tra trước khi thêm.');
      saving = true;
      try {
        const rows = await call(`/rest/v1/user_data?user_id=eq.${encodeURIComponent(current.user.id)}&updated_at=eq.${encodeURIComponent(baseline.revision)}&select=payload,updated_at`, { method: 'PATCH', headers: { Authorization: `Bearer ${current.access_token}`, Prefer: 'return=representation' }, body: JSON.stringify({ payload }) }, signal);
        if (signal?.aborted || session !== current) throw new CloudError('Kết nối đã đóng. Tải lại để kiểm tra giao dịch đã lưu hay chưa.');
        if (!Array.isArray(rows) || rows.length !== 1) throw new CloudError('Dữ liệu đã thay đổi trên thiết bị khác hoặc không có quyền lưu. Hãy tải lại và kiểm tra trước khi nhập lại.', 409);
        const result = parseSnapshot(JSON.stringify(rows[0].payload));
        loaded = validTimestamp(rows[0]?.updated_at) && rows[0].updated_at !== baseline.revision ? { payload: structuredClone(rows[0].payload), revision: rows[0].updated_at } : null;
        return result;
      } catch (error) {
        // A timeout may occur after commit: force a fresh read instead of retrying the write.
        if (session === current) loaded = null;
        throw error;
      } finally { saving = false; }
    },
    disconnect() { ++generation; session = null; loaded = null; },
  };
}