import { useState } from 'react';
import type { Snapshot } from '../lib/snapshot';
import { creditPeriod, type CreditPurchase } from '../lib/credit';
import { categories } from '../lib/budget';
import { localDate, money } from '../lib/format';
import { Button } from './ui/button';

export function CreditForm({ data, disabled, onSave }: { data: Snapshot; disabled: boolean; onSave: (values: CreditPurchase | string) => Promise<void> }) {
  const [debt, setDebt] = useState('');
  const [date, setDate] = useState(localDate());
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('');
  const [category, setCategory] = useState('Khác');
  const [note, setNote] = useState('');
  const [undoId, setUndoId] = useState('');
  const selected = data.debts.find(d => d.id === debt);
  return <form onSubmit={e => { e.preventDefault(); void onSave({ debt, date, amount: Number(amount), period, category, note }); }}>
    <h3>Mua tín dụng</h3><fieldset disabled={disabled}><div className="filters">
      <label>Khoản nợ<select required value={debt} onChange={e => { setDebt(e.target.value); setPeriod(''); }}><option value="">Chọn khoản nợ</option>{data.debts.filter(d => d.mode === 'custom').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>Ngày mua<input required type="date" max={localDate()} value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Số tiền mua (đ)<input required type="number" min="1" max="1000000000000" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label>Kỳ trả (để trống để tự tính)<input type="month" min={date.slice(0, 7)} value={period} onChange={e => setPeriod(e.target.value)} /></label>
      <label>Danh mục<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Ghi chú<input maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></label>
    </div><p className="footnote">Ghi chi tiêu và thêm kỳ nợ, không trừ tiền ví. Không nhập lại khoản mua đã nằm trong lịch. {selected && date && `Kỳ sẽ ghi: ${period || creditPeriod(selected, date)}.`}</p>
    <Button type="submit">Lưu khoản mua tín dụng</Button>
    <h3>Hoàn tác khoản mua</h3><label>Khoản mua tín dụng<select value={undoId} onChange={e => setUndoId(e.target.value)}><option value="">Chọn khoản mua cần hoàn tác</option>{Object.values(data.tx).flat().filter(t => t.type === 'credit').sort((a, b) => b.date.localeCompare(a.date)).map(t => <option key={t.id} value={t.id}>{t.date} · {data.debts.find(d => d.id === t.debt)?.name || 'Liên kết nợ không rõ'} · {money(t.amount)} · {t.note}</option>)}</select></label>
    <p className="footnote">Chỉ xoá bản ghi và kỳ liên kết chưa trả. Nếu đã thanh toán, cần hoàn tác thanh toán trước. Đây không phải yêu cầu hoàn tiền tới nhà bán hàng.</p>
    <Button type="button" variant="outline" disabled={!undoId} onClick={() => void onSave(undoId)}>Hoàn tác khoản mua đã chọn</Button></fieldset>
  </form>;
}