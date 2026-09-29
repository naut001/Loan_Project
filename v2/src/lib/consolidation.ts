import type { Debt } from './debt';
import { remaining, rowDue } from './debt';
import { calculateLoan, loanSchedule, type LoanInput } from './loan';

const safe = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1e12;
const month = (k: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(k);

// Compare only the selected debts. Like v1.3 payoffOf/remainingOf, a custom debt
// uses principal for payoff when supplied; its remaining schedule includes interest.
export function compareConsolidation(input: LoanInput, debts: Debt[], today = new Date()) {
  const result = calculateLoan(input);
  const newInterest = result.totalInterest, newPayment = result.payment;
  if (!Number.isFinite(today.getTime()) || !debts.length || new Set(debts.map(d => d.id)).size !== debts.length || !Number.isSafeInteger(newInterest)) throw new Error('Không đủ dữ liệu để so sánh gộp nợ.');
  let payoff = 0, oldMonthly = 0, oldCost = 0, oldFee = 0;
  let costKnown = true;
  for (const d of debts) {
    if (!safe(d.balance) || d.balance === 0 || !safe(d.payment)) throw new Error('Số dư khoản nợ chưa hợp lệ để so sánh.');
    const raw = d;
    if (raw.prepay !== undefined && (typeof raw.prepay !== 'number' || !Number.isFinite(raw.prepay) || raw.prepay < 0 || raw.prepay > 100)) throw new Error('Phí tất toán nợ cũ chưa hợp lệ.');
    let due = d.balance, monthly = d.payment, cost = 0;
    if (d.mode === 'custom') {
      if (!Array.isArray(d.sched) || !d.sched.every(r => r && typeof r.k === 'string' && month(r.k) && safe(r.a) && (r.settled === undefined || safe(r.settled) && r.settled <= r.a) && (r.p === undefined || r.p === 0 || typeof r.p === 'string')) || d.sched.reduce((s, r) => s + remaining(r), 0) !== d.balance) throw new Error('Lịch nợ nhập tay không khớp số dư.');
      if (raw.principal !== undefined && (!safe(raw.principal) || raw.principal > d.balance)) throw new Error('Gốc còn lại chưa hợp lệ.');
      due = raw.principal && raw.principal > 0 ? raw.principal : d.balance;
      costKnown &&= !!raw.principal;
      cost = raw.principal ? d.balance - raw.principal : 0;
      const current = d.sched.filter(r => { const date = rowDue(d, r.k); return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth(); });
      monthly = current.length ? current.reduce((sum, r) => sum + r.a, 0) : d.payment;
    } else if (d.mode === 'formula') {
      if (!safe(d.payment) || d.payment === 0 || (d.rate !== undefined && (typeof d.rate !== 'number' || !Number.isFinite(d.rate) || d.rate < 0 || d.rate > 100))) throw new Error('Lãi suất hoặc mức trả nợ công thức chưa hợp lệ.');
      cost = loanSchedule(d.balance, (d.rate ?? 0) / 1200, d.payment).totalInterest;
    } else throw new Error('Loại nợ chưa hợp lệ.');
    payoff += due; oldMonthly += monthly; oldCost += cost; oldFee += due * (raw.prepay ?? 0) / 100;
  }
  const needed = payoff + oldFee;
  const shortfall = needed - (input.amount - input.upfront);
  const newCost = newInterest + input.upfront + oldFee;
  if (![payoff, oldMonthly, oldCost, oldFee, needed, shortfall, newCost].every(Number.isFinite)) throw new Error('Số liệu gộp nợ vượt giới hạn tính toán.');
  return { payoff, oldMonthly, oldCost: costKnown ? oldCost : null, oldFee, needed, shortfall, newMonthly: newPayment, newCost, saving: costKnown && shortfall <= 0 ? oldCost - newCost : null };
}