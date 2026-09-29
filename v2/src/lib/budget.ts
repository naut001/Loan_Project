import type { Transaction } from './snapshot';

export const categories = ['Ăn uống', 'Đi lại', 'Nhà ở', 'Mua sắm', 'Sức khoẻ', 'Học tập', 'Giải trí', 'Trả nợ', 'Lương', 'Khác'];
export function categoryExpense(rows: Transaction[], category: string) {
  return rows.reduce((sum, t) => sum + (t.type === 'repayment' ? (category === 'Trả nợ' ? (t.interest || 0) + (t.fee || 0) : 0) : (t.type === 'expense' || t.type === 'credit') && (t.category || 'Khác') === category ? t.amount : 0), 0);
}