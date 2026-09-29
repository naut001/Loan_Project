export interface LoanInput { amount: number; rate: number; months: number; upfront: number; prepay: number; payoffAt: number }
export function monthlyPayment(principal: number, rate: number, months: number) {
  return rate === 0 ? principal / months : principal * rate / (1 - Math.pow(1 + rate, -months));
}
export function loanSchedule(principal: number, rate: number, payment: number) {
  const rows: { k: number; pay: number; prin: number; i: number; bal: number }[] = [];
  let balance = principal, totalInterest = 0;
  for (let k = 1; k <= 600 && balance > 0.5; k++) {
    const interest = Math.round(balance * rate);
    let pay = payment, prin = pay - interest;
    if (prin >= balance - 100 || k === 600) { prin = balance; pay = balance + interest; }
    if (prin <= 0) throw new Error('Số trả không đủ trả lãi.');
    balance -= prin; totalInterest += interest;
    rows.push({ k, pay, prin, i: interest, bal: Math.max(0, balance) });
  }
  return { rows, totalInterest, months: rows.length };
}
export function calculateLoan(input: LoanInput) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 1e12 || !Number.isInteger(input.months) || input.months < 1 || input.months > 600 || !Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100 || !Number.isSafeInteger(input.upfront) || input.upfront < 0 || input.upfront >= input.amount || !Number.isFinite(input.prepay) || input.prepay < 0 || input.prepay > 100 || !Number.isInteger(input.payoffAt) || input.payoffAt < 1 || input.payoffAt > input.months) throw new Error('Kiểm tra số tiền, kỳ hạn (1–600 tháng), lãi suất và phí. Phí ban đầu phải nhỏ hơn số tiền vay.');
  const rate = input.rate / 1200;
  const payment = Math.round(monthlyPayment(input.amount, rate, input.months));
  const schedule = loanSchedule(input.amount, rate, payment);
  const k = Math.max(1, Math.min(input.months - 1, input.payoffAt));
  const balance = schedule.rows[k - 1]?.bal || 0;
  const fee = balance * input.prepay / 100;
  const fullCost = schedule.totalInterest + input.upfront;
  const earlyCost = schedule.rows.slice(0, k).reduce((sum, row) => sum + row.i, 0) + fee + input.upfront;
  let lastGood = 0, interestPaid = 0;
  for (const row of schedule.rows.slice(0, input.months - 1)) {
    interestPaid += row.i;
    if (schedule.totalInterest - interestPaid > row.bal * input.prepay / 100) lastGood = row.k;
  }
  let lo = 0, hi = 0.3;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (monthlyPayment(input.amount - input.upfront, mid, input.months) > payment) hi = mid; else lo = mid;
  }
  return { ...schedule, payment, fullCost, effectiveRate: (Math.pow(1 + rate, 12) - 1) * 100, feeRate: input.upfront > 0 ? (lo + hi) / 2 * 1200 : null, payoffAt: k, balance, fee, earlyCost, saving: fullCost - earlyCost, lastGood };
}