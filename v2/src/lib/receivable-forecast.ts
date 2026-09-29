import type { Receivable } from './snapshot';

export interface ReceivableInfo {
  out: number; next: Date | null; nextAmt: number; late: number; lateSince: Date | null; lateDays: number;
}

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
const dueDate = (year: number, month: number, day: number) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
const monthStart = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  const result = new Date(0);
  result.setHours(0, 0, 0, 0);
  result.setFullYear(year, month - 1, 1);
  return result;
};

// Port of v1.3's recvInfo and recvArray: never mutates imported records or wallet transactions.
export function receivableInfo(r: Receivable, today: Date): ReceivableInfo {
  const out = Math.max(0, (r.amount || 0) - (r.got || 0));
  const info: ReceivableInfo = { out, next: null, nextAmt: 0, late: 0, lateSince: null, lateDays: 0 };
  if (out <= 0) return info;
  const t = midnight(today), got = r.got || 0;
  if (r.kind === 'plan' && r.per > 0 && r.startK) {
    const day = r.day || 1, k = monthStart(r.startK);
    let cumDue = 0;
    for (let m = 0; m < 600; m++) {
      const dt = dueDate(k.getFullYear(), k.getMonth() + m, day);
      const cum = Math.min(r.amount, (m + 1) * r.per);
      if (dt < t) { cumDue = cum; if (!info.lateSince && cum > got) info.lateSince = dt; }
      else { info.next = dt; break; }
      if (cum >= r.amount) break;
    }
    info.late = Math.max(0, cumDue - got);
    if (info.late <= 0) info.lateSince = null;
    info.nextAmt = info.late > 0 ? info.late : Math.min(r.per, out);
  } else if (r.due) {
    const dd = monthStart(r.due.slice(0, 7));
    dd.setDate(Number(r.due.slice(8, 10)));
    if (dd < t) { info.late = out; info.lateSince = dd; }
    else info.next = dd;
    info.nextAmt = out;
  }
  if (info.lateSince) info.lateDays = Math.round((t.getTime() - info.lateSince.getTime()) / 86400000);
  return info;
}

export function receivableArray(r: Receivable, months: number, today: Date): number[] {
  const result = Array(months).fill(0) as number[];
  const info = receivableInfo(r, today);
  if (!info.out || !months) return result;
  const base = monthIndex(today), t = midnight(today);
  let rem = info.out;
  if (info.late > 0) { const amount = Math.min(info.late, rem); result[0] += amount; rem -= amount; }
  if (rem <= 0) return result;
  if (r.kind === 'plan' && r.per > 0 && r.startK) {
    const k = monthStart(r.startK);
    for (let m = 0; m < 600 && rem > 0; m++) {
      const dt = dueDate(k.getFullYear(), k.getMonth() + m, r.day || 1);
      if (dt < t) continue;
      const off = monthIndex(dt) - base;
      if (off >= months) break;
      const amount = Math.min(r.per, rem);
      result[off] += amount; rem -= amount;
    }
  } else if (info.next) {
    const off = Math.max(0, monthIndex(info.next) - base);
    if (off < months) result[off] += rem;
  }
  return result;
}

export function receivableForecast(recv: Receivable[], months: number, today: Date) {
  const result = Array(months).fill(0) as number[];
  recv.filter(r => r.inc !== false).forEach(r => receivableArray(r, months, today).forEach((a, index) => { result[index] += a; }));
  return result;
}