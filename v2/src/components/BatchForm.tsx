import { useState } from 'react';
import type { CashEntry } from '../lib/cloud';
import type { Wallet } from '../lib/snapshot';
import { categories } from '../lib/budget';
import { localDate } from '../lib/format';
import { Button } from './ui/button';

export function BatchForm({ wallets, disabled, onSave }: { wallets: Wallet[]; disabled: boolean; onSave: (entries: CashEntry[]) => Promise<boolean> }) {
  const [date, setDate] = useState(localDate());
  const fresh = () => ({ id: crypto.randomUUID(), wallet: wallets[0]?.id || '', amount: '', category: 'Khác', note: '' });
  const [rows, setRows] = useState(() => [fresh()]);
  const update = (id: string, key: 'wallet' | 'amount' | 'category' | 'note', value: string) => setRows(rows.map(r => r.id === id ? { ...r, [key]: value } : r));
  return <form onSubmit={e => { e.preventDefault(); void onSave(rows.map(r => ({ type: 'expense', date, wallet: r.wallet, amount: Number(r.amount), category: r.category, note: r.note }))).then(ok => { if (ok) setRows([fresh()]); }); }}>
    <h3>Ghi nhiều khoản chi tiền</h3>
    <fieldset disabled={disabled}>
      <label>Ngày chung<input required type="date" max={localDate()} value={date} onChange={e => setDate(e.target.value)} /></label>
      {rows.map((r, i) => <div className="filters" key={r.id}>
        <label>Ví dòng {i + 1}<select value={r.wallet} onChange={e => update(r.id, 'wallet', e.target.value)}>{wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>Số tiền (đ)<input required type="number" min="1" max="1000000000000" step="1" value={r.amount} onChange={e => update(r.id, 'amount', e.target.value)} /></label>
        <label>Danh mục<select value={r.category} onChange={e => update(r.id, 'category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Ghi chú<input maxLength={200} value={r.note} onChange={e => update(r.id, 'note', e.target.value)} /></label>
        <Button type="button" variant="outline" disabled={rows.length === 1} onClick={() => setRows(rows.filter(x => x.id !== r.id))}>Bỏ dòng {i + 1}</Button>
      </div>)}
      <p className="footnote">Lưu cả lô một lần; một dòng sai thì không lưu dòng nào. Chỉ dành cho chi tiền, chưa hỗ trợ lô mua tín dụng hoặc trả nợ.</p>
      <Button type="button" variant="outline" disabled={rows.length >= 100} onClick={() => setRows([...rows, fresh()])}>Thêm dòng</Button>
      <Button type="submit">Lưu cả lô chi tiền</Button>
    </fieldset>
  </form>;
}