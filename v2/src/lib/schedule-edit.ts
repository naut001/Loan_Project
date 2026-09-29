import { parseSnapshot } from './snapshot';
import { recalculate } from './payment';

export interface ScheduleEdit { debt: string; index?: number; values?: { month: string; amount: number } }

export function editSchedule(payload: Record<string, unknown>, entry: ScheduleEdit) {
  const data = parseSnapshot(JSON.stringify(payload));
  const debt = data.debts.find(d => d.id === entry.debt);
  if (!debt || debt.mode !== 'custom' || !debt.sched) throw new Error('Chọn khoản nợ theo tháng.');
  const rows = debt.sched;
  const ids = rows.filter(r => r.id !== undefined).map(r => r.id);
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length || rows.some(r => !Number.isSafeInteger(r.a) || !Number.isSafeInteger(r.settled ?? 0))) throw new Error('Lịch nợ có mã hoặc số tiền không hợp lệ. Kiểm tra sao lưu.');
  const links = Object.values(data.tx).flat().filter(t => t.debt === debt.id);
  if (links.some(t => !t.row || rows.filter(r => r.id === t.row).length !== 1)) throw new Error('Liên kết kỳ nợ bị thiếu. Kiểm tra sao lưu trước khi sửa lịch.');
  const row = entry.index === undefined ? undefined : rows[entry.index];
  if (entry.index !== undefined && (!Number.isInteger(entry.index) || entry.index < 0 || !row)) throw new Error('Kỳ nợ không còn tồn tại.');
  if (row && (row.p || row.settled || links.some(t => t.row === row.id))) throw new Error('Không sửa hoặc xoá kỳ đã trả hay có giao dịch liên kết.');
  if (entry.values) {
    const { month, amount } = entry.values;
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1e12) throw new Error('Nhập tháng và số tiền nguyên từ 1 đến 1.000 tỷ đồng.');
    if (row) Object.assign(row, { k: month, a: amount });
    else rows.push({ id: crypto.randomUUID(), k: month, a: amount, p: 0 });
  } else {
    if (entry.index === undefined) throw new Error('Chọn kỳ cần xoá.');
    rows.splice(entry.index, 1);
  }
  if (!Number.isSafeInteger(rows.reduce((sum, r) => sum + r.a, 0))) throw new Error('Tổng lịch vượt giới hạn số tiền an toàn.');
  recalculate(debt);
  payload.debts = data.debts;
}