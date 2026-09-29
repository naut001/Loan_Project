import { parseSnapshot, type Receivable } from './snapshot';

export type ReceivableDetails = Pick<Receivable, 'name' | 'amount' | 'got' | 'kind' | 'due' | 'startK' | 'day' | 'per' | 'inc' | 'note'>;
const money = (n: unknown) => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 1e12;
const date = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const month = (s: unknown) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function validReceivables(value: unknown): value is Receivable[] {
  return Array.isArray(value) && value.every(r => r && typeof r === 'object' && !Array.isArray(r) && typeof r.id === 'string' && r.id && typeof r.name === 'string' && r.name.trim().length > 0 && r.name.length <= 80 && money(r.amount) && r.amount > 0 && money(r.got) && r.got <= r.amount && ['once', 'plan'].includes(r.kind) && typeof r.due === 'string' && (!r.due || date(r.due)) && typeof r.startK === 'string' && (!r.startK || month(r.startK)) && Number.isInteger(r.day) && r.day >= 1 && r.day <= 31 && money(r.per) && (r.kind !== 'plan' || (month(r.startK) && r.per > 0)) && typeof r.inc === 'boolean' && typeof r.note === 'string' && r.note.length <= 200 && Array.isArray(r.log) && r.log.length <= 40 && r.log.every((l: { d: unknown; a: unknown }) => l && date(l.d) && money(l.a) && (l.a as number) > 0) && r.log.reduce((sum: number, l: { a: number }) => sum + l.a, 0) <= r.got) && new Set(value.map(r => r.id)).size === value.length;
}

function list(payload: Record<string, unknown>): Receivable[] {
  parseSnapshot(JSON.stringify(payload));
  if (payload.recv === undefined) return [];
  if (!validReceivables(payload.recv)) throw new Error('Lịch sử phải thu không hợp lệ. Xuất sao lưu và đối chiếu trong bản 1.3 trước khi sửa.');
  return payload.recv as Receivable[];
}

export function editReceivable(payload: Record<string, unknown>, values: ReceivableDetails | undefined, id?: string) {
  const recv = list(payload);
  const old = id === undefined ? undefined : recv.find(r => r.id === id);
  if (id !== undefined && !old) throw new Error('Khoản phải thu không còn tồn tại. Tải lại dữ liệu.');
  if (!values) {
    if (!old || old.got || old.log.length) throw new Error('Không xoá khoản đã có lịch sử thu.');
    payload.recv = recv.filter(r => r.id !== id);
    return;
  }
  if (typeof values.name !== 'string' || !values.name.trim() || values.name.trim().length > 80 || !money(values.amount) || values.amount === 0 || !money(values.got) || values.got > values.amount || !['once', 'plan'].includes(values.kind) || typeof values.note !== 'string' || values.note.length > 200 || typeof values.inc !== 'boolean' || typeof values.due !== 'string' || (values.due !== '' && !date(values.due)) || typeof values.startK !== 'string' || (values.startK !== '' && !month(values.startK)) || !Number.isInteger(values.day) || values.day < 1 || values.day > 31 || !money(values.per) || (values.kind === 'plan' && (!month(values.startK) || values.per === 0))) throw new Error('Kiểm tra tên, số tiền, hạn thu và lịch thu.');
  if (old && (values.got !== old.got || values.amount < old.got)) throw new Error('Đã thu chỉ thay đổi qua ghi nhận hoặc hoàn tác; không sửa trực tiếp.');
  // Whitelist editable fields: never let a forged form value replace IDs, logs or extensions.
  const details = { name: values.name.trim(), amount: values.amount, got: values.got, kind: values.kind,
    due: values.kind === 'once' ? values.due : '', startK: values.startK, day: values.day,
    per: values.kind === 'plan' ? values.per : 0, inc: values.inc, note: values.note.trim() };
  if (old) Object.assign(old, details);
  else recv.push({ id: crypto.randomUUID(), log: [], ...details });
  payload.recv = recv;
}

export function collectReceivable(payload: Record<string, unknown>, id: string, amount: number, today: string) {
  const r = list(payload).find(r => r.id === id);
  if (!r) throw new Error('Khoản phải thu không còn tồn tại.');
  if (!money(amount) || amount === 0 || amount > r.amount - r.got || !date(today)) throw new Error('Số tiền thu hoặc ngày thu không hợp lệ.');
  r.got += amount;
  r.log.push({ d: today, a: amount });
  r.log = r.log.slice(-40);
}

export function undoReceivable(payload: Record<string, unknown>, id: string) {
  const r = list(payload).find(r => r.id === id);
  if (!r || !r.log.length) throw new Error('Không có lần thu nào để hoàn tác.');
  const last = r.log[r.log.length - 1];
  if (last.a > r.got) throw new Error('Lịch sử thu không khớp số đã thu.');
  r.got -= last.a;
  r.log.pop();
}