import type { Snapshot } from './snapshot';

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