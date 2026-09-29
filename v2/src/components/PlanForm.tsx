import { useState } from 'react';
import { appendProposedLoan, emptyPlan, nextMonth, validPlan, type LoanProposal, type Plan } from '../lib/plan';
import type { Snapshot } from '../lib/snapshot';
import { Button } from './ui/button';

const numeric = (value: string) => value.trim() === '' ? NaN : Number(value.replace(',', '.'));
export function PlanForm({ data, disabled, onSave, proposal, onConsume }: { data: Snapshot; disabled: boolean; onSave: (plan: Plan, income: number) => Promise<void>; proposal?: LoanProposal | null; onConsume?: () => void }) {
  const valid = data.plan === undefined || validPlan(data.plan);
  const [plan, setPlan] = useState<Plan>(valid && data.plan ? structuredClone(data.plan as Plan) : emptyPlan());
  const [income, setIncome] = useState(String(data.income ?? 0));
  const [error, setError] = useState('');
  const change = (kind: 'cash' | 'buys' | 'loans', id: string, field: string, value: string | number | string[]) => setPlan(p => ({ ...p, [kind]: p[kind].map(row => row.id === id ? { ...row, [field]: value } : row) }));
  const remove = (kind: 'cash' | 'buys' | 'loans', id: string) => setPlan(p => ({ ...p, [kind]: p[kind].filter(row => row.id !== id) }));
  const add = (kind: 'cash' | 'buys' | 'loans') => {
    const id = crypto.randomUUID(), k = nextMonth();
    setPlan(p => ({ ...p, [kind]: [...p[kind], kind === 'cash' ? { id, name: '', a: 0 } : kind === 'buys' ? { id, name: '', a: 0, k } : { id, name: '', amount: 0, rate: 0, months: 12, k, fee: 0, payoff: [] }] }));
  };
  if (!valid) return <section role="alert"><h3>Sửa kế hoạch</h3><p>Kế hoạch cũ chưa hợp lệ. Hãy đối chiếu và sửa ở bản 1.3 rồi tải lại; không ghi đè dữ liệu lỗi.</p></section>;
  return <form onSubmit={e => {
    e.preventDefault(); setError('');
    const salary = numeric(income);
    if (!validPlan(plan) || !Number.isSafeInteger(salary) || salary < 0 || salary > 1e12) { setError('Kiểm tra lương, số tiền, lãi suất, tháng giải ngân và kỳ hạn (1–120).'); return; }
    const selected = plan.loans.flatMap(l => l.payoff);
    if (plan.loans.some(l => !l.amount && l.payoff.length)) { setError('Cần nhập số tiền vay trước khi chọn nợ tất toán.'); return; }
    if (new Set(selected).size !== selected.length || selected.some(id => !data.debts.some(d => d.id === id && d.balance > 0))) { setError('Một khoản nợ chỉ được tất toán một lần và phải còn dư nợ.'); return; }
    void onSave(plan, salary);
  }}><h3>Sửa kế hoạch dự kiến</h3><p className="footnote">Các khoản dưới đây chỉ là giả định, độc lập với ví và giao dịch. Xuất sao lưu trước khi lưu lên Supabase.</p><fieldset disabled={disabled}>
    <label>Lương dự kiến mỗi tháng (đ)<input type="number" required min="0" max="1000000000000" step="1" value={income} onChange={e => setIncome(e.target.value)} /></label>
    <div className="filters"><label>Sinh hoạt/tháng (đ)<input type="number" required min="0" step="1" value={plan.living} onChange={e => setPlan({ ...plan, living: numeric(e.target.value) })} /></label><label>Mức an toàn (đ)<input type="number" required min="0" step="1" value={plan.buffer} onChange={e => setPlan({ ...plan, buffer: numeric(e.target.value) })} /></label></div>
    <label><input type="checkbox" checked={plan.incomePending} onChange={e => setPlan({ ...plan, incomePending: e.target.checked })} /> Lương tháng này chưa nhận (tính vào dự phóng)</label>
    <h4>Tiền đang có trong kế hoạch (không tự lấy số dư ví)</h4>
    {plan.cash.map(c => <div className="filters" key={c.id}><label>Tên khoản tiền<input maxLength={80} value={c.name} onChange={e => change('cash', c.id, 'name', e.target.value)} /></label><label>Số tiền (đ)<input type="number" required min="0" step="1" value={c.a} onChange={e => change('cash', c.id, 'a', numeric(e.target.value))} /></label><Button type="button" variant="outline" onClick={() => remove('cash', c.id)}>Xoá khoản tiền</Button></div>)}
    <Button type="button" variant="outline" onClick={() => add('cash')}>Thêm tiền đang có</Button>
    <h4>Mua sắm dự định</h4>
    {plan.buys.map(b => <div className="filters" key={b.id}><label>Tên món<input maxLength={80} value={b.name} onChange={e => change('buys', b.id, 'name', e.target.value)} /></label><label>Số tiền (đ)<input type="number" required min="0" step="1" value={b.a} onChange={e => change('buys', b.id, 'a', numeric(e.target.value))} /></label><label>Tháng mua<input type="month" required value={b.k} onChange={e => change('buys', b.id, 'k', e.target.value)} /></label><Button type="button" variant="outline" onClick={() => remove('buys', b.id)}>Xoá món</Button></div>)}
    <Button type="button" variant="outline" onClick={() => add('buys')}>Thêm mua sắm</Button>
    <h4>Khoản vay dự định</h4>
    {proposal && <div className="panel"><p>Đề xuất từ máy tính: vay {proposal.amount.toLocaleString('vi-VN')} đ, lãi {proposal.rate}%/năm, {proposal.months} tháng, phí {proposal.upfront.toLocaleString('vi-VN')} đ. Chưa lưu.</p><Button type="button" variant="outline" onClick={() => {
      try { const next = appendProposedLoan(plan, proposal, crypto.randomUUID()); setPlan(next); setError(''); onConsume?.(); }
      catch (e) { setError(e instanceof Error ? e.message : 'Không nhập được đề xuất.'); }
    }}>Nhập đề xuất vào bản nháp</Button></div>}
    {plan.loans.map(l => <div className="panel" key={l.id}><div className="filters"><label>Tên khoản vay<input maxLength={80} value={l.name} onChange={e => change('loans', l.id, 'name', e.target.value)} /></label><label>Số tiền vay (đ)<input type="number" required min="0" step="1" value={l.amount} onChange={e => change('loans', l.id, 'amount', numeric(e.target.value))} /></label><label>Lãi suất %/năm<input inputMode="decimal" value={l.rate} onChange={e => change('loans', l.id, 'rate', numeric(e.target.value))} /></label><label>Kỳ hạn (tháng)<input type="number" required min="1" max="120" step="1" value={l.months} onChange={e => change('loans', l.id, 'months', numeric(e.target.value))} /></label><label>Tháng giải ngân<input type="month" required value={l.k} onChange={e => change('loans', l.id, 'k', e.target.value)} /></label><label>Phí ban đầu (đ)<input type="number" required min="0" step="1" value={l.fee} onChange={e => change('loans', l.id, 'fee', numeric(e.target.value))} /></label></div>
      <p>Dùng khoản vay để tất toán nợ (chỉ mô phỏng):</p>{data.debts.filter(d => d.balance > 0).map(d => <label key={d.id}><input type="checkbox" checked={l.payoff.includes(d.id)} onChange={e => change('loans', l.id, 'payoff', e.target.checked ? [...l.payoff, d.id] : l.payoff.filter(id => id !== d.id))} /> {d.name}</label>)}<Button type="button" variant="outline" onClick={() => remove('loans', l.id)}>Xoá khoản vay dự định</Button></div>)}
    <Button type="button" variant="outline" onClick={() => add('loans')}>Thêm khoản vay dự định</Button>
    <p className="footnote">Khoản vay mới trả kỳ đầu từ tháng sau giải ngân. Chọn tất toán dừng kỳ trả cũ từ tháng giải ngân; kiểm tra số tất toán thực tế với bên cho vay.</p>
    <Button type="submit">Lưu kế hoạch lên Supabase</Button>
  </fieldset>{error && <p role="alert">{error}</p>}</form>;
}