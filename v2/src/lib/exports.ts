import type { Snapshot } from './snapshot';
import { remaining, rowDue } from './debt';
import { formulaForecast } from './formula-forecast';

const csvLabels = { expense: 'Chi', income: 'Thu', transfer: 'Chuyển ví', repayment: 'Trả nợ liên kết', credit: 'Mua bằng tín dụng' };
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function transactionsCSV(month: string, data: Snapshot): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Tháng xuất CSV không hợp lệ.');
  const name = (id: string) => data.wallets.find(w => w.id === id)?.name || id;
  const rows: unknown[][] = [['Ngày', 'Loại', 'Số tiền (đ)', 'Ví', 'Ví nhận', 'Danh mục', 'Ghi chú', 'Khoản nợ', 'Mã kỳ', 'Lãi ngoài lịch', 'Phí ngoài lịch']];
  for (const t of (data.tx[month] || []).slice().sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))) {
    rows.push([t.date, csvLabels[t.type], t.amount, t.wallet ? name(t.wallet) : '', t.to ? name(t.to) : '', t.type === 'transfer' ? '' : t.category, t.note, t.debt || '', t.row || '', t.interest || 0, t.fee || 0]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function foldICS(line: string): string {
  let output = '', part = '', bytes = 0;
  const encoder = new TextEncoder();
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { output += part + '\r\n'; part = ' '; bytes = 1; }
    part += char; bytes += size;
  }
  return output + part;
}

// Preserve the narrower custom-only export for callers requiring explicit schedules.
export function customDebtCalendar(data: Snapshot, today = new Date()): string {
  return debtCalendar({ ...data, debts: data.debts.filter(d => d.mode === 'custom') }, today);
}

export function debtCalendar(data: Snapshot, today = new Date()): string {
  if (!Number.isFinite(today.getTime())) throw new Error('Ngày xuất lịch không hợp lệ.');
  const last = today.getFullYear() * 12 + today.getMonth() + 12;
  const stamp = today.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SoTraNo//Debt reminders//VI', 'CALSCALE:GREGORIAN'];
  for (const debt of data.debts) {
    if (debt.mode === 'formula' && debt.balance === 0) continue;
    const groups = new Map<string, number>();
    for (const row of debt.sched || []) {
      const left = remaining(row);
      if (left > 0) groups.set(row.k, (groups.get(row.k) || 0) + left);
    }
    const rows = debt.mode === 'custom'
      ? [...groups].map(([key, amount]) => ({ key, amount, due: rowDue(debt, key) }))
      : formulaForecast(debt, today).filter(r => r.due.getFullYear() * 12 + r.due.getMonth() < last).map(r => ({ key: r.key, amount: r.pay, due: r.due }));
    for (const { key, amount, due } of rows) {
      if (due.getFullYear() * 12 + due.getMonth() >= last) continue;
      const next = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1);
      lines.push('BEGIN:VEVENT', 'UID:' + icsText(debt.id + '-' + key + '@so-tra-no'), 'DTSTAMP:' + stamp,
        'DTSTART;VALUE=DATE:' + dateKey(due).replace(/-/g, ''), 'DTEND;VALUE=DATE:' + dateKey(next).replace(/-/g, ''),
        'SUMMARY:' + icsText('Trả ' + debt.name),
        'DESCRIPTION:' + icsText('Dự kiến ' + Math.round(amount).toLocaleString('vi-VN') + ' đ. Kiểm tra số tiền và hạn chính thức trên sao kê. Lịch xuất không tự cập nhật.'),
        'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText('Nhắc trả ' + debt.name), 'END:VALARM', 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldICS).join('\r\n') + '\r\n';
}