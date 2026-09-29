import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { expect, it } from 'vitest';
import { calculateLoan } from './loan';

it('đối chiếu lịch, chi phí, APR và tất toán với v1.3 ở lãi 0 và khoản UOB', () => {
  const context = createContext({});
  runInContext(readFileSync(new URL('../../../js/loan.js', import.meta.url), 'utf8'), context);
  for (const rate of [0, 17.99, 20.99]) for (const months of [1, 12, 24]) {
    const input = { amount: 100000000, rate, months, upfront: 2000000, prepay: 4, payoffAt: Math.min(6, months) };
    const result = calculateLoan(input);
    const payment = runInContext(`Math.round(pmt(${input.amount}, ${rate}/1200, ${months}))`, context);
    expect(result.payment).toBe(payment);
    const old = runInContext(`schedule(${input.amount}, ${rate}/1200, ${payment})`, context);
    expect(result.rows).toEqual(JSON.parse(JSON.stringify(old.rows)));
    expect(result.totalInterest).toBe(old.totalInterest);
    expect(result.feeRate).toBeCloseTo(runInContext(`rateFor(98000000, ${payment}, ${months})*1200`, context), 8);
    expect(result.saving).toBe(result.fullCost - result.earlyCost);
  }
});
it('từ chối dữ liệu không hợp lệ thay vì hiển thị NaN', () => {
  const input = { amount: 100000000, rate: 0, months: 12, upfront: 0, prepay: 0, payoffAt: 6 };
  for (const change of [{ amount: NaN }, { months: 0 }, { months: 601 }, { rate: -1 }, { upfront: input.amount }, { payoffAt: 0 }]) expect(() => calculateLoan({ ...input, ...change })).toThrow();
});