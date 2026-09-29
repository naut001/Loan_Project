import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';
import { localDate } from './format';
import { compareConsolidation } from './consolidation';
import { emptyPlan, appendProposedLoan, proposeLoan } from './plan';
import { summarize } from './snapshot';

// An in-memory PostgREST contract test, not a substitute for real PostgreSQL/RLS.
const initial = () => ({ v: 1, updatedAt: 1, wallets: [] as unknown[], tx: {}, debts: [] as unknown[], extension: { keep: true } });
function server() {
  const accounts = new Map([['a', { payload: initial() as Record<string, unknown>, revision: 1, history: [] as Record<string, unknown>[] }], ['b', { payload: initial() as Record<string, unknown>, revision: 1, history: [] as Record<string, unknown>[] }]]);
  const calls: { method: string; account: string; path: string }[] = [];
  const request = vi.fn<typeof fetch>(async (url, options) => {
    const path = String(url), method = options?.method || 'GET';
    if (path.includes('/auth/v1/token')) {
      const { email } = JSON.parse(String(options?.body));
      return new Response(JSON.stringify({ access_token: email, user: { id: email, email } }));
    }
    const account = String(options?.headers && (options.headers as Record<string, string>).Authorization || '').replace('Bearer ', '');
    calls.push({ method, account, path });
    const row = accounts.get(account);
    const query = new URL(path).searchParams;
    // Simulate an owner boundary; only a real Supabase test can prove its RLS policy.
    if (!row || query.get('user_id') !== `eq.${account}`) return new Response('[]');
    if (method === 'GET') return new Response(JSON.stringify([{ payload: row.payload, updated_at: new Date(row.revision * 1000).toISOString() }]));
    if (method !== 'PATCH' || query.get('updated_at') !== `eq.${new Date(row.revision * 1000).toISOString()}`) return new Response('[]');
    row.history.push(structuredClone(row.payload));
    row.payload = JSON.parse(String(options?.body)).payload;
    row.revision++;
    return new Response(JSON.stringify([{ payload: row.payload, updated_at: new Date(row.revision * 1000).toISOString() }]));
  });
  return { accounts, calls, request };
}

it('luồng trọn vẹn bằng cloud mô phỏng: tạo dữ liệu, so sánh, nháp, lưu, lịch sử, xung đột và cách ly', async () => {
  const { accounts, calls, request } = server();
  const a = createCloudClient('https://example.test', 'public', request);
  const stale = createCloudClient('https://example.test', 'public', request);
  const b = createCloudClient('https://example.test', 'public', request);
  await a.signIn('a', 'synthetic'); await stale.signIn('a', 'synthetic'); await b.signIn('b', 'synthetic');
  expect(await a.load()).toMatchObject({ wallets: [], debts: [] });
  await stale.load(); await b.load();
  expect(() => a.exportBackup()).not.toThrow();
  expect(accounts.get('a')!.revision).toBe(1);

  const wallet = await a.putWallet({ name: 'Ví thử', type: 'cash', opening: 10000000, openingDate: '' });
  const walletId = wallet.wallets[0].id;
  const second = await a.putWallet({ name: 'Ngân hàng thử', type: 'bank', opening: 0, openingDate: '' });
  const secondId = second.wallets[1].id;
  const today = localDate();
  await a.addCashEntry({ type: 'income', wallet: walletId, amount: 100000, date: today, note: 'Thu thử' });
  await a.addCashEntry({ type: 'transfer', wallet: walletId, to: secondId, amount: 10000, date: today, note: 'Chuyển thử' });
  const debt = await a.saveDebt({ name: 'Nợ công thức giả', dueDay: 10, stmtDay: 0, dueMode: 'day', grace: 0, formula: { balance: 3000000, rate: 12, payment: 300000 } });
  const debtId = debt.debts[0].id;
  const before = JSON.parse(a.exportBackup()).data;
  const input = { amount: 3500000, rate: 11, months: 18, upfront: 10000, prepay: 2, payoffAt: 6 };
  const comparison = compareConsolidation(input, debt.debts);
  expect(comparison.payoff).toBe(3000000);
  expect(JSON.parse(a.exportBackup()).data).toEqual(before);
  const proposal = proposeLoan(input);
  const plan = appendProposedLoan(emptyPlan(), proposal, 'loan-test');
  expect(plan.loans[0]).toMatchObject({ payoff: [], fee: 10000, amount: 3500000 });
  expect(accounts.get('a')!.revision).toBe(6);
  const saved = await a.putPlan({ ...plan, loans: [{ ...plan.loans[0], payoff: [debtId] }] }, 2000000);
  expect(saved.plan).toMatchObject({ loans: [{ payoff: [debtId] }] });
  expect(saved.debts).toEqual(debt.debts);
  expect(saved.tx).toEqual(debt.tx);
  expect(accounts.get('a')!.history.at(-1)).toEqual(before);
  expect(accounts.get('a')!.revision).toBe(7);
  expect(JSON.parse(a.exportBackup()).data.extension).toEqual({ keep: true });

  await expect(stale.putPlan(emptyPlan(), 1)).rejects.toThrow('đã thay đổi');
  expect(stale.canSave()).toBe(false);
  expect(accounts.get('a')!.revision).toBe(7);
  expect((await b.load())?.debts).toEqual([]);
  expect(accounts.get('b')!.history).toEqual([]);
  expect(calls.filter(c => c.method === 'PATCH' && c.account === 'b')).toHaveLength(0);
  expect((await a.load())?.plan).toEqual(saved.plan);
  a.disconnect();
  await expect(a.load()).rejects.toThrow('đăng nhập');
});

it('tài khoản chưa có hàng cloud không thể khởi tạo bằng v2', async () => {
  const request = vi.fn<typeof fetch>(async (url) => new Response(String(url).includes('/auth/') ? JSON.stringify({ access_token: 'a', user: { id: 'a' } }) : '[]'));
  const client = createCloudClient('https://example.test', 'public', request);
  await client.signIn('a', 'synthetic');
  expect(await client.load()).toBeNull();
  expect(client.canSave()).toBe(false);
  await expect(client.putWallet({ name: 'Ví', type: 'cash', opening: 0, openingDate: '' })).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(2);
});

it('các thao tác nối tiếp: ví, sửa/xoá giao dịch, lịch nợ, trả/undo, tín dụng, lô, ngân sách, phải thu và backup', async () => {
  const { request, accounts } = server();
  const cloud = createCloudClient('https://example.test', 'public', request);
  await cloud.signIn('a', 'synthetic'); await cloud.load();
  const today = localDate(), month = today.slice(0, 7);
  const wallet = { name: 'Ví thử', type: 'cash', opening: 1000000, openingDate: '' };
  let data = await cloud.putWallet(wallet);
  const cash = data.wallets[0].id;
  data = await cloud.putWallet({ ...wallet, name: 'Ví tạm', opening: 0 });
  const temporary = data.wallets[1].id;
  await cloud.putWallet({ ...wallet, name: 'Ví tạm đã sửa', opening: 0 }, temporary);
  await cloud.removeWallet(temporary);
  const cashEntry = { type: 'expense' as const, wallet: cash, amount: 10000, date: today, note: 'Chi thử' };
  data = await cloud.addCashEntry(cashEntry);
  const cashTx = data.tx[month][0].id;
  data = await cloud.addCashEntry({ ...cashEntry, amount: 20000 }, undefined, cashTx);
  expect(summarize(data, today).cash).toBe(980000);
  data = await cloud.removeCashEntry(cashTx);
  expect(summarize(data, today).cash).toBe(1000000);

  const details = { name: 'Nợ tháng giả', dueDay: 10, stmtDay: 0, dueMode: 'day' as const, grace: 0 };
  data = await cloud.saveDebt(details);
  const debt = data.debts[0].id;
  await cloud.saveDebt({ ...details, name: 'Nợ tháng đã sửa' }, debt);
  await cloud.saveSchedule({ debt, values: { month, amount: 100000 } });
  await cloud.saveSchedule({ debt, index: 0, values: { month, amount: 120000 } });
  await cloud.saveSchedule({ debt, index: 0 });
  await cloud.saveSchedule({ debt, values: { month, amount: 100000 } });
  data = await cloud.payDebt({ debt, index: 0, wallet: cash, date: today, principal: 40000, interest: 5000, fee: 1000, note: 'Trả thử' });
  expect(data.debts[0].balance).toBe(60000);
  expect(summarize(data, today)).toMatchObject({ cash: 954000, expense: 6000 });
  await expect(cloud.removeCashEntry(data.tx[month][0].id)).rejects.toThrow('liên kết');
  data = await cloud.undoPayment(data.tx[month][0].id);
  expect(data.debts[0].balance).toBe(100000);
  data = await cloud.saveCredit({ debt, date: today, period: month, amount: 50000, category: 'Khác', note: 'Mua thử' });
  expect(summarize(data, today)).toMatchObject({ cash: 1000000, expense: 50000 });
  data = await cloud.saveCredit(data.tx[month][0].id);
  expect(data.debts[0].balance).toBe(100000);
  const beforeInvalid = cloud.exportBackup();
  const writesBefore = accounts.get('a')!.revision;
  await expect(cloud.addCashBatch([cashEntry, { ...cashEntry, wallet: 'missing' }])).rejects.toThrow('Dòng 2');
  expect(accounts.get('a')!.revision).toBe(writesBefore);
  expect(JSON.parse(cloud.exportBackup()).data).toEqual(JSON.parse(beforeInvalid).data);
  data = await cloud.addCashBatch([cashEntry, { type: 'credit', debt, date: today, period: month, amount: 20000, category: 'Khác', note: 'Lô thử' }]);
  expect(summarize(data, today)).toMatchObject({ cash: 990000, expense: 30000 });
  await cloud.putBudget(month, 'Khác', 200000);
  data = await cloud.putBudget(month, 'Khác', 0);
  expect(data.budgets).toEqual({});

  const receivable = { name: 'Phải thu giả', amount: 100000, got: 0, kind: 'once' as const, due: today, startK: '', day: 1, per: 0, inc: true, note: '' };
  data = await cloud.putReceivable(receivable);
  const recv = (data.recv![0] as { id: string }).id;
  await cloud.putReceivable({ ...receivable, name: 'Phải thu đã sửa' }, recv);
  const beforeCollection = data.tx;
  data = await cloud.collectReceivable(recv, 30000);
  expect(data.recv![0]).toMatchObject({ got: 30000, log: [{ a: 30000 }] });
  expect(data.tx).toEqual(beforeCollection);
  data = await cloud.undoReceivable(recv);
  expect(data.recv![0]).toMatchObject({ got: 0, log: [] });
  await cloud.putReceivable(undefined, recv);
  const backup = cloud.exportBackup();
  await cloud.putBudget(month, 'Khác', 1000);
  data = await cloud.restoreBackup(backup);
  expect(data.budgets).toEqual({});
  expect(JSON.parse(cloud.exportBackup()).data.extension).toEqual({ keep: true });
  data = await cloud.saveDebt({ ...details, name: 'Công thức giả', formula: { balance: 300000, rate: 12, payment: 30000 } });
  const formula = data.debts.find(d => d.mode === 'formula')!.id;
  const beforeConversion = data.tx;
  data = await cloud.convertDebt(formula);
  expect(data.debts.find(d => d.id === formula)).toMatchObject({ mode: 'custom' });
  expect(data.tx).toEqual(beforeConversion);
  data = await cloud.saveDebt({ ...details, name: 'Nợ trống' });
  const empty = data.debts.find(d => d.name === 'Nợ trống')!.id;
  data = await cloud.saveDebt(undefined, empty);
  expect(data.debts.some(d => d.id === empty)).toBe(false);
  expect((await cloud.load())?.tx).toEqual(data.tx);
});