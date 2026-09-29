import { useState } from 'react';
import type { Snapshot } from '../lib/snapshot';
import { categories, categoryExpense } from '../lib/budget';
import { localDate, money } from '../lib/format';
import { Button } from './ui/button';

export function BudgetForm({ data, disabled, onSave }: { data: Snapshot; disabled: boolean; onSave: (month: string, category: string, amount: number) => Promise<void> }) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [category, setCategory] = useState(categories[0]);
  const [draft, setDraft] = useState<string | null>(null);
  const limit = data.budgets?.[month]?.[category] || 0;
  return <section>
    <h3>Ngân sách theo tháng</h3>
    <form onSubmit={e => { e.preventDefault(); void onSave(month, category, Number(draft ?? limit)); }}>
      <fieldset disabled={disabled}><div className="filters">
        <label>Tháng<input required type="month" value={month} onChange={e => { setMonth(e.target.value); setDraft(null); }} /></label>
        <label>Danh mục<select value={category} onChange={e => { setCategory(e.target.value); setDraft(null); }}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Hạn mức (đ)<input required type="number" min="0" max="1000000000000" step="1" value={draft ?? limit} onChange={e => setDraft(e.target.value)} /></label>
      </div><p className="footnote">Nhập 0 để bỏ hạn mức. Chi tiêu gồm mua tín dụng và lãi/phí trả nợ, không gồm gốc trả nợ hoặc chuyển ví. Số liệu bao gồm mọi giao dịch trong tháng đã chọn.</p><Button type="submit">Lưu ngân sách</Button></fieldset>
    </form>
    {categories.map(c => {
      const budget = data.budgets?.[month]?.[c] || 0;
      const spent = categoryExpense(data.tx[month] || [], c);
      if (!budget && !spent) return null;
      return <div className="transaction" key={c}><div><strong>{c}</strong><p>Đã chi: {money(spent)} · Hạn mức: {budget ? money(budget) : 'Chưa đặt'}</p>{budget > 0 && <p className={spent > budget ? 'error' : 'muted'}>{spent > budget ? 'Vượt ngân sách' : 'Còn lại'}: {money(Math.abs(budget - spent))}</p>}</div></div>;
    })}
  </section>;
}