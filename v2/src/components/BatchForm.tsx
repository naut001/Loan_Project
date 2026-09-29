import { useState } from 'react';
import type { BatchEntry } from '../lib/cloud';
import type { Debt } from '../lib/debt';
import type { Wallet } from '../lib/snapshot';
import { categories } from '../lib/budget';
import { localDate } from '../lib/format';
import { Button } from './ui/button';

export function BatchForm({ wallets, debts, disabled, onSave }: { wallets: Wallet[]; debts: Debt[]; disabled: boolean; onSave: (entries: BatchEntry[]) => Promise<boolean> }) {
  const [date, setDate] = useState(localDate());
  const fresh = () => ({ id: crypto.randomUUID(), type: 'expense', wallet: wallets[0]?.id || '', debt: '', period: '', amount: '', category: 'Khác', note: '' });
  const [rows, setRows] = useState(() => [fresh()]);
  const update = (id: string, key: 'type' | 'debt' | 'period' | 'wallet' | 'amount' | 'category' | 'note', value: string) => setRows(rows.map(r => r.id === id ? { ...r, [key]: value } : r));
  return <form onSubmit={e => { e.preventDefault(); void onSave(rows.map((r): BatchEntry => r.type === 'credit' ? { type: 'credit', date, debt: r.debt, period: r.period, amount: Number(r.amount), category: r.category, note: r.note } : { type: 'expense', date, wallet: r.wallet, amount: Number(r.amount), category: r.category, note: r.note })).then(ok => { if (ok) setRows([fresh()]); }); }}>
    <h3>Ghi lô chi tiền và mua tín dụng</h3>
    <fieldset disabled={disabled}>
      <label>Ngày chung<input required type="date" max={localDate()} value={date} onChange={e => setDate(e.target.value)} /></label>
      {rows.map((r, i) => <div className="filters" key={r.id}>
        <label>Nguồn chi dòng {i + 1}<select value={r.type} onChange={e => update(r.id, 'type', e.target.value)}><option value="expense">Chi tiền từ ví</option><option value="credit">Mua tín dụng</option></select></label>
        {r.type === 'credit' ? <><label>Khoản nợ<select required value={r.debt} onChange={e => update(r.id, 'debt', e.target.value)}><option value="">Chọn khoản nợ</option>{debts.filter(d => d.mode === 'custom').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Kỳ trả (trống: tự tính)<input type="month" min={date.slice(0, 7)} value={r.period} onChange={e => update(r.id, 'period', e.target.value)} /></label></> : <label>Ví dòng {i + 1}<select required value={r.wallet} onChange={e => update(r.id, 'wallet', e.target.value)}>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
        <label>Số tiền (đ)<input required type="number" min="1" max="1000000000000" step="1" value={r.amount} onChange={e => update(r.id, 'amount', e.target.value)} /></label>
        <label>Danh mục<select value={r.category} onChange={e => update(r.id, 'category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Ghi chú<input maxLength={200} value={r.note} onChange={e => update(r.id, 'note', e.target.value)} /></label>
        <Button type="button" variant="outline" disabled={rows.length === 1} onClick={() => setRows(rows.filter(x => x.id !== r.id))}>Bỏ dòng {i + 1}</Button>
      </div>)}
      <p className="footnote">Lưu cả lô một lần; một dòng sai thì không lưu dòng nào. Chi tiền giảm ví; mua tín dụng thêm kỳ nợ, không giảm ví. Chưa hỗ trợ trả nợ trong lô. Không nhập lại khoản mua đã có trong lịch.</p>
      <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => setRows([...rows, fresh()])}>Thêm dòng</Button>
      <Button type="submit">Lưu cả lô chi</Button>
    </fieldset>
  </form>;
}