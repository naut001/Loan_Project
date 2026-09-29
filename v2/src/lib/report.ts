import type { Snapshot } from './snapshot';

// Matches spendSummary in js/spend.js. A past month's totals include its entire month.
export function monthReport(data: Snapshot, month: string, through = '9999-12-31') {
  const result = { income: 0, expense: 0, repayment: 0, net: 0, count: 0, categories: {} as Record<string, number> };
  let nonCash = 0;
  for (const t of data.tx[month] || []) {
    if (t.date > through) continue;
    result.count++;
    if (t.type === 'credit') nonCash += t.amount;
    if (t.type === 'repayment') nonCash += (t.interest || 0) + (t.fee || 0);
    if (t.type === 'transfer') continue;
    if (t.type === 'repayment') {
      result.repayment += t.amount;
      const cost = (t.interest || 0) + (t.fee || 0);
      result.expense += cost;
      result.categories['Trả nợ'] = (result.categories['Trả nợ'] || 0) + cost;
    } else if (t.type === 'income') result.income += t.amount;
    else {
      result.expense += t.amount;
      const category = t.category || 'Khác';
      result.categories[category] = (result.categories[category] || 0) + t.amount;
    }
  }
  result.net = result.income - result.expense - result.repayment + nonCash;
  return result;
}

export function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  const d = new Date(year, number - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}