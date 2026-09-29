import type { Debt } from './debt';
import { remaining, rowDue } from './debt';
import { formulaForecast } from './formula-forecast';
import { monthlyPayment, loanSchedule } from './loan';
import { validReceivables } from './receivable';
import { receivableArray } from './receivable-forecast';
import type { Snapshot } from './snapshot';
import { calculateLoan, type LoanInput } from './loan';

export interface Plan { cash: { id: string; name: string; a: number }[]; living: number; buffer: number; incomePending: boolean; loans: { id: string; name: string; amount: number; rate: number; months: number; k: string; fee: number; payoff: string[] }[]; buys: { id: string; name: string; a: number; k: string }[] }
export const emptyPlan = (): Plan => ({ cash: [], living: 0, buffer: 0, incomePending: false, loans: [], buys: [] });
export const nextMonth = (today = new Date()) => { const date = new Date(today.getFullYear(), today.getMonth() + 1, 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; };
export type LoanProposal = Pick<LoanInput, 'amount' | 'rate' | 'months' | 'upfront'>;
export function proposeLoan(input: LoanInput): LoanProposal {
  calculateLoan(input);
  if (input.months > 120) throw new Error('Kế hoạch chỉ hỗ trợ kỳ hạn tối đa 120 tháng.');
  return { amount: input.amount, rate: input.rate, months: input.months, upfront: input.upfront };
}
export function appendProposedLoan(plan: Plan, proposal: LoanProposal, id: string, today = new Date()): Plan {
  if (!validPlan(plan) || !ident(id) || plan.loans.some(l => l.id === id)) throw new Error('Kế hoạch hoặc ID khoản vay dự định không hợp lệ.');
  // The calculator's early-payoff percentage belongs to the new loan, not old debts.
  if (!amount(proposal.amount) || proposal.amount === 0 || !Number.isFinite(proposal.rate) || proposal.rate < 0 || proposal.rate > 100 || !Number.isInteger(proposal.months) || proposal.months < 1 || proposal.months > 120 || !amount(proposal.upfront) || proposal.upfront >= proposal.amount) throw new Error('Đề xuất khoản vay không hợp lệ.');
  return { ...plan, loans: [...plan.loans, { id, name: 'Khoản vay dự định', amount: proposal.amount, rate: proposal.rate, months: proposal.months, k: nextMonth(today), fee: proposal.upfront, payoff: [] }] };
}
const amount = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= 1e12;
const month = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);
const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const name = (x: unknown): x is string => typeof x === 'string' && x.length <= 80;
const ident = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= 80;
const unique = (xs: { id: string }[]) => new Set(xs.map(x => x.id)).size === xs.length;
export function validPlan(x: unknown): x is Plan {
  if (!obj(x) || !Array.isArray(x.cash) || !Array.isArray(x.loans) || !Array.isArray(x.buys) || !amount(x.living) || !amount(x.buffer) || typeof x.incomePending !== 'boolean') return false;
  return x.cash.every((c: unknown) => obj(c) && ident(c.id) && name(c.name) && amount(c.a)) && unique(x.cash) && x.buys.every((b: unknown) => obj(b) && ident(b.id) && name(b.name) && amount(b.a) && month(b.k)) && unique(x.buys) && x.loans.every((l: unknown) => obj(l) && ident(l.id) && name(l.name) && amount(l.amount) && typeof l.rate === 'number' && Number.isFinite(l.rate) && l.rate >= 0 && l.rate <= 100 && Number.isInteger(l.months) && (l.months as number) >= 0 && (l.months as number) <= 120 && month(l.k) && amount(l.fee) && (!l.amount || (l.months as number) > 0 && (l.fee as number) <= (l.amount as number)) && Array.isArray(l.payoff) && l.payoff.every(ident)) && unique(x.loans);
}
const index = (d: Date) => d.getFullYear() * 12 + d.getMonth();
export function editPlan(payload: Record<string, unknown>, plan: unknown, income: unknown) {
  if (!validPlan(plan) || !amount(income)) throw new Error('Kế hoạch hoặc lương không hợp lệ.');
  const ids = new Set((payload.debts as Debt[]).filter(d => d.balance > 0).map(d => d.id));
  const selected = plan.loans.flatMap(l => l.payoff);
  if (plan.loans.some(l => !l.amount && l.payoff.length)) throw new Error('Cần nhập số tiền vay trước khi chọn nợ tất toán.');
  if (selected.some(id => !ids.has(id)) || new Set(selected).size !== selected.length) throw new Error('Khoản tất toán không tồn tại, không còn dư nợ hoặc được chọn nhiều lần.');
  // Keep unknown extension fields from the baseline, including on individual rows.
  const old = payload.plan as Record<string, unknown> | undefined;
  const next: Record<string, unknown> = { ...old, ...structuredClone(plan) };
  for (const kind of ['cash', 'loans', 'buys'] as const) {
    const rows = Array.isArray(old?.[kind]) ? old[kind] as Record<string, unknown>[] : [];
    next[kind] = plan[kind].map(row => ({ ...rows.find(r => r.id === row.id), ...structuredClone(row) }));
  }
  payload.plan = next; payload.income = income;
}
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fmtM = (n: number) => { const v = Math.round(n) || 0; return Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} triệu` : `${v.toLocaleString('vi-VN')} đ`; };

// Port of v1.3 planSim; a scenario, not a reconciliation of recorded wallet transactions.
export function simulatePlan(data: Snapshot, today: Date, n = 12) {
  const recv = data.recv ?? [];
  if (!Number.isFinite(today.getTime()) || !Number.isInteger(n) || n < 1 || n > 120 || !validPlan(data.plan) || !amount(data.income) || !validReceivables(recv)) throw new Error('Kế hoạch, lương hoặc khoản phải thu chưa hợp lệ; hãy đối chiếu bản 1.3.');
  const plan = data.plan, base = index(today), income = data.income, debts = data.debts.filter(d => d.balance > 0);
  if (debts.some(d => !amount(d.balance) || !name(d.name) || (d.mode !== 'custom' && d.mode !== 'formula'))) throw new Error('Khoản nợ chưa hợp lệ để lập kế hoạch.');
  const months = Array.from({ length: n }, (_, j) => ({ key: key(new Date(today.getFullYear(), today.getMonth() + j, 1)), inn: 0, out: 0, debt: 0, bal: 0, ev: [] as { s: number; t: string; a: number }[] }));
  const offset = (k: string) => Math.max(0, Number(k.slice(0, 4)) * 12 + Number(k.slice(5)) - 1 - base);
  const add = (j: number, s: number, t: string, a: number, debt = false) => { if (j >= n || a === 0) return; const m = months[j]; if (s > 0) m.inn += a; else m.out += a; if (debt) m.debt += a; m.ev.push({ s, t, a }); };
  const payoffs = new Map<string, number>();
  for (const l of plan.loans) if (l.amount > 0) for (const id of l.payoff) { const o = offset(l.k); if (!payoffs.has(id) || o < payoffs.get(id)!) payoffs.set(id, o); }
  months.forEach((_, j) => {
    if (income && (j > 0 || plan.incomePending)) add(j, 1, 'Lương', income);
    if (plan.living) { const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); add(j, -1, 'Sinh hoạt', Math.round(plan.living * (j ? 1 : (dim - today.getDate() + 1) / dim))); }
  });
  const payoff = (d: Debt, o: number) => {
    if (d.mode === 'custom') {
      const rows = (d.sched || []).filter(r => remaining(r) > 0);
      const before = rows.reduce((sum, r) => sum + (Math.max(0, index(rowDue(d, r.k)) - base) < o ? remaining(r) : 0), 0);
      const rem = Math.max(0, d.balance - before);
      const principal = (d as Debt & { principal?: number }).principal;
      if (principal !== undefined && !amount(principal)) throw new Error('Gốc còn lại không hợp lệ.');
      return principal && principal > 0 ? Math.round(principal * rem / Math.max(1, d.balance)) : rem;
    }
    const rows = loanSchedule(d.balance, (d.rate ?? 0) / 1200, d.payment).rows;
    const start = d.paid?.[key(today)] ? 1 : 0;
    const count = Math.max(0, o - start);
    return count === 0 ? d.balance : rows[count - 1]?.bal ?? 0;
  };
  for (const d of debts) {
    let arr: number[];
    if (d.mode === 'custom') {
      if (!Array.isArray(d.sched) || !d.sched.every(r => r && month(r.k) && amount(r.a) && (r.settled === undefined || amount(r.settled) && r.settled <= r.a) && (r.p === undefined || r.p === 0 || typeof r.p === 'string')) || d.sched.reduce((sum, r) => sum + remaining(r), 0) !== d.balance) throw new Error(`Lịch khoản nợ ${d.name} không khớp số dư.`);
      arr = Array(n).fill(0);
      for (const r of d.sched) if (remaining(r) > 0) { const o = Math.max(0, index(rowDue(d, r.k)) - base); if (o < n) arr[o] += remaining(r); }
    } else {
      const forecast = formulaForecast(d, today);
      arr = Array(n).fill(0);
      forecast.forEach((r, i) => { const j = i + (d.paid?.[key(today)] ? 1 : 0); if (j < n) arr[j] += r.pay; });
    }
    arr.forEach((a, j) => { if (a && (payoffs.get(d.id) === undefined || j < payoffs.get(d.id)!)) add(j, -1, `Trả ${d.name}`, a, true); });
  }
  for (const [id, o] of payoffs) {
    const d = debts.find(x => x.id === id); if (!d || o >= n) continue;
    const prepay = (d as Debt & { prepay?: number }).prepay;
    if (prepay !== undefined && (typeof prepay !== 'number' || !Number.isFinite(prepay) || prepay < 0 || prepay > 100)) throw new Error('Phí tất toán không hợp lệ.');
    const bal = payoff(d, o), fee = bal * (prepay ?? 0) / 100;
    add(o, -1, `Tất toán ${d.name}${fee > 0 ? ` (gồm phí ${fmtM(fee)})` : ''}`, bal + fee);
  }
  for (const l of plan.loans) if (l.amount > 0) {
    const o = offset(l.k), payment = Math.round(monthlyPayment(l.amount, l.rate / 1200, l.months));
    if (!Number.isSafeInteger(payment) || payment <= 0 || !Number.isFinite(loanSchedule(l.amount, l.rate / 1200, payment).totalInterest)) throw new Error('Khoản vay dự định không tính được.');
    add(o, 1, `Nhận vay ${l.name}${l.fee > 0 ? ` (đã trừ phí ${fmtM(l.fee)})` : ''}`, l.amount - l.fee);
    for (let j = o + 1; j <= o + l.months && j < n; j++) add(j, -1, `Trả ${l.name || 'khoản vay mới'}`, payment, true);
  }
  plan.buys.forEach(b => { if (b.a) add(offset(b.k), -1, `Mua ${b.name}`, b.a); });
  let recvTotal = 0;
  recv.forEach(r => { if (r.inc === false) return; receivableArray(r, n, today).forEach((a, j) => { add(j, 1, `Thu từ ${r.name}`, a); recvTotal += a; }); });
  const cash0 = plan.cash.reduce((sum, c) => sum + c.a, 0);
  let bal = cash0;
  for (const m of months) { bal += m.inn - m.out; m.bal = bal; if (!Number.isFinite(bal) || Math.abs(bal) > Number.MAX_SAFE_INTEGER) throw new Error('Giá trị mô phỏng vượt giới hạn an toàn.'); }
  return { cash0, months, recvTotal, buffer: plan.buffer };
}