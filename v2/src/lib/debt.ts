export interface ScheduleRow { id?: string; k: string; a: number; p?: string | 0; settled?: number }
export interface Debt {
  id: string; name: string; kind?: string; mode: 'custom' | 'formula'; balance: number;
  payment: number; dueDay: number; stmtDay: number; dueMode: 'day' | 'after'; grace: number;
  rate?: number; prepay?: number; principal?: number; paid?: Record<string, unknown>;
  sched?: ScheduleRow[];
}
export const remaining = (row: ScheduleRow) => row.p ? 0 : Math.max(0, row.a - (row.settled || 0));
const dayAt = (year: number, month: number, day: number) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));

// Same statement-period semantics as rowDue in 1.3; parity tests guard this boundary.
export function rowDue(debt: Debt, key: string): Date {
  const [year, month] = key.split('-').map(Number);
  if (debt.stmtDay > 0) {
    const statement = dayAt(year, month - 1, debt.stmtDay);
    if (debt.dueMode === 'after' && debt.grace > 0) {
      return new Date(statement.getFullYear(), statement.getMonth(), statement.getDate() + debt.grace);
    }
    let due = dayAt(year, month - 1, debt.dueDay || debt.stmtDay);
    if (due <= statement) due = dayAt(year, month, debt.dueDay || debt.stmtDay);
    return due;
  }
  return dayAt(year, month - 1, debt.dueDay || 1);
}

export function debtRows(debt: Debt, today: Date) {
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (debt.sched || []).map((row, index) => {
    const left = remaining(row), due = rowDue(debt, row.k);
    const status = !left ? 'Đã trả' : due < ref ? 'Quá hạn' : row.settled ? 'Trả một phần' : 'Chưa trả';
    return { ...row, index, left, due, status };
  }).sort((a, b) => a.due.getTime() - b.due.getTime() || a.index - b.index);
}