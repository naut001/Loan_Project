import { expect, it, vi } from 'vitest';
import { appendProposedLoan, editPlan, emptyPlan, nextMonth, proposeLoan } from './plan';
import { createCloudClient } from './cloud';

const plan = { cash: [{ id: 'c', name: 'Tiền', a: 50 }], buys: [], loans: [], living: 5, buffer: 10, incomePending: false };
const payload = { v: 1, wallets: [], debts: [], tx: {}, plan: { ...plan, extension: 'keep', cash: [{ ...plan.cash[0], extra: 7 }] }, fund: { saved: 1 }, updatedAt: 1 };
const reply = (value: unknown) => new Response(JSON.stringify(value));
it('máy tính chỉ đề xuất bản nháp tháng sau, giữ nguyên kế hoạch và không mang phí tất toán sớm sang', () => {
  const original = emptyPlan();
  const input = { amount: 100000000, rate: 17.99, months: 24, upfront: 2000000, prepay: 4, payoffAt: 12 };
  const proposal = proposeLoan(input);
  expect(proposal).toEqual({ amount: input.amount, rate: input.rate, months: input.months, upfront: input.upfront });
  const draft = appendProposedLoan(original, proposal, 'new', new Date(2026, 11, 31));
  expect(draft.loans).toEqual([{ id: 'new', name: 'Khoản vay dự định', amount: input.amount, rate: input.rate, months: 24, fee: 2000000, k: '2027-01', payoff: [] }]);
  expect(original.loans).toEqual([]);
  expect(() => appendProposedLoan(draft, proposal, 'new')).toThrow();
  expect(() => proposeLoan({ ...input, months: 121 })).toThrow('120');
  expect(() => appendProposedLoan(original, { ...proposal, upfront: proposal.amount }, 'x')).toThrow();
});
it('tháng mặc định của khoản vay dự định qua ranh giới năm', () => {
  expect(nextMonth(new Date(2026, 11, 31))).toBe('2027-01');
});
it('chỉ cho phép chọn nợ còn dư và không được chọn trùng khi gộp nợ dự định', () => {
  const draft: Record<string, unknown> = { ...structuredClone(payload), debts: [{ id: 'paid', balance: 0 }, { id: 'open', balance: 500 }] };
  const loan = { id: 'l', name: 'Gộp', amount: 1000, rate: 12, months: 12, k: '2026-10', fee: 0, payoff: ['paid'] };
  expect(() => editPlan(draft, { ...plan, loans: [loan] }, 0)).toThrow('không còn dư nợ');
  expect(() => editPlan(draft, { ...plan, loans: [{ ...loan, amount: 0, payoff: ['open'] }] }, 0)).toThrow('số tiền vay');
  expect(() => editPlan(draft, { ...plan, loans: [{ ...loan, payoff: ['open', 'open'] }] }, 0)).toThrow('nhiều lần');
  editPlan(draft, { ...plan, loans: [{ ...loan, payoff: ['open'] }] }, 0);
  expect((draft.debts as { balance: number }[])[1].balance).toBe(500);
  expect(draft.tx).toEqual({});
});
it('sửa kế hoạch giữ trường mở rộng, chặn dữ liệu lỗi trước khi ghi', () => {
  const draft: Record<string, unknown> = structuredClone(payload);
  expect(() => editPlan(draft, { ...plan, loans: [{ id: 'x', name: 'Vay', amount: 1, rate: 0, months: 1, fee: 0, k: '2026-10', payoff: ['missing'] }] }, 1)).toThrow('tồn tại');
  expect(draft).toEqual(payload);
  editPlan(draft, { ...plan, living: 8 }, 100);
  expect((draft.plan as typeof payload.plan).cash[0].extra).toBe(7);
  expect((draft.plan as typeof payload.plan).extension).toBe('keep');
  expect(draft.fund).toEqual(payload.fund);
});
it('khôi phục toàn bộ chỉ PATCH theo revision, không dùng timestamp của file và không retry xung đột', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } }))
    .mockResolvedValueOnce(reply([{ payload, updated_at: '2026-01-01T00:00:00Z' }])).mockResolvedValueOnce(reply([]));
  const cloud = createCloudClient('https://test.supabase.co', 'public', request);
  await cloud.signIn('a', 'b'); await cloud.load();
  await expect(cloud.restoreBackup('{"app":"so-tra-no","data":{}}')).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(2);
  await expect(cloud.restoreBackup(JSON.stringify({ ...payload, updatedAt: 999999 }))).rejects.toThrow('đã thay đổi');
  const sent = JSON.parse(String(request.mock.calls[2][1]?.body)).payload;
  expect(sent.fund).toEqual(payload.fund);
  expect(sent.updatedAt).not.toBe(999999);
  expect(String(request.mock.calls[2][0])).toContain('updated_at=eq.');
  expect(cloud.canSave()).toBe(false);
});