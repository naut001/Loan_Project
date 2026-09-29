import { parseSnapshot } from './snapshot';
import { convertFormula } from './conversion';

export interface DebtDetails { name: string; dueDay: number; stmtDay: number; dueMode: 'day' | 'after'; grace: number; formula?: { balance: number; payment: number; rate: number } }

export function editDebt(payload: Record<string, unknown>, values: DebtDetails | undefined, id?: string) {
  const data = parseSnapshot(JSON.stringify(payload));
  const debt = id === undefined ? undefined : data.debts.find(d => d.id === id);
  if (id !== undefined && !debt) throw new Error('Khoản nợ không còn tồn tại. Hãy tải lại.');
  const raw = debt as unknown as Record<string, unknown> | undefined;
  const history = !!debt && (debt.balance !== 0 || debt.payment !== 0 || (raw?.sched !== undefined && (!Array.isArray(raw.sched) || raw.sched.length > 0)) || (raw?.paid !== undefined && (!raw.paid || typeof raw.paid !== 'object' || Object.keys(raw.paid).length > 0)) || Object.values(data.tx).flat().some(t => t.debt === id));
  if (!values) {
    if (!debt || history || ['principal', 'original', 'months'].some(k => raw?.[k] !== undefined && raw[k] !== 0)) throw new Error('Chỉ xoá khoản nợ trống, không có số dư hoặc lịch sử.');
    data.debts = data.debts.filter(d => d.id !== id);
  } else {
    if (typeof values.name !== 'string' || !values.name.trim() || values.name.trim().length > 80 || !Number.isInteger(values.dueDay) || values.dueDay < 1 || values.dueDay > 31 || !Number.isInteger(values.stmtDay) || values.stmtDay < 0 || values.stmtDay > 31 || !Number.isInteger(values.grace) || values.grace < 0 || values.grace > 60 || !['day', 'after'].includes(values.dueMode)) throw new Error('Kiểm tra tên, ngày đến hạn, ngày sao kê và số ngày ân hạn.');
    if (history && debt && (['dueDay', 'stmtDay', 'dueMode', 'grace'] as const).some(k => debt[k] !== values[k])) throw new Error('Khoản nợ đã có số dư hoặc lịch sử: chỉ đổi tên để giữ nguyên hạn trả.');
    const details = { name: values.name.trim(), dueDay: values.dueDay, stmtDay: values.stmtDay, dueMode: values.dueMode, grace: values.grace };
    if (values.formula) {
      const { balance, payment, rate } = values.formula;
      if (![balance, payment].every(n => Number.isSafeInteger(n) && n > 0 && n <= 1e12) || typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) throw new Error('Kiểm tra dư nợ, số trả hàng tháng và lãi suất năm.');
      if (debt && (debt.mode !== 'formula' || (raw?.sched !== undefined && (!Array.isArray(raw.sched) || raw.sched.length > 0)) || (raw?.paid !== undefined && (!raw.paid || typeof raw.paid !== 'object' || Array.isArray(raw.paid) || Object.keys(raw.paid).length > 0)) || Object.values(data.tx).flat().some(t => t.debt === id))) throw new Error('Không sửa công thức khi có lịch hoặc lịch sử thanh toán.');
      const candidate = { ...(debt || {}), ...details, id: debt?.id || crypto.randomUUID(), mode: 'formula' as const, balance, payment, rate, rateImplied: false };
      // Validate using the same amortization engine as conversion, on a separate draft.
      const check = { ...payload, debts: [candidate] };
      convertFormula(check, candidate.id);
      const months = parseSnapshot(JSON.stringify(check)).debts[0].sched!.length;
      Object.assign(candidate, { months, ...(debt ? {} : { original: balance, paid: {} }) });
      if (debt) Object.assign(debt, candidate);
      else data.debts.push(candidate);
    } else if (debt) Object.assign(debt, details);
    else data.debts.push({ id: crypto.randomUUID(), mode: 'custom', balance: 0, payment: 0, sched: [], ...details });
  }
  parseSnapshot(JSON.stringify({ ...payload, debts: data.debts }));
  payload.debts = data.debts;
}